const prisma = require('../config/prisma');
const logger = require('../config/logger');
const inventoryProducer = require('../kafka/producer/inventory.producer');
const { retryTransaction } = require('../utils/retryTransaction');
const { BadRequestError, NotFoundError, ConflictError, ForbiddenError } = require('../utils/error');
const { config } = require('../config');

// ─── Kafka Event Handlers ───────────────────────────────────────────────────

const initializeTripInventory = async (eventData) => {
     const {
          tripId,
          vehicleId,
          vehicleNumber,
          vehicleName,
          vehicleType,
          departureDate,
          capacityUnits,
          route = [],
     } = eventData;

     if (!tripId || !Array.isArray(capacityUnits) || capacityUnits.length === 0) {
          logger.warn('Invalid CARGO_TRIP_CREATED event — missing tripId or capacityUnits');
          return;
     }

     const eventKey = `CARGO_TRIP_CREATED:${tripId}`;

     const existing = await prisma.idempotencyRecord.findUnique({ where: { eventKey } });
     if (existing) {
          logger.info(`Duplicate event skipped: ${eventKey}`);
          return;
     }

     const totalCapacityUnits = capacityUnits.length;

     await prisma.$transaction(async (tx) => {
          const trip = await tx.tripInventory.create({
               data: {
                    tripId,
                    vehicleId,
                    vehicleNumber,
                    vehicleName,
                    vehicleType,
                    departureDate: new Date(departureDate),
                    totalCapacityUnits,
                    available: totalCapacityUnits,
                    locked: 0,
                    booked: 0,
                    status: 'ACTIVE',
               },
          });

          const capacityUnitData = capacityUnits.map(capacityUnit => ({
               tripInventoryId: trip.id,
               tripId,
               capacityUnitId: capacityUnit.capacityUnitId,
               unitNumber: capacityUnit.unitNumber,
               unitType: capacityUnit.unitType,
               price: capacityUnit.price,
               maxWeightKg: capacityUnit.maxWeightKg,
               status: 'AVAILABLE',
          }));

          await tx.capacityUnitInventory.createMany({ data: capacityUnitData });

          // --- SEGMENT BOOKING: Persist route topology for segment overlap checks ---
          if (Array.isArray(route) && route.length > 0) {
               const tripRouteHubData = route.map(rs => ({
                    tripId,
                    hubId: rs.hubId,
                    hubName: rs.hubName,
                    hubCode: rs.hubCode,
                    sequenceNumber: rs.sequenceNumber,
               }));
               await tx.tripRouteHub.createMany({ data: tripRouteHubData });
               logger.info(`Persisted ${tripRouteHubData.length} route hubs for trip ${tripId}`);
          }

          await tx.idempotencyRecord.create({ data: { eventKey } });
     });

     logger.info(`Inventory initialized for trip ${tripId} with ${totalCapacityUnits} capacityUnits`);

     try {
          await inventoryProducer.publishCapacityAvailabilityUpdated(tripId, vehicleId, totalCapacityUnits, 0, 0);
     } catch (err) {
          logger.error('Failed to publish initial availability event after retries', { tripId, error: err.message });
     }
};

const cancelTripInventory = async (eventData) => {
     const data = eventData.data || eventData;
     const tripId = data.tripId || data.id;

     if (!tripId) {
          logger.warn('Invalid CARGO_TRIP_CANCELLED event — missing tripId');
          return;
     }

     const eventKey = `CARGO_TRIP_CANCELLED:${tripId}`;

     const existing = await prisma.idempotencyRecord.findUnique({ where: { eventKey } });
     if (existing) {
          logger.info(`Duplicate event skipped: ${eventKey}`);
          return;
     }

     const trip = await prisma.tripInventory.findUnique({ where: { tripId } });
     if (!trip) {
          logger.warn(`Trip ${tripId} not found in inventory — skipping cancellation`);
          return;
     }

     await prisma.$transaction(async (tx) => {
          await tx.tripInventory.update({
               where: { tripId },
               data: { status: 'CANCELLED', available: 0, locked: 0, booked: 0, version: { increment: 1 } },
          });

          await tx.capacityUnitInventory.updateMany({
               where: { tripId },
               data: { status: 'CANCELLED' },
          });

          await tx.capacitySegmentLock.updateMany({
               where: { tripId },
               data: { status: 'CANCELLED' },
          });

          await tx.idempotencyRecord.create({ data: { eventKey } });
     });

     logger.info(`Inventory cancelled for trip ${tripId}`);

     try {
          await inventoryProducer.publishCapacityAvailabilityUpdated(tripId, trip.vehicleId, 0, 0, 0);
     } catch (err) {
          logger.error('Failed to publish cancellation availability event after retries', { tripId, error: err.message });
     }
};

// ─── Segment Booking Helpers ─────────────────────────────────────────────────

/**
 * Recompute CapacityUnitInventory.status for a set of capacityUnits based on their current
 * CapacitySegmentLock rows.  Each physical capacityUnit gets exactly ONE summary status:
 *   - AVAILABLE  → no active segment locks at all
 *   - LOCKED     → at least one LOCKED segment lock exists
 *   - BOOKED     → all active segment locks are BOOKED (none LOCKED)
 *
 * Returns the count of capacityUnits whose status actually changed to/from AVAILABLE
 * so the caller can decide whether aggregate counters need adjusting.
 */
async function recomputeSegmentCapacityStatuses(tx, tripId, capacityUnitIds) {
     const statusChanges = { nowAvailable: 0, nowOccupied: 0, lockedToBooked: 0, bookedToLocked: 0 };

     for (const capacityUnitId of capacityUnitIds) {
          const locks = await tx.capacitySegmentLock.findMany({
               where: { tripId, capacityUnitId, status: { in: ['LOCKED', 'BOOKED'] } },
               select: { status: true },
          });

          // Determine the correct summary status
          let newStatus;
          if (locks.length === 0) {
               newStatus = 'AVAILABLE';
          } else if (locks.some(l => l.status === 'LOCKED')) {
               newStatus = 'LOCKED';
          } else {
               newStatus = 'BOOKED';
          }

          // Read current status to detect transitions
          const current = await tx.$queryRaw`
               SELECT status FROM capacity_unit_inventories
               WHERE "tripId" = ${tripId} AND "capacityUnitId" = ${capacityUnitId}
               FOR UPDATE NOWAIT
          `;
          const oldStatus = current[0]?.status;

          if (oldStatus === newStatus) continue; // no change needed

          // Track transitions for aggregate counter adjustment
          if (oldStatus === 'AVAILABLE' && newStatus !== 'AVAILABLE') statusChanges.nowOccupied++;
          if (oldStatus !== 'AVAILABLE' && newStatus === 'AVAILABLE') statusChanges.nowAvailable++;
          if (oldStatus === 'LOCKED' && newStatus === 'BOOKED') statusChanges.lockedToBooked++;
          if (oldStatus === 'BOOKED' && newStatus === 'LOCKED') statusChanges.bookedToLocked++;

          // Update the summary row
          await tx.$executeRaw`
               UPDATE capacity_unit_inventories
               SET status = ${newStatus}::"CapacityStatus",
                   "lockedBy" = CASE WHEN ${newStatus} = 'AVAILABLE' THEN NULL ELSE "lockedBy" END,
                   "lockedAt" = CASE WHEN ${newStatus} = 'AVAILABLE' THEN NULL ELSE "lockedAt" END,
                   "lockExpiresAt" = CASE WHEN ${newStatus} = 'AVAILABLE' THEN NULL ELSE "lockExpiresAt" END,
                   "bookingId" = CASE WHEN ${newStatus} = 'AVAILABLE' THEN NULL ELSE "bookingId" END,
                   version = version + 1, "updatedAt" = NOW()
               WHERE "tripId" = ${tripId} AND "capacityUnitId" = ${capacityUnitId}
          `;
     }

     return statusChanges;
}

/**
 * Recount trip_inventories aggregate columns from actual capacity_unit_inventories rows.
 * This is the source of truth — avoids counter drift from arithmetic updates.
 */
async function recountTripAggregates(tx, tripId) {
     const counts = await tx.$queryRaw`
          SELECT
               COUNT(*) FILTER (WHERE status = 'AVAILABLE')::int AS available,
               COUNT(*) FILTER (WHERE status = 'LOCKED')::int AS locked,
               COUNT(*) FILTER (WHERE status = 'BOOKED')::int AS booked
          FROM capacity_unit_inventories
          WHERE "tripId" = ${tripId}
     `;

     const { available, locked, booked } = counts[0];

     await tx.$executeRaw`
          UPDATE trip_inventories
          SET available = ${available}, locked = ${locked}, booked = ${booked},
              version = version + 1, "updatedAt" = NOW()
          WHERE "tripId" = ${tripId}
     `;

     return { available, locked, booked };
}

// ─── REST API Handlers ──────────────────────────────────────────────────────

const getAvailability = async (tripId) => {
     const trip = await prisma.tripInventory.findUnique({ where: { tripId } });
     if (!trip) throw new NotFoundError('Trip not found in inventory');

     return {
          tripId: trip.tripId,
          vehicleId: trip.vehicleId,
          vehicleNumber: trip.vehicleNumber,
          vehicleName: trip.vehicleName,
          vehicleType: trip.vehicleType,
          departureDate: trip.departureDate,
          status: trip.status,
          totalCapacityUnits: trip.totalCapacityUnits,
          available: trip.available,
          locked: trip.locked,
          booked: trip.booked,
     };
};

const getCapacityUnits = async (tripId, filters = {}) => {
     const trip = await prisma.tripInventory.findUnique({ where: { tripId } });
     if (!trip) throw new NotFoundError('Trip not found in inventory');

     const where = { tripId };
     if (filters.status) where.status = filters.status;
     if (filters.unitType) where.unitType = filters.unitType;

     let capacityUnits = await prisma.capacityUnitInventory.findMany({
          where,
          orderBy: { unitNumber: 'asc' },
          select: {
               capacityUnitId: true,
               unitNumber: true,
               unitType: true,
               price: true,
               maxWeightKg: true,
               status: true,
               lockedBy: true,
               lockExpiresAt: true,
               bookingId: true,
          },
     });

     // --- SEGMENT BOOKING: If segment specified, compute per-capacityUnit segment availability ---
     if (filters.fromSeq && filters.toSeq) {
          const fromSeq = parseInt(filters.fromSeq);
          const toSeq = parseInt(filters.toSeq);

          // Find all active segment locks that overlap with the requested segment
          const overlappingLocks = await prisma.capacitySegmentLock.findMany({
               where: {
                    tripId,
                    status: { in: ['LOCKED', 'BOOKED'] },
                    fromSeq: { lt: toSeq },   // overlap condition: a.from < b.to
                    toSeq: { gt: fromSeq },    // overlap condition: b.from < a.to
               },
               select: { capacityUnitId: true, status: true },
          });

          const blockedCapacityUnitIds = new Set(overlappingLocks.map(l => l.capacityUnitId));

          // --- SEGMENT BOOKING: Find capacityUnits that have ANY segment locks (to distinguish legacy bookings) ---
          const capacityUnitsWithAnyLock = await prisma.capacitySegmentLock.findMany({
               where: { tripId, status: { in: ['LOCKED', 'BOOKED'] } },
               select: { capacityUnitId: true },
               distinct: ['capacityUnitId'],
          });
          const capacityUnitsWithLocks = new Set(capacityUnitsWithAnyLock.map(l => l.capacityUnitId));

          // Add segmentStatus: UNAVAILABLE if overlapping lock exists, or if capacityUnit is
          // BOOKED/LOCKED with no segment locks at all (legacy pre-segment booking).
          // AVAILABLE only if no overlapping locks AND (capacityUnit has segment locks OR capacityUnit is AVAILABLE).
          capacityUnits = capacityUnits.map(capacityUnit => {
               if (blockedCapacityUnitIds.has(capacityUnit.capacityUnitId)) {
                    return { ...capacityUnit, segmentStatus: 'UNAVAILABLE' };
               }
               // Legacy booking: capacityUnit is BOOKED/LOCKED but has no segment lock records
               // → treat as booked for entire journey (backward compat)
               if ((capacityUnit.status === 'BOOKED' || capacityUnit.status === 'LOCKED') && !capacityUnitsWithLocks.has(capacityUnit.capacityUnitId)) {
                    return { ...capacityUnit, segmentStatus: 'UNAVAILABLE' };
               }
               return { ...capacityUnit, segmentStatus: 'AVAILABLE' };
          });
     }

     return {
          tripId,
          totalCapacityUnits: trip.totalCapacityUnits,
          capacityUnits,
     };
};

// --- SEGMENT BOOKING: Added fromSeq/toSeq params for segment-aware locking ---
const lockCapacityUnits = async (tripId, capacityUnitIds, userId, ttlSeconds, fromSeq, toSeq) => {
     const ttl = Math.min(Math.max(ttlSeconds || config.LOCK_TTL_SECONDS, 60), 600);
     const lockExpiresAt = new Date(Date.now() + ttl * 1000);

     const result = await retryTransaction(async () => {
          return prisma.$transaction(async (tx) => {
               // Verify trip is active
               const trip = await tx.tripInventory.findUnique({ where: { tripId } });
               if (!trip) throw new NotFoundError('Trip not found in inventory');
               if (trip.status !== 'ACTIVE') throw new BadRequestError('Trip is not active');

               // Row-level lock on requested capacityUnits
               const capacityUnits = await tx.$queryRaw`
                    SELECT id, "capacityUnitId", "unitNumber", status, "lockedBy"
                    FROM capacity_unit_inventories
                    WHERE "tripId" = ${tripId}
                    AND "capacityUnitId" = ANY(${capacityUnitIds}::text[])
                    FOR UPDATE NOWAIT
               `;

               // All capacityUnits must exist
               if (capacityUnits.length !== capacityUnitIds.length) {
                    const foundIds = new Set(capacityUnits.map(s => s.capacityUnitId));
                    const missing = capacityUnitIds.filter(id => !foundIds.has(id));
                    throw new NotFoundError(`Capacity units not found: ${missing.join(', ')}`);
               }

               // --- SEGMENT BOOKING: Check segment-level availability instead of full-journey ---
               if (fromSeq && toSeq) {
                    // Check for overlapping segment locks on any of the requested capacityUnits
                    const overlapping = await tx.$queryRaw`
                         SELECT "capacityUnitId" FROM capacity_segment_locks
                         WHERE "tripId" = ${tripId}
                         AND "capacityUnitId" = ANY(${capacityUnitIds}::text[])
                         AND status IN ('LOCKED', 'BOOKED')
                         AND "fromSeq" < ${toSeq}
                         AND "toSeq" > ${fromSeq}
                         FOR UPDATE NOWAIT
                    `;

                    if (overlapping.length > 0) {
                         const blockedIds = [...new Set(overlapping.map(r => r.capacityUnitId))];
                         throw new ConflictError(
                              `Capacity units already locked/booked for overlapping segment: ${blockedIds.join(', ')}`,
                              'CAPACITY_UNITS_UNAVAILABLE'
                         );
                    }

                    // Create segment lock rows for the requested segment
                    for (const capacityUnit of capacityUnits) {
                         await tx.capacitySegmentLock.create({
                              data: {
                                   tripId,
                                   capacityUnitId: capacityUnit.capacityUnitId,
                                   fromSeq,
                                   toSeq,
                                   status: 'LOCKED',
                                   lockedBy: userId,
                                   lockedAt: new Date(),
                                   lockExpiresAt,
                              },
                         });
                    }
               } else {
                    // Fallback: full-journey lock (no segment) — all capacityUnits must be AVAILABLE
                    const unavailable = capacityUnits.filter(s => s.status !== 'AVAILABLE');
                    if (unavailable.length > 0) {
                         throw new ConflictError(
                              `Capacity units not available: ${unavailable.map(s => `capacityUnit #${s.unitNumber} is ${s.status}`).join(', ')}`,
                              'CAPACITY_UNITS_UNAVAILABLE'
                         );
                    }
               }

               // --- SEGMENT BOOKING: Recompute capacityUnit statuses from segment locks ---
               if (fromSeq && toSeq) {
                    // Set lockedBy/lockedAt/lockExpiresAt on capacityUnits that didn't have it yet
                    const capacityUnitPkIds = capacityUnits.map(s => s.id);
                    await tx.$executeRaw`
                         UPDATE capacity_unit_inventories
                         SET "lockedBy" = COALESCE("lockedBy", ${userId}),
                             "lockedAt" = COALESCE("lockedAt", NOW()),
                             "lockExpiresAt" = ${lockExpiresAt}::timestamp,
                             "updatedAt" = NOW()
                         WHERE id = ANY(${capacityUnitPkIds}::text[])
                    `;

                    // Recompute each capacityUnit's summary status from its segment locks
                    const affectedCapacityUnitIds = capacityUnits.map(s => s.capacityUnitId);
                    await recomputeSegmentCapacityStatuses(tx, tripId, affectedCapacityUnitIds);

                    // Recount aggregates from actual capacityUnit rows (prevents counter drift)
                    const counts = await recountTripAggregates(tx, tripId);

                    return {
                         tripId,
                         vehicleId: trip.vehicleId,
                         lockedCapacityUnits: capacityUnits.map(s => ({
                              capacityUnitId: s.capacityUnitId,
                              unitNumber: s.unitNumber,
                              lockExpiresAt,
                         })),
                         lockExpiresAt,
                         counts,
                    };
               }

               // Full-journey: unconditional lock (original fast path)
               const capacityUnitPkIds = capacityUnits.map(s => s.id);
               await tx.$executeRaw`
                    UPDATE capacity_unit_inventories
                    SET status = 'LOCKED', "lockedBy" = ${userId},
                        "lockedAt" = NOW(), "lockExpiresAt" = ${lockExpiresAt}::timestamp,
                        version = version + 1, "updatedAt" = NOW()
                    WHERE id = ANY(${capacityUnitPkIds}::text[])
               `;

               await tx.$executeRaw`
                    UPDATE trip_inventories
                    SET available = available - ${capacityUnits.length},
                        locked = locked + ${capacityUnits.length},
                        version = version + 1,
                        "updatedAt" = NOW()
                    WHERE "tripId" = ${tripId}
               `;

               return {
                    tripId,
                    vehicleId: trip.vehicleId,
                    lockedCapacityUnits: capacityUnits.map(s => ({
                         capacityUnitId: s.capacityUnitId,
                         unitNumber: s.unitNumber,
                         lockExpiresAt,
                    })),
                    lockExpiresAt,
                    counts: {
                         available: trip.available - capacityUnits.length,
                         locked: trip.locked + capacityUnits.length,
                         booked: trip.booked,
                    },
               };
          }, { timeout: 10000 });
     });

     // Publish availability update (fire and forget)
     try {
          await inventoryProducer.publishCapacityAvailabilityUpdated(
               result.tripId, result.vehicleId,
               result.counts.available, result.counts.locked, result.counts.booked
          );
     } catch (err) {
          logger.error('Failed to publish availability after lock', { tripId: result.tripId, error: err.message });
     }

     return result;
};

// --- SEGMENT BOOKING: Added fromSeq/toSeq params for segment-aware unlocking ---
const unlockCapacityUnits = async (tripId, capacityUnitIds, userId, fromSeq, toSeq) => {
     const result = await retryTransaction(async () => {
          return prisma.$transaction(async (tx) => {
               // Row-level lock
               const capacityUnits = await tx.$queryRaw`
                    SELECT id, "capacityUnitId", "unitNumber", status, "lockedBy"
                    FROM capacity_unit_inventories
                    WHERE "tripId" = ${tripId}
                    AND "capacityUnitId" = ANY(${capacityUnitIds}::text[])
                    FOR UPDATE NOWAIT
               `;

               if (capacityUnits.length !== capacityUnitIds.length) {
                    throw new NotFoundError('One or more capacityUnits not found');
               }

               // --- SEGMENT BOOKING: Segment-aware unlock ---
               if (fromSeq && toSeq) {
                    // Delete specific segment locks for this user/segment
                    await tx.$executeRaw`
                         DELETE FROM capacity_segment_locks
                         WHERE "tripId" = ${tripId}
                         AND "capacityUnitId" = ANY(${capacityUnitIds}::text[])
                         AND "lockedBy" = ${userId}
                         AND "fromSeq" = ${fromSeq}
                         AND "toSeq" = ${toSeq}
                         AND status = 'LOCKED'
                    `;

                    // Recompute capacityUnit statuses + aggregates from actual segment lock state
                    const affectedCapacityUnitIds = capacityUnits.map(s => s.capacityUnitId);
                    await recomputeSegmentCapacityStatuses(tx, tripId, affectedCapacityUnitIds);
                    const counts = await recountTripAggregates(tx, tripId);

                    const trip = await tx.tripInventory.findUnique({ where: { tripId } });

                    return {
                         tripId,
                         vehicleId: trip.vehicleId,
                         unlockedCapacityUnits: capacityUnits.map(s => s.capacityUnitId),
                         counts,
                    };
               }

               // Fallback: full-journey unlock (no segment params)
               // All must be LOCKED
               const notLocked = capacityUnits.filter(s => s.status !== 'LOCKED');
               if (notLocked.length > 0) {
                    throw new ConflictError(
                         `Capacity units not in LOCKED status: ${notLocked.map(s => `capacityUnit #${s.unitNumber} is ${s.status}`).join(', ')}`
                    );
               }

               // All must be locked by this user
               const notOwnedByUser = capacityUnits.filter(s => s.lockedBy !== userId);
               if (notOwnedByUser.length > 0) {
                    throw new ForbiddenError('Some capacityUnits are not locked by you');
               }

               // Unlock
               const capacityUnitPkIds = capacityUnits.map(s => s.id);
               await tx.$executeRaw`
                    UPDATE capacity_unit_inventories
                    SET status = 'AVAILABLE', "lockedBy" = NULL,
                        "lockedAt" = NULL, "lockExpiresAt" = NULL,
                        version = version + 1, "updatedAt" = NOW()
                    WHERE id = ANY(${capacityUnitPkIds}::text[])
               `;

               const trip = await tx.tripInventory.findUnique({ where: { tripId } });

               await tx.$executeRaw`
                    UPDATE trip_inventories
                    SET available = available + ${capacityUnits.length},
                        locked = locked - ${capacityUnits.length},
                        version = version + 1,
                        "updatedAt" = NOW()
                    WHERE "tripId" = ${tripId}
               `;

               return {
                    tripId,
                    vehicleId: trip.vehicleId,
                    unlockedCapacityUnits: capacityUnits.map(s => s.capacityUnitId),
                    counts: {
                         available: trip.available + capacityUnits.length,
                         locked: trip.locked - capacityUnits.length,
                         booked: trip.booked,
                    },
               };
          }, { timeout: 10000 });
     });

     try {
          await inventoryProducer.publishCapacityAvailabilityUpdated(
               result.tripId, result.vehicleId,
               result.counts.available, result.counts.locked, result.counts.booked
          );
     } catch (err) {
          logger.error('Failed to publish availability after unlock', { tripId: result.tripId, error: err.message });
     }

     return result;
};

// --- SEGMENT BOOKING: Added fromSeq/toSeq params for segment-aware confirmation ---
const confirmCapacityUnits = async (tripId, capacityUnitIds, userId, bookingId, fromSeq, toSeq) => {
     const result = await retryTransaction(async () => {
          return prisma.$transaction(async (tx) => {
               const capacityUnits = await tx.$queryRaw`
                    SELECT id, "capacityUnitId", "unitNumber", status, "lockedBy"
                    FROM capacity_unit_inventories
                    WHERE "tripId" = ${tripId}
                    AND "capacityUnitId" = ANY(${capacityUnitIds}::text[])
                    FOR UPDATE NOWAIT
               `;

               if (capacityUnits.length !== capacityUnitIds.length) {
                    throw new NotFoundError('One or more capacityUnits not found');
               }

               // --- SEGMENT BOOKING: Confirm segment locks if segment params provided ---
               if (fromSeq && toSeq) {
                    // Transition segment lock rows from LOCKED → BOOKED
                    const updated = await tx.$executeRaw`
                         UPDATE capacity_segment_locks
                         SET status = 'BOOKED', "bookingId" = ${bookingId},
                             "lockExpiresAt" = NULL,
                             version = version + 1, "updatedAt" = NOW()
                         WHERE "tripId" = ${tripId}
                         AND "capacityUnitId" = ANY(${capacityUnitIds}::text[])
                         AND "lockedBy" = ${userId}
                         AND "fromSeq" = ${fromSeq}
                         AND "toSeq" = ${toSeq}
                         AND status = 'LOCKED'
                    `;

                    if (updated === 0) {
                         throw new ConflictError(
                              'Segment lock expired or not found. Please lock capacityUnits again.',
                              'LOCK_EXPIRED'
                         );
                    }
               } else {
                    // Fallback: full-journey confirmation checks
                    const notLocked = capacityUnits.filter(s => s.status !== 'LOCKED');
                    if (notLocked.length > 0) {
                         throw new ConflictError(
                              'Lock expired or capacityUnits not in LOCKED status. Please lock capacityUnits again.',
                              'LOCK_EXPIRED'
                         );
                    }

                    const notOwnedByUser = capacityUnits.filter(s => s.lockedBy !== userId);
                    if (notOwnedByUser.length > 0) {
                         throw new ForbiddenError('Some capacityUnits are not locked by you');
                    }
               }

               // --- SEGMENT BOOKING: Recompute capacityUnit statuses after segment lock transition ---
               if (fromSeq && toSeq) {
                    const affectedCapacityUnitIds = capacityUnits.map(s => s.capacityUnitId);
                    await recomputeSegmentCapacityStatuses(tx, tripId, affectedCapacityUnitIds);
                    const counts = await recountTripAggregates(tx, tripId);

                    const trip = await tx.tripInventory.findUnique({ where: { tripId } });

                    return {
                         tripId,
                         vehicleId: trip.vehicleId,
                         bookingId,
                         confirmedCapacityUnits: capacityUnits.map(s => ({
                              capacityUnitId: s.capacityUnitId,
                              unitNumber: s.unitNumber,
                              status: 'BOOKED',
                         })),
                         counts,
                    };
               }

               // Full-journey: unconditional confirm (original fast path)
               const capacityUnitPkIds = capacityUnits.map(s => s.id);
               await tx.$executeRaw`
                    UPDATE capacity_unit_inventories
                    SET status = 'BOOKED', "bookingId" = ${bookingId},
                        "lockExpiresAt" = NULL,
                        version = version + 1, "updatedAt" = NOW()
                    WHERE id = ANY(${capacityUnitPkIds}::text[])
               `;

               const trip = await tx.tripInventory.findUnique({ where: { tripId } });

               await tx.$executeRaw`
                    UPDATE trip_inventories
                    SET locked = locked - ${capacityUnits.length},
                        booked = booked + ${capacityUnits.length},
                        version = version + 1,
                        "updatedAt" = NOW()
                    WHERE "tripId" = ${tripId}
               `;

               return {
                    tripId,
                    vehicleId: trip.vehicleId,
                    bookingId,
                    confirmedCapacityUnits: capacityUnits.map(s => ({
                         capacityUnitId: s.capacityUnitId,
                         unitNumber: s.unitNumber,
                         status: 'BOOKED',
                    })),
                    counts: {
                         available: trip.available,
                         locked: trip.locked - capacityUnits.length,
                         booked: trip.booked + capacityUnits.length,
                    },
               };
          }, { timeout: 10000 });
     });

     try {
          await inventoryProducer.publishCapacityAvailabilityUpdated(
               result.tripId, result.vehicleId,
               result.counts.available, result.counts.locked, result.counts.booked
          );
     } catch (err) {
          logger.error('Failed to publish availability after confirm', { tripId: result.tripId, error: err.message });
     }

     return result;
};

const cancelBooking = async (tripId, bookingId, userId) => {
     const result = await retryTransaction(async () => {
          return prisma.$transaction(async (tx) => {
               // --- SEGMENT BOOKING: Check segment locks FIRST ---
               // For segment bookings, capacity_unit_inventories.bookingId is not set
               // (only capacity_segment_locks has the bookingId), so we must check here first.
               const segmentLocks = await tx.capacitySegmentLock.findMany({
                    where: { tripId, bookingId, status: 'BOOKED' },
               });

               if (segmentLocks.length > 0) {
                    await tx.$executeRaw`
                         DELETE FROM capacity_segment_locks
                         WHERE "tripId" = ${tripId}
                         AND "bookingId" = ${bookingId}
                    `;

                    // Recompute capacityUnit statuses + aggregates from actual segment lock state
                    const affectedCapacityUnitIds = [...new Set(segmentLocks.map(l => l.capacityUnitId))];
                    await recomputeSegmentCapacityStatuses(tx, tripId, affectedCapacityUnitIds);
                    const counts = await recountTripAggregates(tx, tripId);

                    const trip = await tx.tripInventory.findUnique({ where: { tripId } });

                    return {
                         tripId,
                         vehicleId: trip.vehicleId,
                         bookingId,
                         releasedCapacityUnits: affectedCapacityUnitIds,
                         counts,
                    };
               }
               // --- END SEGMENT BOOKING ---

               // Fallback: full-journey cancel (no segment locks found)
               const capacityUnits = await tx.$queryRaw`
                    SELECT id, "capacityUnitId", "unitNumber", status, "lockedBy"
                    FROM capacity_unit_inventories
                    WHERE "tripId" = ${tripId}
                    AND "bookingId" = ${bookingId}
                    AND status = 'BOOKED'
                    FOR UPDATE NOWAIT
               `;

               if (capacityUnits.length === 0) {
                    throw new NotFoundError('No booked capacityUnits found for this booking');
               }

               const capacityUnitPkIds = capacityUnits.map(s => s.id);
               await tx.$executeRaw`
                    UPDATE capacity_unit_inventories
                    SET status = 'AVAILABLE', "lockedBy" = NULL,
                        "lockedAt" = NULL, "lockExpiresAt" = NULL, "bookingId" = NULL,
                        version = version + 1, "updatedAt" = NOW()
                    WHERE id = ANY(${capacityUnitPkIds}::text[])
               `;

               const trip = await tx.tripInventory.findUnique({ where: { tripId } });

               await tx.$executeRaw`
                    UPDATE trip_inventories
                    SET available = available + ${capacityUnits.length},
                        booked = booked - ${capacityUnits.length},
                        version = version + 1,
                        "updatedAt" = NOW()
                    WHERE "tripId" = ${tripId}
               `;

               return {
                    tripId,
                    vehicleId: trip.vehicleId,
                    bookingId,
                    releasedCapacityUnits: capacityUnits.map(s => s.capacityUnitId),
                    counts: {
                         available: trip.available + capacityUnits.length,
                         locked: trip.locked,
                         booked: trip.booked - capacityUnits.length,
                    },
               };
          }, { timeout: 10000 });
     });

     try {
          await inventoryProducer.publishCapacityAvailabilityUpdated(
               result.tripId, result.vehicleId,
               result.counts.available, result.counts.locked, result.counts.booked
          );
     } catch (err) {
          logger.error('Failed to publish availability after cancel-booking', { tripId: result.tripId, error: err.message });
     }

     return result;
};

// ─── Lock Expiry Helper (used by lockExpiry.js) ─────────────────────────────

const recountAndPublish = async (tripId) => {
     const counts = await prisma.$queryRaw`
          SELECT
               COUNT(*) FILTER (WHERE status = 'AVAILABLE')::int AS available,
               COUNT(*) FILTER (WHERE status = 'LOCKED')::int AS locked,
               COUNT(*) FILTER (WHERE status = 'BOOKED')::int AS booked
          FROM capacity_unit_inventories
          WHERE "tripId" = ${tripId}
     `;

     const { available, locked, booked } = counts[0];

     const trip = await prisma.tripInventory.update({
          where: { tripId },
          data: { available, locked, booked, version: { increment: 1 } },
     });

     try {
          await inventoryProducer.publishCapacityAvailabilityUpdated(tripId, trip.vehicleId, available, locked, booked);
     } catch (err) {
          logger.error('Failed to publish availability after recount', { tripId, error: err.message });
     }

     return { available, locked, booked };
};

module.exports = {
     initializeTripInventory,
     cancelTripInventory,
     getAvailability,
     getCapacityUnits,
     lockCapacityUnits,
     unlockCapacityUnits,
     confirmCapacityUnits,
     cancelBooking,
     recountAndPublish,
     recomputeSegmentCapacityStatuses,
};
