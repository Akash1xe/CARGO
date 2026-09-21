const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters';
process.env.INTERNAL_SERVICE_KEY = 'test-internal-service-key-at-least-32-characters';

const { rateLimiter } = require('../../api-gateway/src/middlewares/rateLimiting.middleware');

test('rate limiter blocks a request after the configured threshold', async () => {
     const redis = {
          pipeline: () => ({
               zremrangebyscore() { return this; },
               zadd() { return this; },
               zcard() { return this; },
               expire() { return this; },
               async exec() { return [[null, 0], [null, 1], [null, 3], [null, 1]]; },
          }),
          zrange: async () => ['request', String(Date.now())],
     };

     const result = await rateLimiter('ratelimit:test:key', 2, 1000, redis);
     assert.equal(result.allowed, false);
     assert.equal(result.remaining, 0);
});
