const express = require('express');
const paymentController = require('../controllers/payment.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requirePermissions } = require('../middlewares/role.middleware');
const { validatePaymentIntent } = require('../middlewares/validation.middleware');

const router = express.Router();

router.use(authMiddleware);
router.get('/config', paymentController.getPaymentSetup);
router.post(
  '/intents',
  requirePermissions(['create:payments']),
  validatePaymentIntent,
  paymentController.createPaymentIntent
);

module.exports = router;
