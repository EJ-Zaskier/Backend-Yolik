const express = require('express');
const router = express.Router();
const { createIntent, webhook } = require('../controllers/payment.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// ⚠️ El webhook recibe body como raw Buffer.
// En app.js esto debe ir ANTES de express.json():
//   app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
router.post('/webhook', webhook);

// Rutas protegidas con JWT de Auth0
router.post('/create-intent', authMiddleware, createIntent);

module.exports = router;