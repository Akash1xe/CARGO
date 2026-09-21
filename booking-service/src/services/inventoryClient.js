const axios = require('axios');
const { config } = require('../config');
const logger = require('../config/logger');

const client = axios.create({
     baseURL: config.INVENTORY_SERVICE_URL,
     timeout: 10000,
     headers: {
          'Content-Type': 'application/json',
          'x-internal-service-key': config.INTERNAL_SERVICE_KEY,
     },
});

async function withRetry(fn, maxRetries = 3) {
     let lastError;
     for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
               return await fn();
          } catch (error) {
               lastError = error;
               const status = error.response?.status;
               if (status && status >= 400 && status < 500) throw error;
               if (attempt < maxRetries) {
                    const delay = 200 * Math.pow(2, attempt - 1);
                    logger.warn(`Inventory client retry ${attempt}/${maxRetries} after ${delay}ms`, {
                         error: error.message,
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
               }
          }
     }
     throw lastError;
}

function extractError(error) {
     if (error.response?.data) {
          return {
               status: error.response.status,
               message: error.response.data.message || error.message,
               code: error.response.data.error,
          };
     }
     return { status: 500, message: error.message, code: 'INVENTORY_SERVICE_ERROR' };
}

const inventoryClient = {
     async getAvailability(tripId) {
          return withRetry(async () => {
               const { data } = await client.get(`/trips/${tripId}/availability`);
               return data.data;
          });
     },

     async getCapacityUnits(tripId, filters = {}) {
          return withRetry(async () => {
               const params = {};
               if (filters.status) params.status = filters.status;
               if (filters.unitType) params.unitType = filters.unitType;
               if (filters.fromSeq !== undefined) params.fromSeq = filters.fromSeq;
               if (filters.toSeq !== undefined) params.toSeq = filters.toSeq;
               const { data } = await client.get(`/trips/${tripId}/capacity-units`, { params });
               return data.data;
          });
     },

     async holdCapacityUnits(tripId, capacityUnitIds, userId, shipmentBookingId, ttlSeconds, fromSeq, toSeq) {
          return withRetry(async () => {
               const { data } = await client.post('/capacity-units/lock', {
                    tripId, capacityUnitIds, userId, shipmentBookingId, ttlSeconds, fromSeq, toSeq,
               });
               return data.data;
          });
     },

     async releaseCapacityUnits(tripId, capacityUnitIds, userId, shipmentBookingId, fromSeq, toSeq) {
          return withRetry(async () => {
               const { data } = await client.post('/capacity-units/unlock', {
                    tripId, capacityUnitIds, userId, shipmentBookingId, fromSeq, toSeq,
               });
               return data.data;
          });
     },

     async confirmCapacityUnits(tripId, capacityUnitIds, userId, shipmentBookingId, fromSeq, toSeq) {
          return withRetry(async () => {
               const { data } = await client.post('/capacity-units/confirm', {
                    tripId,
                    capacityUnitIds,
                    userId,
                    bookingId: shipmentBookingId,
                    shipmentBookingId,
                    fromSeq,
                    toSeq,
               });
               return data.data;
          });
     },

     async cancelShipmentCapacity(tripId, shipmentBookingId, userId) {
          return withRetry(async () => {
               const { data } = await client.post('/capacity-units/cancel-booking', {
                    tripId,
                    bookingId: shipmentBookingId,
                    shipmentBookingId,
                    userId,
               });
               return data.data;
          });
     },
};

module.exports = { inventoryClient, extractError };
