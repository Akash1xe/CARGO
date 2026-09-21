const prisma = require('../config/prisma');
const logger = require('../config/logger');
const { config } = require('../config');
const { recountAndPublish, recomputeSegmentCapacityStatuses } = require('../services/inventory.service');

let intervalHandle = null;

// PostgreSQL advisory lock ID for leader election.
// Only one instance holds this lock at a time (try-lock, non-blocking).
const ADVISORY_LOCK_ID = 800001;

/**
 * Try to become the leader for this expiry cycle using pg_try_advisory_lock.
 * Returns true if this instance acquired the lock. The lock is session-level
 * and released explicitly after the job finishes.
 */
async function tryAcquireLeadership() {
     try {
          const result = await prisma.$queryRaw`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID}) AS acquired`;
          return result[0].acquired === true;
     } catch (err) {
          logger.error('Failed to acquire lock expiry leadership', { error: err.message });
          return false;
     }
}

async function releaseLeadership() {
     try {
          await prisma.$queryRaw`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})`;
     } catch (err) {
          logger.error('Failed to release lock expiry leadership', { error: err.message });
     }
}

async function cleanExpiredLocks() {
     const isLeader = await tryAcquireLeadership();
     if (!isLeader) {
          logger.debug('Skipping lock expiry job — another instance is the leader');
          return;
     }

     try {
          // --- SEGMENT BOOKING: Clean expired segment locks first ---
          try {
               const expiredCapacitySegmentLocks = await prisma.capacitySegmentLock.findMany({
                    where: { status: 'LOCKED', lockExpiresAt: { lt: new Date() } },
                    select: { id: true, tripId: true, capacityUnitId: true },
               });

               if (expiredCapacitySegmentLocks.length > 0) {
                    logger.info(`Found ${expiredCapacitySegmentLocks.length} expired segment lock(s) to clean up`);

                    const capacitySegmentIds = expiredCapacitySegmentLocks.map(l => l.id);
                    await prisma.$executeRaw`
                         DELETE FROM capacity_segment_locks WHERE id = ANY(${capacitySegmentIds}::text[])
                    `;

                    // Group by tripId → Set<capacityUnitId> for recomputing CapacityUnitInventory
                    const affectedTripCapacityUnits = new Map();
                    for (const lock of expiredCapacitySegmentLocks) {
                         if (!affectedTripCapacityUnits.has(lock.tripId)) {
                              affectedTripCapacityUnits.set(lock.tripId, new Set());
                         }
                         affectedTripCapacityUnits.get(lock.tripId).add(lock.capacityUnitId);
                    }

                    for (const [tripId, capacityUnitIdSet] of affectedTripCapacityUnits) {
                         // Recompute each capacityUnit's summary status from remaining segment locks.
                         // This correctly handles all transitions: LOCKED→AVAILABLE, LOCKED→BOOKED, etc.
                         await prisma.$transaction(async (tx) => {
                              await recomputeSegmentCapacityStatuses(tx, tripId, [...capacityUnitIdSet]);
                         });
                         await recountAndPublish(tripId);
                    }

                    logger.info(`Cleaned ${expiredCapacitySegmentLocks.length} expired segment lock(s)`);
               }
          } catch (segErr) {
               logger.error('Segment lock expiry cleanup failed', { error: segErr.message });
          }
          // --- END SEGMENT BOOKING ---

          // Find all expired locked capacityUnits (original full-journey lock expiry)
          const expiredCapacityUnits = await prisma.capacityUnitInventory.findMany({
               where: {
                    status: 'LOCKED',
                    lockExpiresAt: { lt: new Date() },
               },
               select: {
                    id: true,
                    tripId: true,
                    unitNumber: true,
               },
          });

          if (expiredCapacityUnits.length === 0) return;

          logger.info(`Found ${expiredCapacityUnits.length} expired capacityUnit lock(s) to clean up`);

          // Group by tripId
          const byTrip = {};
          for (const capacityUnit of expiredCapacityUnits) {
               if (!byTrip[capacityUnit.tripId]) byTrip[capacityUnit.tripId] = [];
               byTrip[capacityUnit.tripId].push(capacityUnit);
          }

          for (const [tripId, capacityUnits] of Object.entries(byTrip)) {
               try {
                    const capacityUnitPkIds = capacityUnits.map(s => s.id);

                    // Release the expired locks
                    await prisma.$executeRaw`
                         UPDATE capacity_unit_inventories
                         SET status = 'AVAILABLE', "lockedBy" = NULL,
                             "lockedAt" = NULL, "lockExpiresAt" = NULL,
                             version = version + 1, "updatedAt" = NOW()
                         WHERE id = ANY(${capacityUnitPkIds}::text[])
                         AND status = 'LOCKED'
                    `;

                    // Recount from actual capacityUnit rows to prevent counter drift
                    await recountAndPublish(tripId);

                    logger.info(`Released ${capacityUnits.length} expired lock(s) for trip ${tripId}`);
               } catch (err) {
                    logger.error(`Failed to clean expired locks for trip ${tripId}`, {
                         error: err.message,
                    });
               }
          }
     } catch (error) {
          logger.error('Lock expiry cleanup failed', { error: error.message });
     } finally {
          await releaseLeadership();
     }
}

function startLockExpiryJob() {
     // Run once immediately
     cleanExpiredLocks();

     intervalHandle = setInterval(cleanExpiredLocks, config.LOCK_EXPIRY_INTERVAL_MS);
     logger.info(`Lock expiry job started (interval: ${config.LOCK_EXPIRY_INTERVAL_MS}ms)`);
}

function stopLockExpiryJob() {
     if (intervalHandle) {
          clearInterval(intervalHandle);
          intervalHandle = null;
          logger.info('Lock expiry job stopped');
     }
}

module.exports = { startLockExpiryJob, stopLockExpiryJob };
