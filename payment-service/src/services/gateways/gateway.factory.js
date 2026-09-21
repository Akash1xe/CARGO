const { config } = require('../../config');

let gatewayInstance = null;

/**
 * Factory function to create/get a payment gateway instance.
 * Uses singleton pattern — one gateway instance per process.
 * To add a new gateway (e.g., Stripe):
 *   1. Create stripe.gateway.js extending BaseGateway
 *   2. Add a case here
 *   3. Set PAYMENT_GATEWAY=stripe in .env
 */
function getGateway() {
     if (gatewayInstance) return gatewayInstance;

     const provider = config.PAYMENT_GATEWAY;

     switch (provider) {
          case 'razorpay':
               const RazorpayGateway = require('./razorpay.gateway');
               gatewayInstance = new RazorpayGateway(
                    config.RAZORPAY_KEY_ID,
                    config.RAZORPAY_KEY_SECRET,
                    config.RAZORPAY_WEBHOOK_SECRET
               );
               break;

          case 'mock': {
               if (config.NODE_ENV !== 'test') {
                    throw new Error('Mock payment gateway is available only when NODE_ENV=test');
               }
               const MockGateway = require('./mock.gateway');
               gatewayInstance = new MockGateway();
               break;
          }

          // Future gateways:
          // case 'stripe':
          //      gatewayInstance = new StripeGateway(config.STRIPE_KEY, ...);
          //      break;

          default:
               throw new Error(`Unknown payment gateway provider: ${provider}`);
     }

     return gatewayInstance;
}

function resetGatewayForTests() {
     if (config.NODE_ENV !== 'test') {
          throw new Error('Payment gateway reset is available only when NODE_ENV=test');
     }
     gatewayInstance = null;
}

module.exports = { getGateway, resetGatewayForTests };
