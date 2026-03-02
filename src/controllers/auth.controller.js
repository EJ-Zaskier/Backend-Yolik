exports.getCurrentSession = async (req, res) => {
  return res.json({
    message: 'Sesion valida',
    user: {
      id: req.user.id,
      username: req.user.username || req.user.name,
      name: req.user.username || req.user.name,
      role: req.user.role
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
