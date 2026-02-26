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

const createTestUser = async (email) =>
  User.create({
    name: 'Cliente Test',
    email,
    passwordHash: 'x'.repeat(60)
  });

const createTestProduct = async (overrides = {}) =>
  Product.create({
    name: 'Blusa Artesanal',
    description: 'Blusa bordada de algodón elaborada por artesanas de la región.',
    region: 'Tehuacan',
    category: 'Blusas',
    price: 650,
    stock: 1,
    active: true,
    images: ['https://example.com/blusa.jpg'],
    ...overrides
  });

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });

  await mongoose.connect(replSet.getUri(), { dbName: 'yolik_test' });
});

beforeEach(async () => {
  await Promise.all([
    Order.deleteMany({}),
    Product.deleteMany({}),
    User.deleteMany({})
  ]);
});

after(async () => {
  await mongoose.disconnect();
  if (replSet) {
    await replSet.stop();
  }
});

test('evita sobreventa cuando dos clientes compran al mismo tiempo con stock unico', async () => {
  const [userA, userB] = await Promise.all([
    createTestUser('cliente-a@test.com'),
    createTestUser('cliente-b@test.com')
  ]);
  const product = await createTestProduct({ stock: 1 });

  const orderBody = {
    items: [{ productId: String(product._id), quantity: 1 }],
    tax: 0,
    shippingCost: 0
  };

  const [resultA, resultB] = await Promise.all([
    executeCreateOrder({ body: orderBody, user: { id: userA._id, role: 'user' } }),
    executeCreateOrder({ body: orderBody, user: { id: userB._id, role: 'user' } })
  ]);

  assert.equal(resultA.nextError, null);
  assert.equal(resultB.nextError, null);

  const sortedStatuses = [resultA.res.statusCode, resultB.res.statusCode].sort();
  assert.deepEqual(sortedStatuses, [201, 409]);

  const productAfter = await Product.findById(product._id).lean();
  assert.equal(productAfter.stock, 0);

  const orderCount = await Order.countDocuments();
  assert.equal(orderCount, 1);
});

test('rechaza orden cuando la cantidad solicitada supera el stock disponible', async () => {
  const user = await createTestUser('cliente-c@test.com');
  const product = await createTestProduct({ stock: 2 });

  const { res, nextError } = await executeCreateOrder({
    body: {
      items: [{ productId: String(product._id), quantity: 3 }],
      tax: 0,
      shippingCost: 0
    },
    user: { id: user._id, role: 'user' }
  });

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'INSUFFICIENT_STOCK');

  const productAfter = await Product.findById(product._id).lean();
  assert.equal(productAfter.stock, 2);

  const orderCount = await Order.countDocuments();
  assert.equal(orderCount, 0);
});
