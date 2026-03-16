const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const paymentsEnabled = process.env.ENABLE_PAYMENTS === 'true';

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
  allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Idempotency-Key'],
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// ⚠️ El webhook de Stripe necesita el body como raw Buffer.
// DEBE ir antes de express.json() — si json() lo parsea primero, la firma falla.
if (paymentsEnabled) {
  app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
}

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

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// LIMITADOR GENERAL
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas peticiones. Inténtalo de nuevo en 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false
});

// LIMITADOR PARA API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Límite de API alcanzado. Espera 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false
});

// LIMITADOR PARA DASHBOARD/ADMIN
const dashboardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Demasiadas peticiones al dashboard. Espera 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false
});

// LIMITADOR PARA PAGOS
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Límite de peticiones de pago alcanzado. Espera 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(generalLimiter);

app.use('/api/auth',      require('./routes/auth.routes'));
app.use('/api/products',  apiLimiter,       require('./routes/product.routes'));
app.use('/api/cart',      apiLimiter,       require('./routes/cart.routes'));
app.use('/api/orders',                      require('./routes/order.routes'));
app.use('/api/dashboard', dashboardLimiter, require('./routes/dashboard.routes'));

if (paymentsEnabled) {
  app.use('/api/payments', paymentLimiter, require('./routes/payment.routes'));
}

app.use(require('./middlewares/error.middleware'));

module.exports = app;