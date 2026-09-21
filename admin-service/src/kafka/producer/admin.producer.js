const { producer, connectProducer } = require('../../config/kafka');
const logger = require('../../config/logger');
const { KAFKA_TOPICS } = require('../../../../shared/constants/kafka-topics');

class AdminProducer {
     constructor() {
          this.isInitialized = false;
     }

     async initialize() {
          if (!this.isInitialized) {
               await connectProducer();
               this.isInitialized = true;
          }
     }

     async sendMessage(topic, key, value) {
          try {
               await this.initialize();
               const result = await producer.send({
                    topic,
                    messages: [{
                         key: key || `${topic}-${Date.now()}`,
                         value: JSON.stringify(value),
                         timestamp: Date.now().toString(),
                    }],
               });
               logger.info(`Message sent to topic: ${topic}`, {
                    key,
                    partition: result[0].partition,
                    offset: result[0].offset,
               });
               return result;
          } catch (error) {
               logger.error(`Failed to send message to topic: ${topic}`, {
                    error: error.message,
                    key,
               });
               throw error;
          }
     }

     publishHubCreated(hub) {
          return this.sendMessage(
               KAFKA_TOPICS.HUB_CREATED,
               `hub-${hub.id}`,
               { eventType: 'HUB_CREATED', data: hub, timestamp: new Date().toISOString() }
          );
     }

     publishVehicleCreated(vehicle) {
          return this.sendMessage(KAFKA_TOPICS.VEHICLE_CREATED, `vehicle-${vehicle.id}`, vehicle);
     }

     publishTransportRouteCreated(route) {
          return this.sendMessage(
               KAFKA_TOPICS.TRANSPORT_ROUTE_CREATED,
               `transport-route-${route.id}`,
               route
          );
     }

     publishCargoTripCreated(trip) {
          return this.sendMessage(KAFKA_TOPICS.CARGO_TRIP_CREATED, `cargo-trip-${trip.tripId}`, trip);
     }

     publishCargoTripCancelled(trip) {
          return this.sendMessage(KAFKA_TOPICS.CARGO_TRIP_CANCELLED, `cargo-trip-${trip.tripId}`, trip);
     }
}

module.exports = new AdminProducer();
