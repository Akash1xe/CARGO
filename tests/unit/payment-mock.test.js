const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.PAYMENT_GATEWAY = 'mock';

const MockGateway = require('../../payment-service/src/services/gateways/mock.gateway');
const { getGateway } = require('../../payment-service/src/services/gateways/gateway.factory');

test('mock gateway creates deterministic orders without network access', async () => {
     const gateway = getGateway();
     const first = await gateway.createOrder(1200, 'INR', 'shipment-1', { shipmentBookingId: 'shipment-1' });
     const second = await gateway.createOrder(1200, 'INR', 'shipment-1', { shipmentBookingId: 'shipment-1' });
     assert.equal(first.gatewayOrderId, second.gatewayOrderId);
     assert.equal(first.amount, 1200);
     assert.equal(first.currency, 'INR');
});

test('mock gateway verifies deterministic signatures and simulates failure', async () => {
     const gateway = getGateway();
     const signature = MockGateway.createPaymentSignature('order-1', 'payment-1');
     assert.equal(gateway.verifyPaymentSignature('order-1', 'payment-1', signature), true);
     assert.equal(gateway.verifyPaymentSignature('order-1', 'payment-1', 'invalid'), false);
     assert.equal((await gateway.fetchPayment('payment-1')).status, 'captured');
     assert.equal((await gateway.fetchPayment('payment-failed')).status, 'failed');
});

test('mock refunds are deterministic', async () => {
     const gateway = getGateway();
     const first = await gateway.initiateRefund('payment-1', 500, { reason: 'shipment_cancelled' });
     const second = await gateway.initiateRefund('payment-1', 500, { reason: 'shipment_cancelled' });
     assert.equal(first.gatewayRefundId, second.gatewayRefundId);
     assert.equal(first.status, 'processed');
});

test('mock gateway refuses to start outside the test environment', () => {
     const modulePath = path.resolve(__dirname, '../../payment-service/src/services/gateways/mock.gateway.js');
     const result = spawnSync(process.execPath, ['-e', `const Mock = require(${JSON.stringify(modulePath)}); new Mock();`], {
          env: { ...process.env, NODE_ENV: 'development' },
          encoding: 'utf8',
     });
     assert.notEqual(result.status, 0);
     assert.match(result.stderr, /must never run outside NODE_ENV=test/);
});
