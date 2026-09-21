const { consumer, producer, connectProducer } = require('../../config/kafka');
const logger = require('../../config/logger');
const { KAFKA_TOPICS } = require('../../../../shared/constants/kafka-topics');
const { withDLQ } = require('../../../../shared/utils/dlqHandler');
const shipmentService = require('../../services/shipment.service');

const start = async () => {
     await consumer.connect();
     await connectProducer();
     logger.info('Shipment consumer connected');

     await consumer.subscribe({
          topics: [
               KAFKA_TOPICS.PAYMENT_SUCCESS,
               KAFKA_TOPICS.PAYMENT_FAILED,
               KAFKA_TOPICS.CARGO_TRIP_CANCELLED,
          ],
          fromBeginning: false,
     });

     await consumer.run({
          eachMessage: withDLQ(
               producer,
               KAFKA_TOPICS.DLQ_BOOKING,
               logger,
               async ({ topic, partition, message, parsedValue }) => {
                    logger.info(`Received message on topic: ${topic}`, {
                         partition,
                         offset: message.offset,
                         key: message.key?.toString(),
                    });
                    if (topic === KAFKA_TOPICS.PAYMENT_SUCCESS) {
                         await shipmentService.handlePaymentSuccess(
                              parsedValue.paymentOrderId,
                              parsedValue.shipmentBookingId,
                              parsedValue.gatewayPaymentId,
                              parsedValue.amount
                         );
                    } else if (topic === KAFKA_TOPICS.PAYMENT_FAILED) {
                         await shipmentService.handlePaymentFailure(
                              parsedValue.paymentOrderId,
                              parsedValue.shipmentBookingId,
                              parsedValue.reason
                         );
                    } else if (topic === KAFKA_TOPICS.CARGO_TRIP_CANCELLED) {
                         const tripId = parsedValue.tripId || parsedValue.id || parsedValue.data?.tripId;
                         await shipmentService.handleCargoTripCancelled(tripId);
                    }
               }
          ),
     });
     logger.info('Shipment consumer running');
};

module.exports = { start };
