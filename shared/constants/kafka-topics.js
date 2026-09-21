/**
 * Centralized Kafka topic definitions.
 * Every service imports from here so topic names stay in sync.
 */
const KAFKA_TOPICS = {
     // Notification topics (user-service -> notification-service)
     OTP_EMAIL: 'notification.otp-email',
     WELCOME_EMAIL: 'notification.welcome-email',
     // Admin topics (admin-service -> inventory/search)
     HUB_CREATED: 'admin.hub-created',
     VEHICLE_CREATED: 'admin.vehicle-created',
     TRANSPORT_ROUTE_CREATED: 'admin.transport-route-created',
     CARGO_TRIP_CREATED: 'admin.cargo-trip-created',
     CARGO_TRIP_CANCELLED: 'admin.cargo-trip-cancelled',

     // Inventory topics (inventory-service -> search-service)
     CAPACITY_AVAILABILITY_UPDATED: 'inventory.capacity-availability-updated',

     // Shipment topics (booking-service -> notification-service)
     SHIPMENT_CONFIRMED: 'shipment.confirmed',
     SHIPMENT_CANCELLED: 'shipment.cancelled',
     SHIPMENT_FAILED: 'shipment.failed',

     // Payment topics (payment-service -> booking-service)
     PAYMENT_SUCCESS: 'payment.success',
     PAYMENT_FAILED: 'payment.failed',

     // Dead-letter queues (per service — poison messages land here)
     DLQ_BOOKING: 'dlq.booking-service',
     DLQ_INVENTORY: 'dlq.inventory-service',
     DLQ_SEARCH: 'dlq.search-service',
     DLQ_NOTIFICATION: 'dlq.notification-service',
};

/**
 * Max retries before a consumer message is sent to the DLQ.
 * After this many failures the message is considered poison.
 */
const DLQ_MAX_RETRIES = 3;

module.exports = { KAFKA_TOPICS, DLQ_MAX_RETRIES };
