const assert = require('node:assert/strict');
const { test } = require('node:test');

const authController = require('../src/controllers/auth.controller');

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

test('getCurrentSession no expone email ni auth0Sub', async () => {
  const req = {
    user: {
      id: '507f191e810c19729de860ea',
      username: 'cliente_demo',
      role: 'user',
      email: 'private@example.com',
      auth0Sub: 'auth0|abc123'
    }
  };
  const res = createMockResponse();

  await authController.getCurrentSession(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    message: 'Sesion valida',
    user: {
      id: '507f191e810c19729de860ea',
      username: 'cliente_demo',
      name: 'cliente_demo',
      role: 'user'
    }
  });
});

test('getAuthorizationContext mantiene contexto de permisos y roles', async () => {
  const req = {
    user: {
      role: 'admin',
      roles: ['admin'],
      permissions: ['read:dashboard'],
      scopes: ['read:dashboard']
    }
  };
  const res = createMockResponse();

  await authController.getAuthorizationContext(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    role: 'admin',
    roles: ['admin'],
    permissions: ['read:dashboard'],
    scopes: ['read:dashboard']
  });
});
