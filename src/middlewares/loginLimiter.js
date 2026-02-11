const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

const createRedisStore = () => {
  if (process.env.ENABLE_REDIS_RATE_LIMIT !== 'true' || !process.env.REDIS_URL) {
    return undefined;
  }

  try {
    const RedisStore = require('rate-limit-redis');
    const Redis = require('ioredis');
    const redisClient = new Redis(process.env.REDIS_URL);

    return new RedisStore({
      sendCommand: (...args) => redisClient.call(...args)
    });
  } catch (error) {
    console.warn('[SECURITY] Redis rate limiter deshabilitado:', error.message);
    return undefined;
  }
};

const store = createRedisStore();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 3,
  message: {
    error: 'Demasiados intentos de inicio de sesión. Espera 10 minutos',
    code: 'TOO_MANY_LOGIN_ATTEMPTS'
  },
  ...(store ? { store } : {}),
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = req.body?.email ? String(req.body.email).toLowerCase() : 'unknown';
    const ip = ipKeyGenerator(req.ip || '');
    return `${email}:${ip}`;
  },
  handler: (req, res, next, options) => {
    console.warn('[SECURITY] Too many login attempts:', {
      ip: req.ip,
      email: req.body?.email,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent')
    });

    res.status(429).json(options.message);
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = loginLimiter;
