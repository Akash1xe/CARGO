const test = require('node:test');
const assert = require('node:assert/strict');
const { assertSafeTestEnvironment, databaseName } = require('../helpers/safe-test-env');

const safe = {
     NODE_ENV: 'test',
     DATABASE_URL: 'postgres://user:pass@localhost:5432/cargoflow_payment_test',
     REDIS_URL: 'redis://localhost:6379/15',
     PAYMENT_GATEWAY: 'mock',
     SEND_EMAILS: 'false',
};

test('extracts the database name without exposing credentials', () => {
     assert.equal(databaseName(safe.DATABASE_URL), 'cargoflow_payment_test');
});

test('accepts isolated test resources', () => {
     assert.equal(assertSafeTestEnvironment(safe).redisDatabase, 15);
});

test('rejects a non-test database', () => {
     assert.throws(
          () => assertSafeTestEnvironment({ ...safe, DATABASE_URL: 'postgres://localhost/cargoflow_payment' }),
          /must clearly contain _test/
     );
});

test('rejects the default Redis database and real gateways', () => {
     assert.throws(() => assertSafeTestEnvironment({ ...safe, REDIS_URL: 'redis://localhost/0' }), /non-zero Redis/);
     assert.throws(() => assertSafeTestEnvironment({ ...safe, PAYMENT_GATEWAY: 'razorpay' }), /must equal mock/);
});
