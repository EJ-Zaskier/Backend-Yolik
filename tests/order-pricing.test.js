const assert = require('node:assert/strict');
const { before, after, beforeEach, test } = require('node:test');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const orderController = require('../src/controllers/order.controller');
const User = require('../src/models/User.model');
const Product = require('../src/models/Product.model');
const Order = require('../src/models/Order.model');

let replSet;

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

const executeCreateOrder = async ({ body, user }) => {
  const req = {
    body,
    user,
    ip: '127.0.0.1',
    get: () => undefined
  };
  const res = createMockResponse();

  let nextError = null;
  await orderController.createOrder(req, res, (error) => {
    nextError = error;
  });

  return { res, nextError };
};

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });

  await mongoose.connect(replSet.getUri(), { dbName: 'order_pricing_test' });
});

beforeEach(async () => {
  await Promise.all([Order.deleteMany({}), Product.deleteMany({}), User.deleteMany({})]);
});

after(async () => {
  await mongoose.disconnect();
  if (replSet) {
    await replSet.stop();
  }
});

test('createOrder calcula totales y descuento con precisión monetaria', async () => {
  const user = await User.create({
    authProvider: 'auth0',
    auth0Sub: `auth0|pricing-${Date.now()}`,
    name: 'Cliente Pricing',
    email: `pricing-${Date.now()}@test.com`,
    role: 'user'
  });

  const product = await Product.create({
    name: 'Vestido con Descuento',
    description: 'Producto de prueba para validar cálculo monetario y descuentos atómicos.',
    region: 'Tehuacan',
    category: 'Vestidos',
    price: 199.99,
    originalPrice: 249.99,
    stock: 3,
    active: true,
    images: ['https://example.com/vestido-descuento.jpg']
  });

  const result = await executeCreateOrder({
    body: {
      items: [{ productId: String(product._id), quantity: 2 }],
      tax: 16.01,
      shippingCost: 5.05
    },
    user: { id: String(user._id), role: 'user' }
  });

  assert.equal(result.nextError, null);
  assert.equal(result.res.statusCode, 201);
  assert.equal(result.res.body.order.total, 421.04);
  assert.equal(result.res.body.order.items[0].discountPerUnit, 50);
  assert.equal(result.res.body.order.items[0].discountPercent, 20);
});

test('createOrder rechaza producto inactivo con código explícito', async () => {
  const user = await User.create({
    authProvider: 'auth0',
    auth0Sub: `auth0|pricing-inactive-${Date.now()}`,
    name: 'Cliente Inactivo',
    email: `pricing-inactive-${Date.now()}@test.com`,
    role: 'user'
  });

  const product = await Product.create({
    name: 'Producto Inactivo',
    description: 'Producto inactivo para validar control de disponibilidad en compra.',
    region: 'Tehuacan',
    category: 'Accesorios',
    price: 120,
    stock: 10,
    active: false,
    images: ['https://example.com/producto-inactivo.jpg']
  });

  const result = await executeCreateOrder({
    body: {
      items: [{ productId: String(product._id), quantity: 1 }],
      tax: 0,
      shippingCost: 0
    },
    user: { id: String(user._id), role: 'user' }
  });

  assert.equal(result.nextError, null);
  assert.equal(result.res.statusCode, 409);
  assert.equal(result.res.body.code, 'PRODUCT_NOT_AVAILABLE');
});
