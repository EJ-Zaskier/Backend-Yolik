const crypto = require('crypto');
const { auth } = require('express-oauth2-jwt-bearer');
const User = require('../models/User.model');

const normalizeIssuer = () => {
  const explicitIssuer = process.env.AUTH0_ISSUER_BASE_URL;
  if (explicitIssuer) {
    return explicitIssuer.endsWith('/') ? explicitIssuer : `${explicitIssuer}/`;
  }

  const domain = process.env.AUTH0_DOMAIN;
  if (!domain) return null;

  const cleanDomain = String(domain).trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!cleanDomain) return null;
  return `https://${cleanDomain}/`;
};

const issuerBaseURL = normalizeIssuer();
const audience = process.env.AUTH0_API_AUDIENCE || null;

const tokenVerifier = issuerBaseURL && audience
  ? auth({
      issuerBaseURL,
      audience,
      tokenSigningAlg: 'RS256',
      strict: false
    })
  : null;

const getScopes = (payload) => {
  if (!payload?.scope || typeof payload.scope !== 'string') return [];
  return payload.scope
    .split(' ')
    .map((scope) => scope.trim())
    .filter(Boolean);
};

const getRoles = (payload) => {
  const rolesClaimNamespace = process.env.AUTH0_ROLES_CLAIM || 'https://yolik.com/roles';

  if (Array.isArray(payload?.[rolesClaimNamespace])) {
    return payload[rolesClaimNamespace].filter((role) => typeof role === 'string');
  }

  if (Array.isArray(payload?.roles)) {
    return payload.roles.filter((role) => typeof role === 'string');
  }

  return [];
};

const getPermissions = (payload) => {
  if (!Array.isArray(payload?.permissions)) return [];
  return payload.permissions.filter((permission) => typeof permission === 'string');
};

const buildSubjectDigest = (sub, size = 24) =>
  crypto.createHash('sha256').update(sub).digest('hex').slice(0, size);

const buildFallbackDisplayName = (sub) => `Usuario-${buildSubjectDigest(sub, 6)}`;

const sanitizeDisplayName = (value) => {
  if (typeof value !== 'string') return null;

  const sanitized = value
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);

  return sanitized || null;
};

const looksLikeEmail = (value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);

const normalizeName = (payload, sub) => {
  const usernameClaim = process.env.AUTH0_USERNAME_CLAIM || 'https://yolik.app/username';

  const candidates = [
    payload?.[usernameClaim],
    payload?.preferred_username,
    payload?.nickname,
    payload?.name,
    payload?.given_name
  ];

  for (const candidate of candidates) {
    const normalized = sanitizeDisplayName(candidate);
    if (!normalized) continue;
    if (looksLikeEmail(normalized)) continue;
    return normalized;
  }

  return buildFallbackDisplayName(sub);
};

const normalizeEmail = (payload) => {
  const fromClaim = payload?.['https://yolik.com/email'];
  if (fromClaim && typeof fromClaim === 'string') return fromClaim.trim().toLowerCase();
  if (!payload?.email || typeof payload.email !== 'string') return null;
  return payload.email.trim().toLowerCase();
};

const buildFallbackEmail = (sub) => `auth0-${buildSubjectDigest(sub)}@noemail.local`;

const resolveRole = (roles, permissions) => {
  if (roles.includes('admin')) return 'admin';
  if (permissions.includes('read:dashboard') || permissions.includes('admin:all')) return 'admin';
  return 'user';
};

const upsertUserFromAuth0 = async (payload) => {
  const sub = String(payload.sub);
  const email = normalizeEmail(payload);
  const name = normalizeName(payload, sub);
  const roles = getRoles(payload);
  const permissions = getPermissions(payload);
  const scopedRole = resolveRole(roles, permissions);

  let user = await User.findOne({ auth0Sub: sub });

  if (!user) {
    if (email) {
      const identityConflict = await User.findOne({
        email,
        auth0Sub: { $ne: sub }
      }).lean();

      if (identityConflict) {
        const conflictError = new Error(
          'El correo ya existe en otra identidad. Requiere vinculación manual.'
        );
        conflictError.status = 409;
        conflictError.code = 'AUTH_IDENTITY_CONFLICT';
        throw conflictError;
      }
    }

    user = await User.create({
      authProvider: 'auth0',
      auth0Sub: sub,
      name,
      email: email || buildFallbackEmail(sub),
      emailVerified: Boolean(payload.email_verified),
      role: scopedRole
    });
  } else {
    const updates = {};

    if (!user.auth0Sub) {
      updates.auth0Sub = sub;
    }

    if (email && payload.email_verified === true && user.email !== email) {
      updates.email = email;
    }

    if (name && user.name !== name) {
      updates.name = name;
    }

    if (typeof payload.email_verified === 'boolean' && user.emailVerified !== payload.email_verified) {
      updates.emailVerified = payload.email_verified;
    }

    const nextRole = resolveRole(roles, permissions);
    if (user.role !== nextRole) {
      updates.role = nextRole;
    }

    if (user.authProvider !== 'auth0') {
      updates.authProvider = 'auth0';
    }

    if (Object.keys(updates).length > 0) {
      user = await User.findByIdAndUpdate(user._id, { $set: updates }, { new: true });
    }
  }

  if (!user.isActive) {
    const error = new Error('Cuenta deshabilitada');
    error.status = 403;
    error.code = 'ACCOUNT_DISABLED';
    throw error;
  }

  return {
    user,
    roles,
    permissions,
    scopes: getScopes(payload)
  };
};

module.exports = (req, res, next) => {
  if (!tokenVerifier) {
    return res.status(500).json({
      message: 'Auth0 no está configurado correctamente',
      code: 'AUTH0_MISCONFIGURATION'
    });
  }

  tokenVerifier(req, res, async (authError) => {
    if (authError) {
      return next(authError);
    }

    try {
      const payload = req.auth?.payload || {};
      if (!payload?.sub) {
        return res.status(401).json({
          message: 'Token inválido',
          code: 'INVALID_TOKEN'
        });
      }

      const { user, roles, permissions, scopes } = await upsertUserFromAuth0(payload);

      // ✅ CORREGIDO: se agrega email a req.user para que payment.controller
      // lo pueda pasar a createPaymentIntent y se guarde en la orden
      req.user = {
        id: String(user._id),
        auth0Sub: String(payload.sub),
        name: user.name,
        email: user.email,        // ← esto es lo que faltaba
        username: user.name,
        role: resolveRole(roles, permissions),
        roles,
        permissions,
        scopes
      };

      return next();
    } catch (error) {
      return next(error);
    }
  });
};