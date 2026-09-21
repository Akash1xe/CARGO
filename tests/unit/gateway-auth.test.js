const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters';
process.env.INTERNAL_SERVICE_KEY = 'test-internal-service-key-at-least-32-characters';

const jwt = require('../../api-gateway/node_modules/jsonwebtoken');
const { requireAuth, requireRole } = require('../../api-gateway/src/middlewares/auth.middleware');

const invoke = (middleware, req) => new Promise(resolve => middleware(req, {}, resolve));

test('missing, invalid, and expired access tokens are rejected', async () => {
     const missing = await invoke(requireAuth, { headers: {}, cookies: {} });
     assert.equal(missing.statusCode, 401);

     const invalid = await invoke(requireAuth, { headers: { authorization: 'Bearer invalid' }, cookies: {} });
     assert.equal(invalid.statusCode, 401);

     const expiredToken = jwt.sign(
          { id: 'user-1', role: 'CUSTOMER', exp: Math.floor(Date.now() / 1000) - 1 },
          process.env.JWT_ACCESS_SECRET
     );
     const expired = await invoke(requireAuth, { headers: { authorization: `Bearer ${expiredToken}` }, cookies: {} });
     assert.equal(expired.statusCode, 401);
     assert.equal(expired.code, 'TOKEN_EXPIRED');
});

test('valid token overwrites forged identity headers', async () => {
     const token = jwt.sign({ id: 'real-user', role: 'CUSTOMER' }, process.env.JWT_ACCESS_SECRET);
     const req = {
          headers: {
               authorization: `Bearer ${token}`,
               'x-user-id': 'attacker',
               'x-user-role': 'ADMIN',
          },
          cookies: {},
     };
     const result = await invoke(requireAuth, req);
     assert.equal(result, undefined);
     assert.deepEqual(req.user, { id: 'real-user', role: 'CUSTOMER' });
     assert.equal(req.headers['x-user-id'], 'real-user');
     assert.equal(req.headers['x-user-role'], 'CUSTOMER');
});

test('Admin role middleware rejects CUSTOMER and accepts ADMIN', async () => {
     const middleware = requireRole('ADMIN');
     const denied = await invoke(middleware, { user: { id: 'customer', role: 'CUSTOMER' } });
     assert.equal(denied.statusCode, 403);
     assert.equal(await invoke(middleware, { user: { id: 'admin', role: 'ADMIN' } }), undefined);
});
