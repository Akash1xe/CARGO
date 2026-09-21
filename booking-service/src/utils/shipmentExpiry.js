const prisma = require('../config/prisma');
const logger = require('../config/logger');
const { config } = require('../config');
const { redis } = require('../config/redis');
const { forceReleaseCapacityLocks } = require('./distributedLock');
const { compensateAll } = require('../services/saga.service');
const { userClient } = require('../services/userClient');
const { hubClient } = require('../services/hubClient');
const shipmentProducer = require('../kafka/producer/shipment.producer');

const LEADER_KEY = 'shipment:expiry-job:leader';
const LEADER_TTL_SECONDS = 25;
let expiryInterval = null;

const fetchUserForNotification = async (userId) => {
     try {
          const user = await userClient.getUserById(userId);
          return user ? { email: user.email, firstName: user.firstName } : {};
     } catch (error) {
          logger.warn('Failed to enrich shipment expiry event with user details', {
               userId,
               error: error.message,
          });
          return {};
     }
};

async function tryAcquireLeadership() {
     try {
          return await redis.set(LEADER_KEY, process.pid.toString(), 'NX', 'EX', LEADER_TTL_SECONDS) === 'OK';
     } catch (error) {
          logger.error('Failed to acquire shipment expiry leadership', { error: error.message });
          return false;
     }
}

async function cleanExpiredShipments() {
     if (!await tryAcquireLeadership()) return;
     try {
          const expiredShipments = await prisma.shipmentBooking.findMany({
               where: {
                    status: { in: ['PENDING', 'CAPACITY_HELD', 'PAYMENT_PENDING'] },
                    lockExpiresAt: { lt: new Date() },
               },
               include: { capacityUnits: true, packages: true },
          });

          for (const shipment of expiredShipments) {
               try {
                    const capacityUnitIds = shipment.capacityUnits.map(unit => unit.capacityUnitId).sort();
                    const claimed = await prisma.shipmentBooking.updateMany({
                         where: {
                              id: shipment.id,
                              version: shipment.version,
                              status: { in: ['PENDING', 'CAPACITY_HELD', 'PAYMENT_PENDING'] },
                         },
                         data: {
                              status: 'EXPIRED',
                              failureReason: 'shipment_timeout',
                              version: { increment: 1 },
                         },
                    });
                    if (claimed.count === 0) continue;
                    await compensateAll(shipment, capacityUnitIds);
                    await forceReleaseCapacityLocks(
                         shipment.tripId,
                         capacityUnitIds,
                         shipment.fromSeq,
                         shipment.toSeq
                    );
                    const userInfo = await fetchUserForNotification(shipment.userId);
                    const [fromHub, toHub] = await Promise.all([
                         hubClient.getHubById(shipment.fromHubId).catch(() => null),
                         hubClient.getHubById(shipment.toHubId).catch(() => null),
                    ]);
                    await shipmentProducer.publishShipmentFailed({
                         shipmentBookingId: shipment.id,
                         trackingNumber: shipment.trackingNumber,
                         userId: shipment.userId,
                         email: userInfo.email,
                         firstName: userInfo.firstName,
                         tripId: shipment.tripId,
                         vehicleName: shipment.vehicleName,
                         vehicleNumber: shipment.vehicleNumber,
                         fromHubName: fromHub?.name || null,
                         toHubName: toHub?.name || null,
                         departureDate: shipment.departureDate,
                         capacityUnits: shipment.capacityUnits.map(unit => ({
                              capacityUnitId: unit.capacityUnitId,
                              unitNumber: unit.unitNumber,
                              unitType: unit.unitType,
                              price: unit.price,
                              maxWeightKg: unit.maxWeightKg,
                         })),
                         packages: shipment.packages.map(item => ({
                              description: item.description,
                              category: item.category,
                              weightKg: item.weightKg,
                              declaredValue: item.declaredValue,
                              specialInstructions: item.specialInstructions,
                              capacityUnitId: item.capacityUnitId,
                         })),
                         totalAmount: shipment.totalAmount,
                         reason: 'shipment_timeout',
                    }).catch(error => logger.error('Failed to publish expired SHIPMENT_FAILED event', {
                         shipmentBookingId: shipment.id,
                         error: error.message,
                    }));
               } catch (error) {
                    logger.error(`Failed to clean expired shipment ${shipment.id}`, { error: error.message });
               }
          }
     } catch (error) {
          logger.error('Error in shipment expiry job', { error: error.message });
     }
}

function startShipmentExpiryJob() {
     cleanExpiredShipments();
     expiryInterval = setInterval(cleanExpiredShipments, config.BOOKING_EXPIRY_CHECK_INTERVAL_MS);
     logger.info(`Shipment expiry job started (interval: ${config.BOOKING_EXPIRY_CHECK_INTERVAL_MS}ms)`);
}

function stopShipmentExpiryJob() {
     if (expiryInterval) {
          clearInterval(expiryInterval);
          expiryInterval = null;
          logger.info('Shipment expiry job stopped');
     }
}

module.exports = { cleanExpiredShipments, startShipmentExpiryJob, stopShipmentExpiryJob };
