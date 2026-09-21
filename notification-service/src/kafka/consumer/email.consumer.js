const { consumer, producer, connectProducer } = require('../../config/kafka');
const emailService = require('../../services/email.service');
const logger = require('../../config/logger');
const { KAFKA_TOPICS } = require('../../../../shared/constants/kafka-topics');
const { withDLQ } = require('../../../../shared/utils/dlqHandler');

const SHIPMENT_TOPICS = [
     KAFKA_TOPICS.OTP_EMAIL,
     KAFKA_TOPICS.WELCOME_EMAIL,
     KAFKA_TOPICS.SHIPMENT_CONFIRMED,
     KAFKA_TOPICS.SHIPMENT_FAILED,
     KAFKA_TOPICS.SHIPMENT_CANCELLED,
];

const requireFields = (data, fields, eventName) => {
     const missing = fields.filter(field => data?.[field] === undefined || data?.[field] === null || data?.[field] === '');
     if (missing.length) throw new Error(`${eventName} missing required fields: ${missing.join(', ')}`);
};

class EmailConsumer {
     async start() {
          try {
               await consumer.connect();
               await connectProducer();
               logger.info('Email consumer connected to Kafka');
               await consumer.subscribe({ topics: SHIPMENT_TOPICS, fromBeginning: false });
               await consumer.run({
                    eachMessage: withDLQ(
                         producer,
                         KAFKA_TOPICS.DLQ_NOTIFICATION,
                         logger,
                         async ({ topic, parsedValue }) => {
                              logger.info(`Processing message from topic: ${topic}`);
                              await this.handleMessage(topic, parsedValue);
                         }
                    ),
               });
               logger.info('Email consumer is running');
          } catch (error) {
               logger.error('Failed to start email consumer', { error: error.message });
               throw error;
          }
     }

     async handleMessage(topic, data) {
          if (topic === KAFKA_TOPICS.OTP_EMAIL) return this.handleOtpEmail(data);
          if (topic === KAFKA_TOPICS.WELCOME_EMAIL) return this.handleWelcomeEmail(data);
          if (topic === KAFKA_TOPICS.SHIPMENT_CONFIRMED) return this.handleShipmentConfirmed(data);
          if (topic === KAFKA_TOPICS.SHIPMENT_FAILED) return this.handleShipmentFailed(data);
          if (topic === KAFKA_TOPICS.SHIPMENT_CANCELLED) return this.handleShipmentCancelled(data);
          logger.warn(`Unknown topic: ${topic}`);
     }

     async handleOtpEmail(data) {
          requireFields(data, ['email', 'otp'], 'OTP_EMAIL');
          await emailService.sendOtpEmail(data.email, data.otp, data.ttlMinutes || 5);
          logger.info(`OTP email sent to ${data.email}`);
     }

     async handleWelcomeEmail(data) {
          requireFields(data, ['email', 'firstName'], 'WELCOME_EMAIL');
          await emailService.sendWelcomeEmail(data.email, data.firstName);
          logger.info(`Welcome email sent to ${data.email}`);
     }

     async handleShipmentConfirmed(data) {
          if (!data?.email) {
               logger.warn('Skipping shipment-confirmed email because the event has no email', {
                    shipmentBookingId: data?.shipmentBookingId,
               });
               return;
          }
          requireFields(data, ['shipmentBookingId', 'trackingNumber', 'tripId'], 'SHIPMENT_CONFIRMED');
          await emailService.sendShipmentConfirmedEmail(data.email, data);
          logger.info(`Shipment confirmation email sent to ${data.email}`, {
               shipmentBookingId: data.shipmentBookingId,
          });
     }

     async handleShipmentFailed(data) {
          if (!data?.email) {
               logger.warn('Skipping shipment-failed email because the event has no email', {
                    shipmentBookingId: data?.shipmentBookingId,
               });
               return;
          }
          requireFields(data, ['shipmentBookingId', 'trackingNumber', 'tripId', 'reason'], 'SHIPMENT_FAILED');
          await emailService.sendShipmentFailedEmail(data.email, data);
          logger.info(`Shipment failure email sent to ${data.email}`, {
               shipmentBookingId: data.shipmentBookingId,
          });
     }

     async handleShipmentCancelled(data) {
          if (!data?.email) {
               logger.warn('Skipping shipment-cancelled email because the event has no email', {
                    shipmentBookingId: data?.shipmentBookingId,
               });
               return;
          }
          requireFields(data, ['shipmentBookingId', 'trackingNumber', 'tripId', 'reason'], 'SHIPMENT_CANCELLED');
          await emailService.sendShipmentCancelledEmail(data.email, data);
          logger.info(`Shipment cancellation email sent to ${data.email}`, {
               shipmentBookingId: data.shipmentBookingId,
          });
     }

     async stop() {
          await consumer.disconnect();
          logger.info('Email consumer disconnected');
     }
}

const emailConsumer = new EmailConsumer();
emailConsumer.SHIPMENT_TOPICS = SHIPMENT_TOPICS;
emailConsumer.requireFields = requireFields;

module.exports = emailConsumer;
