const assert = require('node:assert/strict');
const { test } = require('node:test');

const { requirePermissions } = require('../src/middlewares/role.middleware');

const createRes = () => {
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

test('requirePermissions permite a admin aunque no tenga permiso explícito', () => {
  const req = {
    user: {
      role: 'admin',
      permissions: [],
      scopes: []
    }
  };
  const res = createRes();
  let nextCalled = false;

  requirePermissions(['read:dashboard'])(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('requirePermissions permite acceso cuando el permiso viene en permissions', () => {
  const req = {
    user: {
      role: 'user',
      permissions: ['read:dashboard'],
      scopes: []
    }
  };
  const res = createRes();
  let nextCalled = false;

  requirePermissions(['read:dashboard'])(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('requirePermissions permite acceso cuando el permiso viene en scopes', () => {
  const req = {
    user: {
      role: 'user',
      permissions: [],
      scopes: ['read:dashboard']
    }
  };
  const res = createRes();
  let nextCalled = false;

  requirePermissions(['read:dashboard'])(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('requirePermissions bloquea cuando faltan permisos', () => {
  const req = {
    user: {
      role: 'user',
      permissions: ['read:orders'],
      scopes: []
    }
  };
  const res = createRes();
  let nextCalled = false;

  requirePermissions(['read:dashboard'])(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'INSUFFICIENT_PERMISSIONS');
});
