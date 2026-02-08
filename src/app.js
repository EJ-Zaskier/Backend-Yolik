const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(cors());
app.use(express.json());

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