const axios = require('axios');
const { config } = require('../config');
const logger = require('../config/logger');

const client = axios.create({
     baseURL: config.ADMIN_SERVICE_URL,
     timeout: 5000,
     headers: {
          'Content-Type': 'application/json',
          'x-internal-service-key': config.INTERNAL_SERVICE_KEY,
     },
});

const HUB_CACHE_TTL_MS = 10 * 60 * 1000;
const hubCache = new Map();

function cacheGet(hubId) {
     const entry = hubCache.get(hubId);
     if (!entry) return null;
     if (Date.now() > entry.expiresAt) {
          hubCache.delete(hubId);
          return null;
     }
     return entry.value;
}

function cacheSet(hubId, value) {
     hubCache.set(hubId, { value, expiresAt: Date.now() + HUB_CACHE_TTL_MS });
}

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
                    logger.warn(`Hub client retry ${attempt}/${maxRetries} after ${delay}ms`, {
                         error: error.message,
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
               }
          }
     }
     throw lastError;
}

const hubClient = {
     async getHubById(hubId) {
          if (!hubId) return null;
          const cached = cacheGet(hubId);
          if (cached) return cached;
          const hub = await withRetry(async () => {
               const { data } = await client.get(`/hub/internal/${hubId}`);
               return data.data;
          });
          if (hub) cacheSet(hubId, hub);
          return hub;
     },
};

module.exports = { hubClient };
