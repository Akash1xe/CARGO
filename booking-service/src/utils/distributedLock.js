const { redis } = require('../config/redis');
const logger = require('../config/logger');

const ACQUIRE_SCRIPT = `
local lockValue = ARGV[1]
local ttl = tonumber(ARGV[2])
local acquired = {}

for i, key in ipairs(KEYS) do
     local result = redis.call('SET', key, lockValue, 'NX', 'EX', ttl)
     if not result then
          for j = 1, #acquired do
               redis.call('DEL', acquired[j])
          end
          return 0
     end
     table.insert(acquired, key)
end

return 1
`;

const RELEASE_SCRIPT = `
local lockValue = ARGV[1]
local released = 0

for i, key in ipairs(KEYS) do
     local currentValue = redis.call('GET', key)
     if currentValue == lockValue then
          redis.call('DEL', key)
          released = released + 1
     end
end

return released
`;

function buildCapacityLockKeys(tripId, capacityUnitIds, fromSeq, toSeq) {
     return [...capacityUnitIds]
          .sort()
          .map(capacityUnitId => `shipment:lock:capacity:${tripId}:${capacityUnitId}:${fromSeq}:${toSeq}`);
}

async function acquireCapacityLocks(
     tripId,
     capacityUnitIds,
     shipmentBookingId,
     ttlSeconds,
     fromSeq,
     toSeq
) {
     const keys = buildCapacityLockKeys(tripId, capacityUnitIds, fromSeq, toSeq);
     const lockValue = `${shipmentBookingId}:${Date.now()}`;

     try {
          const result = await redis.eval(ACQUIRE_SCRIPT, keys.length, ...keys, lockValue, ttlSeconds);
          if (result === 1) {
               logger.info(`Distributed capacity locks acquired for shipment ${shipmentBookingId}`, {
                    tripId,
                    capacityUnitCount: capacityUnitIds.length,
                    ttlSeconds,
               });
               return { acquired: true, lockValue };
          }
          logger.info('Failed to acquire capacity locks because a unit is already locked', {
               tripId,
               shipmentBookingId,
          });
          return { acquired: false, lockValue: null };
     } catch (error) {
          logger.error('Error acquiring distributed capacity locks', {
               error: error.message,
               tripId,
               shipmentBookingId,
          });
          return { acquired: false, lockValue: null };
     }
}

async function releaseCapacityLocks(tripId, capacityUnitIds, lockValue, fromSeq, toSeq) {
     if (!lockValue) return;
     const keys = buildCapacityLockKeys(tripId, capacityUnitIds, fromSeq, toSeq);
     try {
          const released = await redis.eval(RELEASE_SCRIPT, keys.length, ...keys, lockValue);
          logger.info(`Released ${released} distributed capacity lock(s)`, { tripId });
     } catch (error) {
          logger.error('Error releasing distributed capacity locks', { error: error.message, tripId });
     }
}

async function forceReleaseCapacityLocks(tripId, capacityUnitIds, fromSeq, toSeq) {
     const keys = buildCapacityLockKeys(tripId, capacityUnitIds, fromSeq, toSeq);
     try {
          if (keys.length > 0) {
               await redis.del(...keys);
               logger.info(`Force-released ${keys.length} capacity lock(s)`, { tripId });
          }
     } catch (error) {
          logger.error('Error force-releasing capacity locks', { error: error.message, tripId });
     }
}

module.exports = {
     buildCapacityLockKeys,
     acquireCapacityLocks,
     releaseCapacityLocks,
     forceReleaseCapacityLocks,
};
