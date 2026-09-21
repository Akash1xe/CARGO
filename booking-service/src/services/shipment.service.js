const { randomBytes, randomUUID } = require('crypto');
const prisma = require('../config/prisma');
const logger = require('../config/logger');
const { config } = require('../config');
const { inventoryClient } = require('./inventoryClient');
const { paymentClient } = require('./paymentClient');
const { userClient } = require('./userClient');
const { hubClient } = require('./hubClient');
const {
     acquireCapacityLocks,
     releaseCapacityLocks,
     forceReleaseCapacityLocks,
} = require('../utils/distributedLock');
const saga = require('./saga.service');
const shipmentProducer = require('../kafka/producer/shipment.producer');
const { BadRequestError, NotFoundError, ConflictError, StaleStateError } = require('../utils/error');
const { validateCreateInput } = require('../utils/shipmentValidation');

const ACTIVE_STATUSES = ['PENDING', 'CAPACITY_HELD', 'PAYMENT_PENDING', 'CONFIRMED'];
const TERMINAL_STATUSES = ['FAILED', 'CANCELLED', 'EXPIRED'];
const SHIPMENT_STATUSES = [
     'PENDING', 'CAPACITY_HELD', 'PAYMENT_PENDING', 'CONFIRMING', 'CONFIRMED',
     'CANCELLING', 'FAILED', 'CANCELLED', 'EXPIRED',
];

const casUpdateShipment = async (shipmentBookingId, expectedVersion, data) => {
     const result = await prisma.shipmentBooking.updateMany({
          where: { id: shipmentBookingId, version: expectedVersion },
          data: { ...data, version: { increment: 1 } },
     });
     if (result.count === 0) {
          throw new StaleStateError(
               `Shipment ${shipmentBookingId} was modified by another process (expected version ${expectedVersion})`
          );
     }
};

const fetchUserForNotification = async (userId) => {
     try {
          const user = await userClient.getUserById(userId);
          return user ? { email: user.email, firstName: user.firstName } : {};
     } catch (error) {
          logger.warn('Failed to enrich shipment event with user details', { userId, error: error.message });
          return {};
     }
};

const fetchHubName = async (hubId) => {
     try {
          const hub = await hubClient.getHubById(hubId);
          return hub?.name || null;
     } catch (error) {
          logger.warn('Failed to enrich shipment event with hub name', { hubId, error: error.message });
          return null;
     }
};

const buildShipmentEventPayload = async (shipment) => {
     const [userInfo, fromHubName, toHubName] = await Promise.all([
          fetchUserForNotification(shipment.userId),
          fetchHubName(shipment.fromHubId),
          fetchHubName(shipment.toHubId),
     ]);
     return {
          shipmentBookingId: shipment.id,
          trackingNumber: shipment.trackingNumber,
          userId: shipment.userId,
          email: userInfo.email,
          firstName: userInfo.firstName,
          tripId: shipment.tripId,
          vehicleName: shipment.vehicleName,
          vehicleNumber: shipment.vehicleNumber,
          fromHubName,
          toHubName,
          departureDate: shipment.departureDate,
          capacityUnits: (shipment.capacityUnits || []).map(unit => ({
               capacityUnitId: unit.capacityUnitId,
               unitNumber: unit.unitNumber,
               unitType: unit.unitType,
               price: unit.price,
               maxWeightKg: unit.maxWeightKg,
          })),
          packages: (shipment.packages || []).map(item => ({
               description: item.description,
               category: item.category,
               weightKg: item.weightKg,
               declaredValue: item.declaredValue,
               specialInstructions: item.specialInstructions,
               capacityUnitId: item.capacityUnitId,
          })),
          totalAmount: shipment.totalAmount,
     };
};

const generateTrackingNumber = () => {
     const timestamp = Date.now().toString(36).toUpperCase();
     const suffix = randomBytes(4).toString('hex').toUpperCase();
     return `CF-${timestamp}-${suffix}`;
};

const checkIdempotency = async (key) => {
     const existing = await prisma.idempotencyRecord.findUnique({ where: { eventKey: key } });
     return existing?.response || null;
};

const saveIdempotency = async (key, response) => {
     const jsonResponse = JSON.parse(JSON.stringify(response));
     await prisma.idempotencyRecord.upsert({
          where: { eventKey: key },
          create: { eventKey: key, response: jsonResponse },
          update: {},
     });
};

const createShipmentRecord = async (data) => {
     for (let attempt = 1; attempt <= 5; attempt++) {
          try {
               return await prisma.shipmentBooking.create({
                    data: { ...data, trackingNumber: generateTrackingNumber() },
                    include: { capacityUnits: true, packages: true },
               });
          } catch (error) {
               const targets = Array.isArray(error.meta?.target) ? error.meta.target : [error.meta?.target];
               if (error.code !== 'P2002' || !targets.some(target => String(target).includes('trackingNumber'))) {
                    throw error;
               }
               logger.warn(`Tracking-number collision detected; retrying (${attempt}/5)`);
          }
     }
     throw new ConflictError('Unable to allocate a unique tracking number');
};

const serializeShipment = (shipment) => ({
     shipmentBookingId: shipment.id,
     trackingNumber: shipment.trackingNumber,
     status: shipment.status,
     tripId: shipment.tripId,
     vehicleId: shipment.vehicleId,
     vehicleNumber: shipment.vehicleNumber,
     vehicleName: shipment.vehicleName,
     vehicleType: shipment.vehicleType,
     departureDate: shipment.departureDate,
     totalAmount: shipment.totalAmount,
     capacityUnitCount: shipment.capacityUnitCount,
     fromHubId: shipment.fromHubId,
     toHubId: shipment.toHubId,
     fromSeq: shipment.fromSeq,
     toSeq: shipment.toSeq,
     paymentOrderId: shipment.paymentOrderId,
     lockExpiresAt: shipment.lockExpiresAt,
     failureReason: shipment.failureReason,
     capacityUnits: (shipment.capacityUnits || []).map(unit => ({
          capacityUnitId: unit.capacityUnitId,
          unitNumber: unit.unitNumber,
          unitType: unit.unitType,
          price: unit.price,
          maxWeightKg: unit.maxWeightKg,
     })),
     packages: (shipment.packages || []).map(item => ({
          id: item.id,
          description: item.description,
          category: item.category,
          weightKg: item.weightKg,
          declaredValue: item.declaredValue,
          specialInstructions: item.specialInstructions,
          capacityUnitId: item.capacityUnitId,
     })),
     createdAt: shipment.createdAt,
     updatedAt: shipment.updatedAt,
});

const createShipment = async (userId, input) => {
     validateCreateInput(input);
     const {
          tripId, capacityUnitIds, packages, fromHubId, toHubId, fromSeq, toSeq, idempotencyKey,
     } = input;
     const eventKey = `shipment:${idempotencyKey}`;
     const cached = await checkIdempotency(eventKey);
     if (cached) return cached;

     const availability = await inventoryClient.getAvailability(tripId);
     if (availability.status !== 'ACTIVE') throw new BadRequestError('Cargo trip is not active');
     if (new Date(availability.departureDate).getTime() <= Date.now()) {
          throw new BadRequestError('Cannot create a shipment for a departed cargo trip');
     }

     const capacityData = await inventoryClient.getCapacityUnits(tripId, { fromSeq, toSeq });
     const capacityMap = new Map(capacityData.capacityUnits.map(unit => [unit.capacityUnitId, unit]));
     const selectedUnits = capacityUnitIds.map((capacityUnitId, index) => {
          const unit = capacityMap.get(capacityUnitId);
          if (!unit) throw new NotFoundError(`Capacity unit ${capacityUnitId} not found in cargo trip`);
          const isAvailable = unit.segmentStatus !== undefined
               ? unit.segmentStatus === 'AVAILABLE'
               : unit.status === 'AVAILABLE';
          if (!isAvailable) {
               throw new ConflictError(
                    `Capacity unit #${unit.unitNumber} is not available for this segment`,
                    'CAPACITY_UNAVAILABLE'
               );
          }
          if (packages[index].weightKg > unit.maxWeightKg) {
               throw new BadRequestError(
                    `Package at index ${index} exceeds capacity unit #${unit.unitNumber} maximum weight of ${unit.maxWeightKg}kg`
               );
          }
          return unit;
     });

     const totalAmount = selectedUnits.reduce((sum, unit) => sum + unit.price, 0);
     const sortedCapacityUnitIds = [...capacityUnitIds].sort();
     const shipmentBookingId = randomUUID();
     const { acquired, lockValue } = await acquireCapacityLocks(
          tripId,
          sortedCapacityUnitIds,
          shipmentBookingId,
          config.BOOKING_TTL_SECONDS,
          fromSeq,
          toSeq
     );
     if (!acquired) {
          throw new ConflictError(
               'One or more capacity units are being reserved by another user. Please try again.',
               'CAPACITY_LOCKED'
          );
     }

     let shipment;
     try {
          shipment = await createShipmentRecord({
               id: shipmentBookingId,
               userId,
               tripId,
               vehicleId: availability.vehicleId,
               vehicleNumber: availability.vehicleNumber,
               vehicleName: availability.vehicleName,
               vehicleType: availability.vehicleType,
               departureDate: new Date(availability.departureDate),
               status: 'PENDING',
               totalAmount,
               capacityUnitCount: capacityUnitIds.length,
               fromHubId,
               toHubId,
               fromSeq,
               toSeq,
               idempotencyKey,
               lockExpiresAt: new Date(Date.now() + config.BOOKING_TTL_SECONDS * 1000),
               capacityUnits: {
                    create: selectedUnits.map(unit => ({
                         capacityUnitId: unit.capacityUnitId,
                         unitNumber: unit.unitNumber,
                         unitType: unit.unitType,
                         price: unit.price,
                         maxWeightKg: unit.maxWeightKg,
                    })),
               },
               packages: {
                    create: packages.map((item, index) => ({
                         description: item.description.trim(),
                         category: item.category.trim(),
                         weightKg: item.weightKg,
                         declaredValue: item.declaredValue ?? null,
                         specialInstructions: item.specialInstructions || null,
                         capacityUnitId: capacityUnitIds[index],
                    })),
               },
          });

          await saga.executeHoldCapacity(shipment, sortedCapacityUnitIds, config.LOCK_TTL_SECONDS);
          const paymentOrder = await saga.executeCreatePayment(shipment);
          shipment = await prisma.shipmentBooking.findUnique({
               where: { id: shipment.id },
               include: { capacityUnits: true, packages: true },
          });
          const response = {
               ...serializeShipment(shipment),
               paymentOrder: {
                    paymentOrderId: paymentOrder.paymentOrderId,
                    gatewayOrderId: paymentOrder.gatewayOrderId,
                    amount: paymentOrder.amount,
                    currency: paymentOrder.currency,
                    keyId: paymentOrder.keyId,
               },
          };
          await saveIdempotency(eventKey, response);
          return response;
     } catch (error) {
          logger.error(`Shipment creation failed for user ${userId}`, { error: error.message });
          if (shipment) {
               const current = await prisma.shipmentBooking.findUnique({ where: { id: shipment.id } });
               await saga.compensateAll(current || shipment, sortedCapacityUnitIds);
               await prisma.shipmentBooking.update({
                    where: { id: shipment.id },
                    data: { status: 'FAILED', failureReason: error.response?.data?.message || error.message },
               });
          }
          await releaseCapacityLocks(tripId, sortedCapacityUnitIds, lockValue, fromSeq, toSeq);
          throw error;
     }
};

const handlePaymentSuccess = async (paymentOrderId, eventShipmentBookingId) => {
     const shipment = await prisma.shipmentBooking.findUnique({
          where: { paymentOrderId },
          include: { capacityUnits: true, packages: true },
     });
     if (!shipment) {
          logger.warn(`No shipment found for paymentOrderId: ${paymentOrderId}`);
          return;
     }
     if (eventShipmentBookingId && eventShipmentBookingId !== shipment.id) {
          logger.warn('PAYMENT_SUCCESS shipment identifier does not match payment-order lookup', {
               paymentOrderId, eventShipmentBookingId, shipmentBookingId: shipment.id,
          });
     }
     if (shipment.status === 'CONFIRMED') return;
     if (shipment.status !== 'PAYMENT_PENDING') {
          logger.warn(`Shipment ${shipment.id} in unexpected status: ${shipment.status}`);
          return;
     }

     const capacityUnitIds = shipment.capacityUnits.map(unit => unit.capacityUnitId).sort();
     try {
          await casUpdateShipment(shipment.id, shipment.version, { status: 'CONFIRMING' });
          await saga.executeConfirmCapacity(shipment, capacityUnitIds);
          await saga.executeComplete(shipment);
          await prisma.shipmentBooking.updateMany({
               where: { id: shipment.id, status: 'CONFIRMING' },
               data: { status: 'CONFIRMED', version: { increment: 1 } },
          });
          await forceReleaseCapacityLocks(
               shipment.tripId, capacityUnitIds, shipment.fromSeq, shipment.toSeq
          );
          try {
               const eventPayload = await buildShipmentEventPayload(shipment);
               await shipmentProducer.publishShipmentConfirmed({
                    ...eventPayload,
                    vehicleType: shipment.vehicleType,
               });
          } catch (error) {
               logger.error('Failed to publish SHIPMENT_CONFIRMED after retries', {
                    shipmentBookingId: shipment.id,
                    error: error.message,
               });
          }
     } catch (error) {
          if (error.code === 'STALE_STATE') return;
          logger.error(`Failed to confirm shipment ${shipment.id}`, { error: error.message });
          await saga.compensateAll(shipment, capacityUnitIds);
          await prisma.shipmentBooking.updateMany({
               where: { id: shipment.id, status: { in: ['PAYMENT_PENDING', 'CONFIRMING'] } },
               data: {
                    status: 'FAILED',
                    failureReason: `capacity_confirmation_failed: ${error.message}`,
                    version: { increment: 1 },
               },
          });
          await forceReleaseCapacityLocks(
               shipment.tripId, capacityUnitIds, shipment.fromSeq, shipment.toSeq
          );
          const eventPayload = await buildShipmentEventPayload(shipment);
          await shipmentProducer.publishShipmentFailed({
               ...eventPayload,
               reason: 'capacity_confirmation_failed',
          }).catch(publishError => logger.error('Failed to publish SHIPMENT_FAILED', {
               shipmentBookingId: shipment.id,
               error: publishError.message,
          }));
     }
};

const handlePaymentFailure = async (paymentOrderId, eventShipmentBookingId, reason) => {
     const shipment = await prisma.shipmentBooking.findUnique({
          where: { paymentOrderId },
          include: { capacityUnits: true, packages: true },
     });
     if (!shipment) {
          logger.warn(`No shipment found for paymentOrderId: ${paymentOrderId}`);
          return;
     }
     if (eventShipmentBookingId && eventShipmentBookingId !== shipment.id) {
          logger.warn('PAYMENT_FAILED shipment identifier does not match payment-order lookup', {
               paymentOrderId, eventShipmentBookingId, shipmentBookingId: shipment.id,
          });
     }
     if (TERMINAL_STATUSES.includes(shipment.status) || shipment.status !== 'PAYMENT_PENDING') return;
     const capacityUnitIds = shipment.capacityUnits.map(unit => unit.capacityUnitId).sort();
     try {
          await casUpdateShipment(shipment.id, shipment.version, {
               status: 'FAILED',
               failureReason: reason || 'payment_failed',
          });
     } catch (error) {
          if (error.code === 'STALE_STATE') return;
          throw error;
     }
     await saga.compensateHoldCapacity(shipment, capacityUnitIds);
     await forceReleaseCapacityLocks(shipment.tripId, capacityUnitIds, shipment.fromSeq, shipment.toSeq);
     const eventPayload = await buildShipmentEventPayload(shipment);
     await shipmentProducer.publishShipmentFailed({
          ...eventPayload,
          reason: reason || 'payment_failed',
     }).catch(error => logger.error('Failed to publish SHIPMENT_FAILED', {
          shipmentBookingId: shipment.id,
          error: error.message,
     }));
};

const cancelShipment = async (shipmentBookingId, userId) => {
     const shipment = await prisma.shipmentBooking.findUnique({
          where: { id: shipmentBookingId },
          include: { capacityUnits: true, packages: true },
     });
     if (!shipment || shipment.userId !== userId) throw new NotFoundError('Shipment not found');
     if (['CANCELLED', 'CANCELLING', 'FAILED', 'EXPIRED', 'CONFIRMING'].includes(shipment.status)) {
          throw new ConflictError(`Shipment is already ${shipment.status}`);
     }
     const capacityUnitIds = shipment.capacityUnits.map(unit => unit.capacityUnitId).sort();
     await casUpdateShipment(shipment.id, shipment.version, {
          status: 'CANCELLING',
          failureReason: 'user_cancelled',
     });

     let refundInitiated = false;
     if (shipment.status === 'CONFIRMED') {
          try {
               await inventoryClient.cancelShipmentCapacity(shipment.tripId, shipment.id, shipment.userId);
          } catch (error) {
               await prisma.shipmentBooking.updateMany({
                    where: { id: shipment.id, status: 'CANCELLING' },
                    data: { status: 'CONFIRMED', failureReason: null, version: { increment: 1 } },
               });
               throw error;
          }
          if (shipment.paymentOrderId) {
               try {
                    await paymentClient.initiateRefund(
                         shipment.paymentOrderId,
                         shipment.totalAmount,
                         'shipment_cancelled',
                         `${shipment.id}-cancel-refund`
                    );
                    refundInitiated = true;
               } catch (error) {
                    logger.error(`Failed to initiate refund for shipment ${shipment.id}`, { error: error.message });
               }
          }
     } else if (['PAYMENT_PENDING', 'CAPACITY_HELD'].includes(shipment.status)) {
          await inventoryClient.releaseCapacityUnits(
               shipment.tripId,
               capacityUnitIds,
               shipment.userId,
               shipment.id,
               shipment.fromSeq,
               shipment.toSeq
          ).catch(error => logger.error('Failed to release capacity during cancellation', {
               shipmentBookingId: shipment.id,
               error: error.message,
          }));
     }

     await prisma.shipmentBooking.updateMany({
          where: { id: shipment.id, status: 'CANCELLING' },
          data: { status: 'CANCELLED', version: { increment: 1 } },
     });
     await forceReleaseCapacityLocks(shipment.tripId, capacityUnitIds, shipment.fromSeq, shipment.toSeq);
     const eventPayload = await buildShipmentEventPayload(shipment);
     await shipmentProducer.publishShipmentCancelled({
          ...eventPayload,
          reason: 'user_cancelled',
          refundAmount: refundInitiated ? shipment.totalAmount : 0,
     }).catch(error => logger.error('Failed to publish SHIPMENT_CANCELLED', {
          shipmentBookingId: shipment.id,
          error: error.message,
     }));
     return { shipmentBookingId: shipment.id, trackingNumber: shipment.trackingNumber, status: 'CANCELLED', refundInitiated };
};

const getShipment = async (shipmentBookingId, userId) => {
     const shipment = await prisma.shipmentBooking.findUnique({
          where: { id: shipmentBookingId },
          include: { capacityUnits: { orderBy: { unitNumber: 'asc' } }, packages: true },
     });
     if (!shipment || shipment.userId !== userId) throw new NotFoundError('Shipment not found');
     return serializeShipment(shipment);
};

const getUserShipments = async (userId, { status, page = 1, limit = 10 } = {}) => {
     const where = { userId };
     if (status) {
          const normalizedStatus = status.toUpperCase();
          if (!SHIPMENT_STATUSES.includes(normalizedStatus)) throw new BadRequestError('Invalid shipment status');
          where.status = normalizedStatus;
     }
     const [shipments, total] = await Promise.all([
          prisma.shipmentBooking.findMany({
               where,
               include: { capacityUnits: { orderBy: { unitNumber: 'asc' } }, packages: true },
               orderBy: { createdAt: 'desc' },
               skip: (page - 1) * limit,
               take: limit,
          }),
          prisma.shipmentBooking.count({ where }),
     ]);
     return {
          shipments: shipments.map(serializeShipment),
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
     };
};

const verifyPayment = async (shipmentBookingId, userId, gatewayPaymentId, gatewaySignature) => {
     const shipment = await prisma.shipmentBooking.findUnique({ where: { id: shipmentBookingId } });
     if (!shipment || shipment.userId !== userId) throw new NotFoundError('Shipment not found');
     if (!shipment.paymentOrderId) throw new BadRequestError('Shipment has no payment order');
     if (shipment.status === 'CONFIRMED') {
          return { shipmentBookingId: shipment.id, status: 'CONFIRMED', message: 'Already confirmed' };
     }
     if (shipment.status !== 'PAYMENT_PENDING') {
          throw new ConflictError(`Shipment is in ${shipment.status} status and cannot verify payment`);
     }
     const result = await paymentClient.verifyPayment(
          shipment.paymentOrderId,
          gatewayPaymentId,
          gatewaySignature
     );
     return { shipmentBookingId: shipment.id, paymentStatus: result.status };
};

const handleCargoTripCancelled = async (tripId) => {
     if (!tripId) {
          logger.warn('handleCargoTripCancelled called without tripId');
          return;
     }
     const shipments = await prisma.shipmentBooking.findMany({
          where: { tripId, status: { in: ACTIVE_STATUSES } },
          include: { capacityUnits: true, packages: true },
     });
     for (const shipment of shipments) {
          try {
               const claimed = await prisma.shipmentBooking.updateMany({
                    where: { id: shipment.id, version: shipment.version, status: { in: ACTIVE_STATUSES } },
                    data: {
                         status: 'CANCELLED',
                         failureReason: 'cargo_trip_cancelled',
                         version: { increment: 1 },
                    },
               });
               if (claimed.count === 0) continue;
               const capacityUnitIds = shipment.capacityUnits.map(unit => unit.capacityUnitId).sort();
               if (shipment.status === 'CONFIRMED') {
                    await inventoryClient.cancelShipmentCapacity(
                         shipment.tripId, shipment.id, shipment.userId
                    ).catch(error => logger.error('Failed to release confirmed shipment capacity', {
                         shipmentBookingId: shipment.id,
                         error: error.message,
                    }));
               } else {
                    await saga.compensateHoldCapacity(shipment, capacityUnitIds);
               }
               await forceReleaseCapacityLocks(
                    shipment.tripId, capacityUnitIds, shipment.fromSeq, shipment.toSeq
               );
               let refundAmount = 0;
               if (shipment.status === 'CONFIRMED' && shipment.paymentOrderId) {
                    try {
                         await paymentClient.initiateRefund(
                              shipment.paymentOrderId,
                              shipment.totalAmount,
                              'cargo_trip_cancelled',
                              `${shipment.id}-cargo-trip-cancel-refund`
                         );
                         refundAmount = shipment.totalAmount;
                    } catch (error) {
                         logger.error(`Failed to initiate cargo-trip cancellation refund for shipment ${shipment.id}`, {
                              error: error.message,
                         });
                    }
               }
               const eventPayload = await buildShipmentEventPayload(shipment);
               await shipmentProducer.publishShipmentCancelled({
                    ...eventPayload,
                    reason: 'cargo_trip_cancelled',
                    refundAmount,
               });
          } catch (error) {
               logger.error(`Failed to cancel shipment ${shipment.id} for cargo-trip cancellation`, {
                    error: error.message,
               });
          }
     }
};

module.exports = {
     createShipment,
     handlePaymentSuccess,
     handlePaymentFailure,
     handleCargoTripCancelled,
     cancelShipment,
     getShipment,
     getUserShipments,
     verifyPayment,
     casUpdateShipment,
};
