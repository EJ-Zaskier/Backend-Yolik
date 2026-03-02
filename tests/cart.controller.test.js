const assert = require('node:assert/strict');
const { before, after, beforeEach, test } = require('node:test');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const cartController = require('../src/controllers/cart.controller');
const Cart = require('../src/models/Cart.model');
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

const seedUserAndProduct = async ({ stock = 3 } = {}) => {
  const user = await User.create({
    authProvider: 'auth0',
    auth0Sub: `auth0|cart-${Date.now()}`,
    name: 'Cliente Carrito',
    email: `cart-${Date.now()}@test.com`,
    role: 'user'
  });

  const product = await Product.create({
    name: 'Blusa Carrito',
    description: 'Producto de prueba para validar el flujo del carrito autenticado.',
    region: 'Tehuacan',
    category: 'Blusas',
    price: 500,
    stock,
    active: true,
    images: ['https://example.com/blusa-carrito.jpg']
  });

  return { user, product };
};

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri(), { dbName: 'cart_controller_test' });
});

beforeEach(async () => {
  await Promise.all([Cart.deleteMany({}), Product.deleteMany({}), User.deleteMany({})]);
});

after(async () => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
});

test('addCartItem agrega producto y getCart devuelve resumen', async () => {
  const { user, product } = await seedUserAndProduct({ stock: 5 });

  const addResult = await executeController(cartController.addCartItem, {
    body: {
      productId: String(product._id),
      quantity: 2
    },
    user: {
      id: String(user._id)
    }
  });

  assert.equal(addResult.nextError, null);
  assert.equal(addResult.res.statusCode, 200);
  assert.equal(addResult.res.body.cart.count, 1);
  assert.equal(addResult.res.body.cart.totalItems, 2);

  const getResult = await executeController(cartController.getCart, {
    user: { id: String(user._id) }
  });

  assert.equal(getResult.nextError, null);
  assert.equal(getResult.res.statusCode, 200);
  assert.equal(getResult.res.body.count, 1);
  assert.equal(getResult.res.body.subtotal, 1000);
});

test('addCartItem rechaza cuando la cantidad supera el stock', async () => {
  const { user, product } = await seedUserAndProduct({ stock: 1 });

  const result = await executeController(cartController.addCartItem, {
    body: {
      productId: String(product._id),
      quantity: 2
    },
    user: {
      id: String(user._id)
    }
  });

  assert.equal(result.nextError, null);
  assert.equal(result.res.statusCode, 409);
  assert.equal(result.res.body.code, 'INSUFFICIENT_STOCK');
});
