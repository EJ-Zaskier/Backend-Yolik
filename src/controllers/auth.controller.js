exports.getCurrentSession = async (req, res) => {
  return res.json({
    message: 'Sesion valida',
    user: {
      id: req.user.id,
      auth0Sub: req.user.auth0Sub,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      roles: req.user.roles,
      permissions: req.user.permissions,
      scopes: req.user.scopes
    }
  });
};

exports.getAuthorizationContext = async (req, res) => {
  return res.json({
    role: req.user.role,
    roles: req.user.roles,
    permissions: req.user.permissions,
    scopes: req.user.scopes
  });
};
