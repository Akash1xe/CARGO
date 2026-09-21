const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters';
process.env.ACCESS_TOKEN_EXP = '15m';
process.env.REFRESH_TOKEN_EXP = '7d';

const auth = require('../../user-service/src/utils/auth');

test('access token includes user ID and role', () => {
     const payload = auth.verifyAccessToken(auth.generateAccessToken('user-1', 'ADMIN'));
     assert.equal(payload.id, 'user-1');
     assert.equal(payload.role, 'ADMIN');
});

test('refresh token includes a unique jti and hashes deterministically', () => {
     const first = auth.generateRefreshToken('user-1');
     const second = auth.generateRefreshToken('user-1');
     assert.ok(auth.verifyRefreshToken(first).jti);
     assert.notEqual(auth.verifyRefreshToken(first).jti, auth.verifyRefreshToken(second).jti);
     assert.equal(auth.hashToken(first), auth.hashToken(first));
});
