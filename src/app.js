const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : 0);

const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) {
      if (process.env.NODE_ENV === 'production') {
        return callback(new Error('CORS_ORIGIN_NOT_CONFIGURED'));
      }
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// LIMITADOR GENERAL (para rutas sin protección específica)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: {
    error: "Demasiadas peticiones. Inténtalo de nuevo en 15 minutos"
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // NO aplicar a rutas que ya tienen su propio limitador
    return req.path.startsWith('/api/auth/login');
  }
});

//LIMITADOR PARA ENDPOINTS PÚBLICOS (más restrictivo)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // Más bajo que el general
  message: {
    error: "Límite de peticiones alcanzado. Inténtalo más tarde"
  },
  standardHeaders: true,
  legacyHeaders: false
});

// LIMITADOR PARA API (más generoso para usuarios autenticados)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    error: "Límite de API alcanzado. Espera 15 minutos"
  },
  standardHeaders: true,
  legacyHeaders: false
});

// LIMITADOR PARA DASHBOARD/ADMIN (si es pesado)
const dashboardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, 
  message: {
    error: "Demasiadas peticiones al dashboard. Espera 15 minutos"
  },
  standardHeaders: true,
  legacyHeaders: false
});

// limitador general por defecto
app.use(generalLimiter);

// Rutas específicas con sus propios limitadores
app.use('/api/auth', require('./routes/auth.routes')); 


// Productos: más permisivo
app.use('/api/products', apiLimiter, require('./routes/product.routes'));

// Órdenes: más restrictivo (operaciones sensibles)
app.use('/api/orders', require('./routes/order.routes')); // Usa generalLimiter

// Dashboard: limitador específico para operaciones pesadas
app.use('/api/dashboard', dashboardLimiter, require('./routes/dashboard.routes'));

// Rutas PÚBLICAS (si pro si se implementa ej: landing page, contacto)
// app.use('/api/public', publicLimiter, require('./routes/public.routes'));

app.use(require('./middlewares/error.middleware'));

module.exports = app;
