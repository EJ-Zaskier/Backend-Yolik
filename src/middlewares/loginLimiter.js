const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis'); // Opcional: para Redis
const Redis = require('ioredis'); // Opcional

// Opcional: Configurar Redis para rate limiting distribuido
// const redisClient = new Redis(process.env.REDIS_URL);

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 3, 
  message: {
    error: "Demasiados intentos de inicio de sesión. Espera 10 minutos",
    code: "TOO_MANY_LOGIN_ATTEMPTS"
  },
  // store: new RedisStore({  // Descomentar para producción con múltiples servidores
  //   sendCommand: (...args) => redisClient.call(...args),
  // }),

  skipSuccessfulRequests: true, //Solo contar intentos fallidos
  keyGenerator: (req) => {
    // Combinar IP + email para prevenir ataques dirigidos
    const email = req.body.email ? req.body.email.toLowerCase() : 'unknown';
    return `${email}:${req.ip}`;
  },
  handler: (req, res, next, options) => {
    // Log para auditoría de seguridad
    console.warn(`[SECURITY] Too many login attempts:`, {
      ip: req.ip,
      email: req.body.email,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json(options.message);
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = loginLimiter;