const { producer, connectProducer } = require('../../config/kafka');
const logger = require('../../config/logger');
const { KAFKA_TOPICS } = require('../../../../shared/constants/kafka-topics');

const MAX_PUBLISH_RETRIES = 3;
const RETRY_DELAY_MS = 500;

class ShipmentProducer {
     constructor() { this.isInitialized = false; }

     async initialize() {
          if (!this.isInitialized) {
               await connectProducer();
               this.isInitialized = true;
          }
     }

     async sendMessage(topic, key, value) {
          await this.initialize();
          let lastError;
          for (let attempt = 1; attempt <= MAX_PUBLISH_RETRIES; attempt++) {
               try {
                    const result = await producer.send({
                         topic,
                         messages: [{ key, value: JSON.stringify(value), timestamp: Date.now().toString() }],
                    });
                    logger.info(`Message sent to topic: ${topic}`, {
                         key,
                         partition: result[0].partition,
                         offset: result[0].offset,
                    });
                    return result;
               } catch (error) {
                    lastError = error;
                    logger.error(`Failed to send message to ${topic} (attempt ${attempt}/${MAX_PUBLISH_RETRIES})`, {
                         error: error.message,
                         key,
                    });
                    if (attempt < MAX_PUBLISH_RETRIES) {
                         await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
                    }
               }
          }
          throw lastError;
     }

     publishShipmentConfirmed(data) {
          return this.sendMessage(
               KAFKA_TOPICS.SHIPMENT_CONFIRMED,
               `shipment-${data.shipmentBookingId}`,
               { ...data, confirmedAt: new Date().toISOString() }
          );
     }

     publishShipmentCancelled(data) {
          return this.sendMessage(
               KAFKA_TOPICS.SHIPMENT_CANCELLED,
               `shipment-${data.shipmentBookingId}`,
               { ...data, cancelledAt: new Date().toISOString() }
          );
     }

     publishShipmentFailed(data) {
          return this.sendMessage(
               KAFKA_TOPICS.SHIPMENT_FAILED,
               `shipment-${data.shipmentBookingId}`,
               { ...data, failedAt: new Date().toISOString() }
          );
     }
}

module.exports = new ShipmentProducer();
