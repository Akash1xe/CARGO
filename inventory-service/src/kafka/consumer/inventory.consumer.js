const { consumer, producer, connectProducer } = require('../../config/kafka');
const logger = require('../../config/logger');
const { KAFKA_TOPICS } = require('../../../../shared/constants/kafka-topics');
const { withDLQ } = require('../../../../shared/utils/dlqHandler');
const inventoryService = require('../../services/inventory.service');

class InventoryConsumer {
     async start() {
          await consumer.connect();
          await connectProducer();
          logger.info('Inventory consumer connected');

          await consumer.subscribe({
               topics: [KAFKA_TOPICS.CARGO_TRIP_CREATED, KAFKA_TOPICS.CARGO_TRIP_CANCELLED],
               fromBeginning: true,
          });

          await consumer.run({
               eachMessage: withDLQ(
                    producer,
                    KAFKA_TOPICS.DLQ_INVENTORY,
                    logger,
                    async ({ topic, partition, message, parsedValue }) => {
                         logger.info(`Processing ${topic}`, { partition, offset: message.offset });
                         switch (topic) {
                              case KAFKA_TOPICS.CARGO_TRIP_CREATED:
                                   await inventoryService.initializeTripInventory(parsedValue);
                                   break;
                              case KAFKA_TOPICS.CARGO_TRIP_CANCELLED:
                                   await inventoryService.cancelTripInventory(parsedValue);
                                   break;
                              default:
                                   logger.warn(`Unhandled topic: ${topic}`);
                         }
                    }
               ),
          });

          logger.info('Inventory consumer running');
     }
}

module.exports = new InventoryConsumer();
