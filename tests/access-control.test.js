const assert = require('node:assert/strict');
const { before, after, beforeEach, test } = require('node:test');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let memoryServer;
let app;
let Product;
let server;
let baseUrl;

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = memoryServer.getUri();
  process.env.NODE_ENV = 'test';
  process.env.AUTH0_DOMAIN = 'dev-e2c3vkx36p7pn2fl.us.auth0.com';
  process.env.AUTH0_API_AUDIENCE = 'https://api.yolik.local';
  process.env.ENABLE_PAYMENTS = 'false';

  const connectDB = require('../src/config/database');
  app = require('../src/app');
  Product = require('../src/models/Product.model');

  await connectDB();
  server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await Product.deleteMany({});
  await Product.create({
    name: 'Vestido Público',
    description: 'Vestido tradicional para validar acceso público al catálogo.',
    region: 'Tehuacan',
    category: 'Vestidos',
    price: 700,
    stock: 10,
    active: true,
    images: ['https://example.com/vestido-publico.jpg']
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
});

test('permite consultar productos sin autenticacion', async () => {
  const res = await fetch(`${baseUrl}/api/products`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.count, 1);
});

test('bloquea crear orden sin autenticacion', async () => {
  const product = await Product.findOne({}).lean();

  const res = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: String(product._id), quantity: 1 }]
    })
  });
  const body = await res.json();

  assert.equal(res.status, 401);
  assert.equal(body.code, 'AUTH_UNAUTHORIZED');
});

test('bloquea agregar al carrito sin autenticacion', async () => {
  const product = await Product.findOne({}).lean();

  const res = await fetch(`${baseUrl}/api/cart/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      productId: String(product._id),
      quantity: 1
    })
  });
  const body = await res.json();

  assert.equal(res.status, 401);
  assert.equal(body.code, 'AUTH_UNAUTHORIZED');
});
