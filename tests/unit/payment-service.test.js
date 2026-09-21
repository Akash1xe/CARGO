const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.PAYMENT_GATEWAY = 'mock';
process.env.DATABASE_URL = 'postgres://admin:test-password@localhost:5432/cargoflow_payment_test';

const prisma = require('../../payment-service/src/config/prisma');
const producer = require('../../payment-service/src/kafka/producer/payment.producer');
const MockGateway = require('../../payment-service/src/services/gateways/mock.gateway');
const payments = require('../../payment-service/src/services/payment.service');

const original = {
     idempotencyFind: prisma.idempotencyRecord.findUnique,
     orderFind: prisma.paymentOrder.findUnique,
     orderUpdate: prisma.paymentOrder.update,
     auditCreate: prisma.paymentAuditLog.create,
     success: producer.publishPaymentSuccess,
     failed: producer.publishPaymentFailed,
};

test.after(() => {
     prisma.idempotencyRecord.findUnique = original.idempotencyFind;
     prisma.paymentOrder.findUnique = original.orderFind;
     prisma.paymentOrder.update = original.orderUpdate;
     prisma.paymentAuditLog.create = original.auditCreate;
     producer.publishPaymentSuccess = original.success;
     producer.publishPaymentFailed = original.failed;
     return prisma.$disconnect();
});

test('payment order requires shipmentBookingId and a positive amount', async () => {
     await assert.rejects(payments.createPaymentOrder('', 1200, 'user-1', 'key-1'), /shipmentBookingId/);
     await assert.rejects(payments.createPaymentOrder('shipment-1', -1, 'user-1', 'key-1'), /greater than 0/);
});

test('duplicate payment idempotency key returns the stored response', async () => {
     const stored = { paymentOrderId: 'payment-order-1', shipmentBookingId: 'shipment-1' };
     prisma.idempotencyRecord.findUnique = async ({ where }) => {
          assert.equal(where.eventKey, 'payment-order:key-1');
          return { response: stored };
     };
     assert.deepEqual(
          await payments.createPaymentOrder('shipment-1', 1200, 'user-1', 'key-1'),
          stored
     );
});

test('valid signature captures and publishes shipment-aware success', async () => {
     const order = {
          id: 'payment-order-1', shipmentBookingId: 'shipment-1', gatewayOrderId: 'gateway-order-1',
          gatewayPaymentId: null, status: 'CREATED', amount: 1200,
     };
     prisma.paymentOrder.findUnique = async () => order;
     prisma.paymentOrder.update = async ({ data }) => data;
     prisma.paymentAuditLog.create = async ({ data }) => data;
     let payload;
     producer.publishPaymentSuccess = async (...args) => { payload = args; };
     const paymentId = 'gateway-payment-1';
     const signature = MockGateway.createPaymentSignature(order.gatewayOrderId, paymentId);

     const result = await payments.verifyAndCapturePayment(order.id, paymentId, signature);
     assert.equal(result.status, 'CAPTURED');
     assert.deepEqual(payload, [order.id, order.shipmentBookingId, paymentId, order.amount]);
});

test('invalid signature fails the order and publishes PAYMENT_FAILED', async () => {
     const order = {
          id: 'payment-order-2', shipmentBookingId: 'shipment-2', gatewayOrderId: 'gateway-order-2',
          status: 'CREATED', amount: 500,
     };
     prisma.paymentOrder.findUnique = async () => order;
     let update;
     prisma.paymentOrder.update = async ({ data }) => { update = data; return data; };
     prisma.paymentAuditLog.create = async ({ data }) => data;
     let payload;
     producer.publishPaymentFailed = async (...args) => { payload = args; };

     await assert.rejects(
          payments.verifyAndCapturePayment(order.id, 'gateway-payment-2', 'invalid'),
          error => error.code === 'INVALID_SIGNATURE'
     );
     assert.equal(update.status, 'FAILED');
     assert.deepEqual(payload, [order.id, order.shipmentBookingId, 'signature_verification_failed']);
});

test('refund total cannot exceed the captured amount', async () => {
     prisma.idempotencyRecord.findUnique = async () => null;
     prisma.paymentOrder.findUnique = async () => ({
          id: 'payment-order-3', shipmentBookingId: 'shipment-3', gatewayPaymentId: 'payment-3',
          status: 'PARTIALLY_REFUNDED', amount: 1200,
          refunds: [{ amount: 1000, status: 'COMPLETED' }],
     });
     await assert.rejects(
          payments.initiateRefund('payment-order-3', 300, 'shipment_cancelled', 'refund-key-1'),
          /exceeds refundable amount/
     );
});
