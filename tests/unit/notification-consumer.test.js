const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.KAFKA_BROKER = 'localhost:9093';
process.env.KAFKA_CLIENT_ID = 'cargoflow-notification-test';
process.env.SENDGRID_API_KEY = 'SG.test-only-placeholder';

const consumer = require('../../notification-service/src/kafka/consumer/email.consumer');
const { KAFKA_TOPICS } = require('../../shared/constants/kafka-topics');

test('consumer subscribes only to notification topics', () => {
     assert.deepEqual(consumer.SHIPMENT_TOPICS, [
          KAFKA_TOPICS.OTP_EMAIL,
          KAFKA_TOPICS.WELCOME_EMAIL,
          KAFKA_TOPICS.SHIPMENT_CONFIRMED,
          KAFKA_TOPICS.SHIPMENT_FAILED,
          KAFKA_TOPICS.SHIPMENT_CANCELLED,
     ]);
});

test('shipment events without email are skipped without throwing', async () => {
     await assert.doesNotReject(consumer.handleShipmentConfirmed({ shipmentBookingId: 'shipment-1' }));
     await assert.doesNotReject(consumer.handleShipmentFailed({ shipmentBookingId: 'shipment-1' }));
     await assert.doesNotReject(consumer.handleShipmentCancelled({ shipmentBookingId: 'shipment-1' }));
});
