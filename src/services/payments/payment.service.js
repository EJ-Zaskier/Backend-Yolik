const Stripe = require('stripe');
const mongoose = require('mongoose');
const Order = require('../../models/Order.model');
const Product = require('../../models/Product.model');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Descuenta stock de cada producto atómicamente dentro de una sesión de Mongo.
 * - Usa findOneAndUpdate con $gte en stock para garantizar atomicidad.
 * - Si dos usuarios compran el último item al mismo tiempo, solo uno gana.
 * - Lee precio e imagen de la BD — nunca del frontend (seguridad).
 */
async function reservarStock(items, session) {
  const enrichedItems = [];

  for (const item of items) {
    const updated = await Product.findOneAndUpdate(
      {
        _id:    item.productId,
        active: true,
        stock:  { $gte: item.quantity }   // condición atómica — garantiza stock suficiente
      },
      { $inc: { stock: -item.quantity } },
      { new: true, session }
    );

    if (!updated) {
      const exists = await Product.findById(item.productId)
        .select('name active stock')
        .session(session)
        .lean();

      const err = new Error(
        !exists || !exists.active
          ? `Producto no disponible: ${item.productId}`
          : `Stock insuficiente para "${exists.name}" (disponible: ${exists.stock}, pedido: ${item.quantity})`
      );
      err.code   = !exists || !exists.active ? 'PRODUCT_NOT_AVAILABLE' : 'INSUFFICIENT_STOCK';
      err.status = 409;
      throw err;
    }

    enrichedItems.push({
      productId: updated._id,
      name:      updated.name,
      image:     updated.images?.[0] ?? '',
      price:     updated.price,
      quantity:  item.quantity,
    });
  }

  return enrichedItems;
}

/**
 * Devuelve el stock de los items de una orden.
 * Se llama cuando el pago falla (webhook payment_intent.payment_failed).
 */
async function liberarStock(items) {
  await Promise.all(
    items.map(item =>
      Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      })
    )
  );
}

/**
 * Crea un PaymentIntent en Stripe y guarda el pedido en MongoDB con status 'pending'.
 *
 * Flujo:
 *   1. Reservar stock atómicamente en Mongo (si falla -> 409, Stripe nunca se llama)
 *   2. Crear PaymentIntent en Stripe
 *   3. Guardar orden en Mongo dentro de la misma transacción
 *
 * Si el paso 3 falla (error de BD después de crear el intent),
 * se cancela el PaymentIntent en Stripe y se devuelve el stock.
 */
async function createPaymentIntent({ items, shippingAddress, subtotal, shippingCost, discount, userId, userEmail }) {
  const total         = subtotal + shippingCost - discount;
  const amountInCents = Math.round(total * 100);

  const session = await mongoose.startSession();
  let paymentIntent = null;

  try {
    await session.withTransaction(async () => {
      // 1. Descontar stock — si no hay stock suficiente lanza excepción aquí
      //    y la transacción se aborta antes de llamar a Stripe
      const enrichedItems = await reservarStock(items, session);

      // 2. Crear el PaymentIntent en Stripe ya confirmado que hay stock
      paymentIntent = await stripe.paymentIntents.create({
        amount:   amountInCents,
        currency: 'mxn',
        metadata:     { userId, userEmail },
      });

      // 3. Guardar la orden en Mongo — si esto falla, withTransaction hace rollback
      //    del stock Y el catch externo cancela el PaymentIntent en Stripe
      await Order.create(
        [{
          userId,
          userEmail,
          items: enrichedItems,
          shippingAddress,
          subtotal,
          shippingCost,
          discount,
          total,
          stripePaymentIntentId: paymentIntent.id,
          paymentStatus: 'pending',
          status:        'Procesando',
        }],
        { session }
      );
    });

  } catch (err) {
    // Si ya se creó el PaymentIntent pero falló guardar la orden en Mongo,
    // cancelar el intent en Stripe para no dejar cargos huérfanos
    if (paymentIntent?.id) {
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id);
      } catch (stripeErr) {
        console.error('No se pudo cancelar el PaymentIntent huérfano:', paymentIntent.id, stripeErr.message);
      }
    }
    throw err;

  } finally {
    await session.endSession();
  }

  return {
    clientSecret:    paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  };
}

/**
 * Webhook de Stripe.
 *
 * payment_intent.succeeded   -> solo marca paymentStatus: 'paid'
 *                               el stock YA se descontó al crear el intent
 *
 * payment_intent.payment_failed -> marca paymentStatus: 'failed'
 *                                  y devuelve el stock reservado
 */
async function handleWebhook(rawBody, signature) {
  let event;

  try {
    if (process.env.NODE_ENV === 'production') {
      event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      const body = Buffer.isBuffer(rawBody) ? rawBody.toString() : rawBody;
      event = typeof body === 'string' ? JSON.parse(body) : body;
    }
  } catch (err) {
    throw new Error(`Webhook error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    await Order.findOneAndUpdate(
      { stripePaymentIntentId: pi.id },
      { paymentStatus: 'paid', status: 'Procesando' }
    );
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi    = event.data.object;
    const order = await Order.findOneAndUpdate(
      { stripePaymentIntentId: pi.id },
      { paymentStatus: 'failed' }
    ).lean();

    if (order?.items?.length) {
      await liberarStock(order.items);
    }
  }

  // Usuario abandonó el pago o Stripe canceló el intent por timeout (cancel_after)
  if (event.type === 'payment_intent.canceled') {
    const pi    = event.data.object;
    const order = await Order.findOneAndUpdate(
      { stripePaymentIntentId: pi.id },
      { paymentStatus: 'failed' }
    ).lean();

    if (order?.items?.length) {
      await liberarStock(order.items);
    }
  }

  return { received: true };
}

module.exports = { createPaymentIntent, handleWebhook };