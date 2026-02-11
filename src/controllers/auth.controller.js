const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const RefreshToken = require('../models/RefreshToken.model');
const { addTokenToBlacklist } = require('../utils/tokenBlacklist');

const bcryptRoundsFromEnv = Number.parseInt(process.env.BCRYPT_ROUNDS, 10);
const BCRYPT_ROUNDS =
  Number.isInteger(bcryptRoundsFromEnv) &&
  bcryptRoundsFromEnv >= 10 &&
  bcryptRoundsFromEnv <= 14
    ? bcryptRoundsFromEnv
    : 12;

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '8h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const createAccessToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
      typ: 'access'
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );

const createRefreshToken = ({ userId, tokenId, familyId }) =>
  jwt.sign(
    {
      id: String(userId),
      tid: tokenId,
      fid: familyId,
      typ: 'refresh'
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

const decodeTokenExpiry = (token) => {
  const decoded = jwt.decode(token);
  if (!decoded?.exp) {
    const fallback = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return fallback;
  }
  return new Date(decoded.exp * 1000);
};

const storeRefreshToken = async ({
  token,
  userId,
  tokenId,
  familyId,
  parentTokenHash = null,
  req
}) => {
  const tokenHash = hashToken(token);
  const expiresAt = decodeTokenExpiry(token);

  await RefreshToken.create({
    userId,
    tokenHash,
    tokenId,
    familyId,
    parentTokenHash,
    expiresAt,
    createdByIp: req?.ip || null,
    userAgent: req?.get('User-Agent') || null
  });

  return tokenHash;
};

const revokeTokenFamily = async (familyId, reason = 'REUSE_DETECTED') => {
  if (!familyId) return;
  await RefreshToken.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokeReason: reason } }
  );
};

const revokeUserRefreshTokens = async (userId, reason = 'LOGOUT_ALL') => {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokeReason: reason } }
  );
};

exports.register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        message: 'El email ya está registrado',
        code: 'EMAIL_EXISTS'
      });
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await User.create({
      email,
      name,
      passwordHash: hash
    });

    return res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    return next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({
        message: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: 'Cuenta deshabilitada',
        code: 'ACCOUNT_DISABLED'
      });
    }

    if (user.isLocked) {
      return res.status(403).json({
        message: 'Cuenta bloqueada temporalmente. Intenta más tarde.',
        code: 'ACCOUNT_LOCKED'
      });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      user.loginAttempts += 1;

      if (user.loginAttempts >= 3) {
        user.lockUntil = new Date(Date.now() + 10 * 60 * 1000);
      }

      await user.save();

      return res.status(401).json({
        message: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }

    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    await user.save();

    const accessToken = createAccessToken(user);
    const familyId = crypto.randomUUID();
    const tokenId = crypto.randomUUID();
    const refreshToken = createRefreshToken({
      userId: user._id,
      tokenId,
      familyId
    });

    await storeRefreshToken({
      token: refreshToken,
      userId: user._id,
      tokenId,
      familyId,
      req
    });

    return res.json({
      message: 'Login exitoso',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    return next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const refreshToken = req.body?.refreshToken;
    const logoutAll = req.body?.logoutAll === true;

    if (accessToken) {
      const decoded = jwt.decode(accessToken);
      const expiresAt = decoded?.exp ? decoded.exp * 1000 : undefined;
      addTokenToBlacklist(accessToken, expiresAt);
    }

    if (logoutAll) {
      await revokeUserRefreshTokens(req.user.id, 'LOGOUT_ALL');
    } else if (refreshToken) {
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      if (decoded?.id && String(decoded.id) === String(req.user.id)) {
        await RefreshToken.findOneAndUpdate(
          { tokenHash: hashToken(refreshToken), userId: req.user.id, revokedAt: null },
          { $set: { revokedAt: new Date(), revokeReason: 'LOGOUT' } }
        );
      }
    }

    return res.json({ message: 'Sesión cerrada correctamente' });
  } catch (error) {
    return next(error);
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        message: 'Refresh token requerido'
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    if (!decoded?.id || decoded.typ !== 'refresh' || !decoded.tid || !decoded.fid) {
      return res.status(401).json({
        message: 'Token de refresco inválido',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    const currentTokenHash = hashToken(refreshToken);
    const storedToken = await RefreshToken.findOne({
      tokenHash: currentTokenHash,
      userId: decoded.id
    });

    if (!storedToken) {
      await revokeTokenFamily(decoded.fid, 'REUSE_DETECTED');
      return res.status(401).json({
        message: 'Token de refresco inválido',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    if (storedToken.revokedAt) {
      await revokeTokenFamily(storedToken.familyId, 'REUSE_DETECTED');
      return res.status(401).json({
        message: 'Refresh token reutilizado. Se cerraron las sesiones por seguridad.',
        code: 'REFRESH_TOKEN_REUSE_DETECTED'
      });
    }

    if (storedToken.expiresAt <= new Date()) {
      return res.status(401).json({
        message: 'Refresh token expirado',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        message: 'Usuario no encontrado'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: 'Cuenta deshabilitada',
        code: 'ACCOUNT_DISABLED'
      });
    }

    const newTokenId = crypto.randomUUID();
    const newRefreshToken = createRefreshToken({
      userId: user._id,
      tokenId: newTokenId,
      familyId: storedToken.familyId
    });
    const newTokenHash = hashToken(newRefreshToken);

    const revoked = await RefreshToken.findOneAndUpdate(
      { _id: storedToken._id, revokedAt: null },
      {
        $set: {
          revokedAt: new Date(),
          revokeReason: 'ROTATED',
          replacedByTokenHash: newTokenHash,
          lastUsedAt: new Date()
        }
      },
      { new: true }
    );

    if (!revoked) {
      await revokeTokenFamily(storedToken.familyId, 'REUSE_DETECTED');
      return res.status(401).json({
        message: 'Refresh token reutilizado. Se cerraron las sesiones por seguridad.',
        code: 'REFRESH_TOKEN_REUSE_DETECTED'
      });
    }

    await storeRefreshToken({
      token: newRefreshToken,
      userId: user._id,
      tokenId: newTokenId,
      familyId: storedToken.familyId,
      parentTokenHash: storedToken.tokenHash,
      req
    });

    const newAccessToken = createAccessToken(user);

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    return res.status(401).json({
      message: 'Token de refresco inválido',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
};
