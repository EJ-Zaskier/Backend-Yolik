const assert = require('node:assert/strict');
const { before, after, beforeEach, test } = require('node:test');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const dashboardController = require('../src/controllers/dashboard.controller');
const Order = require('../src/models/Order.model');
const Product = require('../src/models/Product.model');
const User = require('../src/models/User.model');

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

const createSeedData = async () => {
  const user = await User.create({
    authProvider: 'auth0',
    auth0Sub: 'auth0|dashboard-admin',
    name: 'Admin Dashboard',
    email: 'dashboard-admin@test.com',
    role: 'admin'
  });

  const product = await Product.create({
    name: 'Blusa Tradicional',
    description: 'Blusa artesanal de algodón con bordado típico de la región.',
    region: 'Tehuacan',
    category: 'Blusas',
    price: 650,
    stock: 2,
    active: true,
    images: ['https://example.com/blusa.jpg']
  });

  await Order.create({
    orderNumber: `ORD-TEST-${Date.now()}`,
    userId: user._id,
    items: [
      {
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: 2,
        subtotal: 1300
      }
    ],
    total: 1300,
    status: 'confirmed',
    paymentStatus: 'paid'
  });
};

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri(), { dbName: 'dashboard_controller_test' });
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
  if (memoryServer) {
    await memoryServer.stop();
  }
});

test('getSummary devuelve métricas y top productos', async () => {
  await createSeedData();

  const { res, nextError } = await executeController(dashboardController.getSummary, {
    query: { days: '30' }
  });

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.metrics.orders, 1);
  assert.equal(res.body.metrics.grossRevenue, 1300);
  assert.equal(res.body.metrics.paidRevenue, 1300);
  assert.equal(res.body.topProducts.length, 1);
});

test('getInventoryAlerts filtra por threshold', async () => {
  await createSeedData();

  const { res, nextError } = await executeController(dashboardController.getInventoryAlerts, {
    query: { threshold: '3' }
  });

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.products[0].stock, 2);
});
