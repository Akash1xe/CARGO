const { consumer, producer, connectProducer } = require('../../config/kafka');
const searchService = require('../../services/search.service');
const logger = require('../../config/logger');
const { KAFKA_TOPICS } = require('../../../../shared/constants/kafka-topics');
const { withDLQ } = require('../../../../shared/utils/dlqHandler');

class SearchConsumer {
     async start() {
          await consumer.connect();
          await connectProducer();
          logger.info('Search consumer connected');

          await consumer.subscribe({
               topics: [
                    KAFKA_TOPICS.HUB_CREATED,
                    KAFKA_TOPICS.TRANSPORT_ROUTE_CREATED,
                    KAFKA_TOPICS.CARGO_TRIP_CREATED,
                    KAFKA_TOPICS.CARGO_TRIP_CANCELLED,
                    KAFKA_TOPICS.CAPACITY_AVAILABILITY_UPDATED,
               ],
               fromBeginning: true,
          });

          await consumer.run({
               eachMessage: withDLQ(
                    producer,
                    KAFKA_TOPICS.DLQ_SEARCH,
                    logger,
                    async ({ topic, partition, message, parsedValue }) => {
                         logger.info(`Processing ${topic}`, { partition, offset: message.offset });
                         switch (topic) {
                              case KAFKA_TOPICS.HUB_CREATED:
                                   await searchService.indexHub(parsedValue);
                                   break;
                              case KAFKA_TOPICS.TRANSPORT_ROUTE_CREATED:
                                   await searchService.indexVehicleRoute(parsedValue);
                                   break;
                              case KAFKA_TOPICS.CARGO_TRIP_CREATED:
                                   await searchService.indexCargoTrip(parsedValue);
                                   break;
                              case KAFKA_TOPICS.CARGO_TRIP_CANCELLED:
                                   await searchService.cancelCargoTrip(parsedValue);
                                   break;
                              case KAFKA_TOPICS.CAPACITY_AVAILABILITY_UPDATED:
                                   await searchService.updateCapacityAvailability(parsedValue);
                                   break;
                              default:
                                   logger.warn(`Unknown topic: ${topic}`);
                         }
                    }
               ),
          });

          logger.info('Search consumer running');
     }
}

module.exports = new SearchConsumer();
