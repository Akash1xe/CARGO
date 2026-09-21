const crypto = require('crypto');
const BaseGateway = require('./base.gateway');

const TEST_SECRET = 'cargoflow-local-test-secret';

const digest = value => crypto.createHmac('sha256', TEST_SECRET).update(value).digest('hex');

class MockGateway extends BaseGateway {
     constructor() {
          if (process.env.NODE_ENV !== 'test') {
               throw new Error('MockGateway must never run outside NODE_ENV=test');
          }
          super('mock');
     }

     async createOrder(amount, currency, receipt, notes = {}) {
          const gatewayOrderId = `mock_order_${digest(`${receipt}|${amount}|${currency}`).slice(0, 16)}`;
          return {
               gatewayOrderId,
               amount,
               currency,
               receipt,
               rawResponse: { id: gatewayOrderId, amount, currency, receipt, notes, test: true },
          };
     }

     static createPaymentSignature(orderId, paymentId) {
          return digest(`${orderId}|${paymentId}`);
     }

     static createWebhookSignature(rawBody) {
          return digest(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'));
     }

     verifyPaymentSignature(orderId, paymentId, signature) {
          return signature === MockGateway.createPaymentSignature(orderId, paymentId);
     }

     verifyWebhookSignature(rawBody, signature) {
          return signature === MockGateway.createWebhookSignature(rawBody);
     }

     async fetchPayment(paymentId) {
          const failed = String(paymentId).includes('failed');
          return {
               status: failed ? 'failed' : 'captured',
               amount: 1200,
               method: 'mock',
               rawResponse: { id: paymentId, status: failed ? 'failed' : 'captured', test: true },
          };
     }

     async initiateRefund(paymentId, amount, notes = {}) {
          const gatewayRefundId = `mock_refund_${digest(`${paymentId}|${amount}|${JSON.stringify(notes)}`).slice(0, 16)}`;
          return {
               gatewayRefundId,
               status: 'processed',
               amount,
               rawResponse: { id: gatewayRefundId, paymentId, amount, notes, test: true },
          };
     }

     async fetchRefund(paymentId, refundId) {
          return {
               status: 'processed',
               amount: 1200,
               rawResponse: { id: refundId, paymentId, status: 'processed', test: true },
          };
     }
}

module.exports = MockGateway;
