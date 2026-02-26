const Order = require('../models/Order.model');
const Payment = require('../models/Payment.model');
const {
  SUPPORTED_PROVIDERS,
  getConfiguredProvider,
  createProviderAdapter,
  PaymentProviderNotConfiguredError,
  UnsupportedPaymentProviderError,
  PaymentProviderNotImplementedError
} = require('../services/payments/providerFactory');

const normalizeCurrency = (currencyFromBody) => {
  const source = currencyFromBody || process.env.PAYMENT_CURRENCY || 'MXN';
  return String(source).trim().toUpperCase().slice(0, 3) || 'MXN';
};

const extractIdempotencyKey = (req) => {
  const key = req.get('Idempotency-Key') || req.get('X-Idempotency-Key');
  if (!key || typeof key !== 'string') return null;
  return key.trim().slice(0, 120) || null;
};

exports.getPaymentSetup = async (req, res) => {
  const configuredProvider = getConfiguredProvider();

  return res.json({
    configuredProvider,
    supportedProviders: SUPPORTED_PROVIDERS,
    providerImplemented: false,
    recommendedFlow: [
      'Crear Payment Intent con idempotency key',
      'Confirmar pago en proveedor (checkout/SDK)',
      'Actualizar estado de orden por webhook firmado'
    ]
  });
};

exports.createPaymentIntent = async (req, res, next) => {
  try {
    const { orderId, provider } = req.body;
    const idempotencyKey = extractIdempotencyKey(req);

    if (!orderId) {
      return res.status(400).json({
        message: 'orderId es requerido',
        code: 'ORDER_ID_REQUIRED'
      });
    }

    if (!idempotencyKey) {
      return res.status(400).json({
        message: 'Idempotency-Key es requerido',
        code: 'IDEMPOTENCY_KEY_REQUIRED'
      });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({
        message: 'Orden no encontrada',
        code: 'ORDER_NOT_FOUND'
      });
    }

    const isOwner = String(order.userId) === String(req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: 'Acceso denegado',
        code: 'ACCESS_DENIED'
      });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(409).json({
        message: 'La orden ya fue pagada',
        code: 'ORDER_ALREADY_PAID'
      });
    }

    const existingPayment = await Payment.findOne({
      userId: req.user.id,
      idempotencyKey
    }).lean();

    if (existingPayment) {
      return res.json({
        message: 'Operacion idempotente: intento previo recuperado',
        payment: existingPayment
      });
    }

    const adapter = createProviderAdapter(provider);
    const currency = normalizeCurrency(req.body.currency);

    try {
      const providerResult = await adapter.createPaymentIntent({
        order,
        user: req.user,
        currency,
        idempotencyKey
      });

      const payment = await Payment.create({
        orderId: order._id,
        userId: req.user.id,
        provider: adapter.name,
        providerPaymentId: providerResult.providerPaymentId || null,
        idempotencyKey,
        amount: order.total,
        currency,
        status: providerResult.status || 'pending',
        checkoutUrl: providerResult.checkoutUrl || null,
        metadata: providerResult.metadata || {}
      });

      return res.status(201).json({
        message: 'Intento de pago creado',
        payment
      });
    } catch (error) {
      if (error instanceof PaymentProviderNotImplementedError) {
        return res.status(503).json({
          message: 'Proveedor de pago pendiente de integracion',
          code: error.code,
          provider: adapter.name,
          nextStep: 'Definir SDK oficial del proveedor y webhooks firmados'
        });
      }

      throw error;
    }
  } catch (error) {
    if (
      error instanceof PaymentProviderNotConfiguredError ||
      error instanceof UnsupportedPaymentProviderError
    ) {
      return res.status(error.status).json({
        message: error.message,
        code: error.code,
        supportedProviders: SUPPORTED_PROVIDERS
      });
    }

    return next(error);
  }
};
