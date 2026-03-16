const { createPaymentIntent, handleWebhook } = require('../services/payments/payment.service');

/**
 * POST /api/payments/create-intent
 * Requiere authMiddleware antes de este controller.
 * auth.middleware construye req.user = { id: String(user._id), ... }
 * Usamos req.user.id para que coincida con getMyOrders({ userId: req.user.id })
 */
async function createIntent(req, res) {
  try {
    const { items, shippingAddress, subtotal, shippingCost, discount } = req.body;

    const userId    = req.user?.id;
    const userEmail = req.user?.email ?? req.auth?.payload?.email ?? '';

    if (!userId) {
      return res.status(401).json({ error: 'Usuario no identificado' });
    }

    if (!items?.length || !shippingAddress || subtotal == null) {
      return res.status(400).json({ error: 'Faltan datos del pedido' });
    }

    const result = await createPaymentIntent({
      items,
      shippingAddress,
      subtotal,
      shippingCost: shippingCost ?? 0,
      discount:     discount ?? 0,
      userId,
      userEmail,
    });

    res.json(result);
  } catch (err) {
    console.error('Error creando PaymentIntent:', err);
    res.status(500).json({ error: 'No se pudo iniciar el pago' });
  }
}

/**
 * POST /api/payments/webhook
 * Stripe llama a este endpoint — NO debe tener authMiddleware.
 */
async function webhook(req, res) {
  const signature = req.headers['stripe-signature'];

  try {
    const result = await handleWebhook(req.body, signature);
    res.json(result);
  } catch (err) {
    console.error('Error en webhook:', err.message);
    res.status(400).json({ error: err.message });
  }
}

module.exports = { createIntent, webhook };