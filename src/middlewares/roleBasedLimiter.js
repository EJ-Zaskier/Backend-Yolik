const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

const createRoleLimiter = (role, maxRequests) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: maxRequests,
    keyGenerator: (req) => {
      // Asume que el usuario está en req.user después de autenticación
      return req.user ? `${req.user.id}:${req.user.role}` : ipKeyGenerator(req.ip || '');
    },
    skip: (req) => {
      // Solo aplicar si el usuario tiene el rol correcto
      return !req.user || req.user.role !== role;
    },
    message: `Límite de peticiones para ${role} alcanzado`
  });
};

// Uso:
const adminLimiter = createRoleLimiter('admin', 1000);
const userLimiter = createRoleLimiter('user', 100);
const guestLimiter = createRoleLimiter('guest', 10);

module.exports = { adminLimiter, userLimiter, guestLimiter };
