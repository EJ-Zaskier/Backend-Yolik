const getAuthCollections = (req) => {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
  const scopes = Array.isArray(req.user?.scopes) ? req.user.scopes : [];
  return { roles, permissions, scopes };
};

const hasPermission = (req, permission) => {
  const { permissions, scopes } = getAuthCollections(req);
  return permissions.includes(permission) || scopes.includes(permission);
};

const requireRole = (role) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: 'No autorizado',
      code: 'NO_AUTH_CONTEXT'
    });
  }

  const { roles } = getAuthCollections(req);

  if (req.user.role === role || roles.includes(role)) {
    return next();
  }

  return res.status(403).json({
    message: 'Acceso denegado',
    code: 'FORBIDDEN_ROLE'
  });
};

const requirePermissions = (requiredPermissions = []) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: 'No autorizado',
      code: 'NO_AUTH_CONTEXT'
    });
  }

  if (!Array.isArray(requiredPermissions) || requiredPermissions.length === 0) {
    return next();
  }

  if (req.user.role === 'admin') {
    return next();
  }

  const missingPermissions = requiredPermissions.filter((permission) => !hasPermission(req, permission));
  if (missingPermissions.length === 0) {
    return next();
  }

  return res.status(403).json({
    message: 'Permisos insuficientes',
    code: 'INSUFFICIENT_PERMISSIONS',
    requiredPermissions
  });
};

module.exports = {
  requireRole,
  requirePermissions,
  hasPermission
};
