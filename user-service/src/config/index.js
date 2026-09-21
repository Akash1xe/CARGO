const config = {
  SERVICE_NAME: require('../../package.json').name,
  PORT: Number(process.env.PORT) || 4001,
  NODE_ENV: process.env.NODE_ENV || "development",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  KAFKA_BROKER: process.env.KAFKA_BROKER,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,

  OTP_TTL: process.env.OTP_TTL || 300,
  OTP_RATE_MAX_PER_HOUR: process.env.OTP_RATE_MAX_PER_HOUR || 5,
  OTP_MAX_VERIFY_ATTEMPTS: process.env.OTP_MAX_VERIFY_ATTEMPTS || 5,
  OTP_HMAC_SECRET: process.env.OTP_HMAC_SECRET,

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  ACCESS_TOKEN_EXP: process.env.ACCESS_TOKEN_EXP || "15m",
  REFRESH_TOKEN_EXP: process.env.REFRESH_TOKEN_EXP || "7d",
  ACCESS_TOKEN_EXP_SEC: Number(process.env.ACCESS_TOKEN_EXP_SEC || 900),
  REFRESH_TOKEN_EXP_SEC: Number(process.env.REFRESH_TOKEN_EXP_SEC || 604800),
  REDIS_USER_TTL: Number(process.env.REDIS_USER_TTL || 86400),


  MAIL_SEND: process.env.MAIL_SEND,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

  INTERNAL_SERVICE_KEY: process.env.INTERNAL_SERVICE_KEY,
}


if (config.NODE_ENV === 'production') {
  const required = [
    'DATABASE_URL', 'REDIS_URL', 'OTP_HMAC_SECRET', 'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET', 'GOOGLE_CLIENT_ID', 'SENDGRID_API_KEY',
    'MAIL_SEND', 'INTERNAL_SERVICE_KEY',
  ];
  for (const key of required) {
    if (!config[key]) throw new Error(`Missing required production environment variable: ${key}`);
  }
}
module.exports = { config };
