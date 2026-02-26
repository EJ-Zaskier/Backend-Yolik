const assert = require('node:assert/strict');
const { before, after, beforeEach, test } = require('node:test');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const paymentController = require('../src/controllers/payment.controller');
const Order = require('../src/models/Order.model');
const Product = require('../src/models/Product.model');
const User = require('../src/models/User.model');
const Payment = require('../src/models/Payment.model');

let memoryServer;

const createMockResponse = () => {
  const res = {
    statusCode: 200,
    body: null
  };

  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  res.json = (payload) => {
    res.body = payload;
    return res;
  };

  return res;
};

const executeController = async (handler, req) => {
  const res = createMockResponse();
  let nextError = null;

  await handler(req, res, (error) => {
    nextError = error;
  });

  return { res, nextError };
};

const seedOrder = async () => {
  const user = await User.create({
    authProvider: 'auth0',
    auth0Sub: 'auth0|payment-user',
    name: 'Cliente Pago',
    email: 'pago-user@test.com',
    role: 'user'
  });

  const product = await Product.create({
    name: 'Vestido Bordado',
    description: 'Vestido bordado artesanal de uso tradicional regional.',
    region: 'Tehuacan',
    category: 'Vestidos',
    price: 1200,
    stock: 5,
    active: true,
    images: ['https://example.com/vestido-bordado.jpg']
  });

  const order = await Order.create({
    orderNumber: `ORD-PAY-${Date.now()}`,
    userId: user._id,
    items: [
      {
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: 1,
        subtotal: 1200
      }
    ],
    total: 1200,
    status: 'pending',
    paymentStatus: 'unpaid'
  });

  return { user, order };
};

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri(), { dbName: 'payment_controller_test' });
});

beforeEach(async () => {
  process.env.PAYMENT_PROVIDER = '';
  await Promise.all([
    Payment.deleteMany({}),
    Order.deleteMany({}),
    Product.deleteMany({}),
    User.deleteMany({})
  ]);
});

after(async () => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
});

test('createPaymentIntent falla si falta Idempotency-Key', async () => {
  const { user, order } = await seedOrder();

  const { res, nextError } = await executeController(paymentController.createPaymentIntent, {
    body: {
      orderId: String(order._id)
    },
    user: {
      id: String(user._id),
      role: 'user'
    },
    get: () => undefined
  });

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'IDEMPOTENCY_KEY_REQUIRED');
});

test('createPaymentIntent responde 503 si no hay proveedor configurado', async () => {
  const { user, order } = await seedOrder();

  const { res, nextError } = await executeController(paymentController.createPaymentIntent, {
    body: {
      orderId: String(order._id)
    },
    user: {
      id: String(user._id),
      role: 'user'
    },
    get: (header) => (header === 'Idempotency-Key' ? 'idem-123' : undefined)
  });

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'PAYMENT_PROVIDER_NOT_CONFIGURED');
});
