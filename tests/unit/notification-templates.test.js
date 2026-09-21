const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:3000';

const templates = require('../../notification-service/src/templates');

test('OTP and welcome templates use CargoFlow branding', () => {
     assert.match(templates.getOtpTemplate('123456', 5), /CargoFlow/);
     assert.match(templates.getWelcomeTemplate('Akash'), /search intercity transport routes/);
});

test('shipment templates render missing optional arrays safely', () => {
     assert.doesNotThrow(() => templates.getShipmentConfirmedTemplate({ trackingNumber: 'CF-1' }));
     assert.match(templates.getShipmentFailedTemplate({ reason: 'payment_failed' }), /payment could not be completed/);
     assert.match(templates.getShipmentCancelledTemplate({ reason: 'user_cancelled', refundAmount: 100 }), /5–7 business days/);
});

test('dynamic values are HTML escaped', () => {
     const html = templates.getShipmentConfirmedTemplate({
          firstName: '<script>alert(1)</script>',
          packages: [{ description: '<img src=x>', category: 'FRAGILE', weightKg: 1 }],
     });
     assert.doesNotMatch(html, /<script>|<img src=x>/);
     assert.match(html, /&lt;script&gt;/);
     assert.match(html, /&lt;img src=x&gt;/);
});
