const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters';
process.env.INTERNAL_SERVICE_KEY = 'test-internal-service-key-at-least-32-characters';

const { CircuitBreaker } = require('../../api-gateway/src/services/proxy');

test('circuit opens, rejects, half-opens, and closes after recovery', async () => {
     const breaker = new CircuitBreaker('test-service', 2, 50);
     const failure = () => Promise.reject(new Error('down'));

     await assert.rejects(breaker.execute(failure), /down/);
     await assert.rejects(breaker.execute(failure), /down/);
     assert.equal(breaker.state, 'OPEN');
     await assert.rejects(breaker.execute(async () => 'unexpected'), /temporarily unavailable/);

     await new Promise(resolve => setTimeout(resolve, 60));
     assert.equal(await breaker.execute(async () => 'ok'), 'ok');
     assert.equal(breaker.state, 'CLOSED');
     assert.equal(breaker.failureCount, 0);
});
