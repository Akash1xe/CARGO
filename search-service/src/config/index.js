const config = {
     SERVICE_NAME: require('../../package.json').name,
     PORT: Number(process.env.PORT) || 4002,
     NODE_ENV: process.env.NODE_ENV || "development",
     LOG_LEVEL: process.env.LOG_LEVEL || "info",
     ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL,
     ELASTICSEARCH_HUB_INDEX: process.env.ELASTICSEARCH_HUB_INDEX || 'cargoflow-hubs',
     ELASTICSEARCH_VEHICLE_INDEX: process.env.ELASTICSEARCH_VEHICLE_INDEX || 'cargoflow-vehicles',
     KAFKA_BROKER: process.env.KAFKA_BROKER,
     KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID,
     KAFKA_CONSUMER_GROUP_SUFFIX: process.env.KAFKA_CONSUMER_GROUP_SUFFIX,
     ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
}

module.exports = { config };
