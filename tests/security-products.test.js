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
    name: 'Accesorio Seguro',
    description: 'Accesorio de prueba para validar sanitización de filtros en API pública.',
    region: 'Tehuacan',
    category: 'Accesorios',
    price: 150,
    stock: 5,
    active: true,
    images: ['https://example.com/secure-product.jpg']
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
});

test('rechaza inyección por query operator en category', async () => {
  const res = await fetch(`${baseUrl}/api/products?category[$ne]=Blusas`);
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.code, 'INVALID_QUERY_PARAMS');
});

test('rechaza id inválido de producto con 400 controlado', async () => {
  const res = await fetch(`${baseUrl}/api/products/123`);
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.code, 'INVALID_ID');
});
