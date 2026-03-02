const assert = require('node:assert/strict');
const { before, after, beforeEach, test } = require('node:test');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const productController = require('../src/controllers/product.controller');
const Product = require('../src/models/Product.model');
const User = require('../src/models/User.model');

let memoryServer;
let adminUser;

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

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri(), { dbName: 'dashboard_products_test' });
});

beforeEach(async () => {
  await Promise.all([Product.deleteMany({}), User.deleteMany({})]);
  adminUser = await User.create({
    authProvider: 'auth0',
    auth0Sub: `auth0|admin-${Date.now()}`,
    name: 'Admin Productos',
    email: `admin-${Date.now()}@test.com`,
    role: 'admin'
  });
});

after(async () => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
});

test('createProduct crea producto válido para dashboard admin', async () => {
  const payload = {
    name: 'Vestido Premium',
    description: 'Vestido artesanal de edición especial para validación de dashboard admin.',
    region: 'Tehuacan',
    category: 'Vestidos',
    price: 1499.99,
    originalPrice: 1799.99,
    stock: 8,
    images: ['https://example.com/vestido-premium.jpg']
  };

  const { res, nextError } = await executeController(productController.createProduct, {
    body: payload,
    user: { id: String(adminUser._id) }
  });

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.product.name, payload.name);
  assert.equal(String(res.body.product.createdBy), String(adminUser._id));
  assert.equal(res.body.product.pricing.discountPercent, 17);
});

test('updateProduct valida relación price/originalPrice', async () => {
  const product = await Product.create({
    name: 'Blusa Actualizable',
    description: 'Blusa de prueba para validar edición de precios en dashboard admin.',
    region: 'Tehuacan',
    category: 'Blusas',
    price: 600,
    originalPrice: 750,
    stock: 5,
    active: true,
    images: ['https://example.com/blusa-update.jpg']
  });

  const { res, nextError } = await executeController(productController.updateProduct, {
    params: { id: String(product._id) },
    body: {
      price: 900,
      originalPrice: 800
    }
  });

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'INVALID_PRICE_RELATION');
});

test('deleteProduct hace baja lógica y restoreProduct reactiva', async () => {
  const product = await Product.create({
    name: 'Accesorio Soft Delete',
    description: 'Producto para validar desactivación y restauración en dashboard admin.',
    region: 'Tehuacan',
    category: 'Accesorios',
    price: 250,
    stock: 12,
    active: true,
    images: ['https://example.com/accesorio-delete.jpg']
  });

  const deleteResult = await executeController(productController.deleteProduct, {
    params: { id: String(product._id) }
  });

  assert.equal(deleteResult.nextError, null);
  assert.equal(deleteResult.res.statusCode, 200);
  assert.equal(deleteResult.res.body.product.active, false);

  const restoreResult = await executeController(productController.restoreProduct, {
    params: { id: String(product._id) }
  });

  assert.equal(restoreResult.nextError, null);
  assert.equal(restoreResult.res.statusCode, 200);
  assert.equal(restoreResult.res.body.product.active, true);
});
