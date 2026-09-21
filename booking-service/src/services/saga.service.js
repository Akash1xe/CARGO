const prisma = require('../config/prisma');
const logger = require('../config/logger');
const { inventoryClient } = require('./inventoryClient');
const { paymentClient } = require('./paymentClient');

async function executeHoldCapacity(shipment, capacityUnitIds, ttlSeconds) {
     const sagaLog = await prisma.sagaLog.create({
          data: {
               shipmentBookingId: shipment.id,
               step: 'HOLD_CAPACITY',
               status: 'PENDING',
               request: {
                    tripId: shipment.tripId,
                    capacityUnitIds,
                    userId: shipment.userId,
                    shipmentBookingId: shipment.id,
                    ttlSeconds,
                    fromSeq: shipment.fromSeq,
                    toSeq: shipment.toSeq,
               },
          },
     });

     try {
          const result = await inventoryClient.holdCapacityUnits(
               shipment.tripId,
               capacityUnitIds,
               shipment.userId,
               shipment.id,
               ttlSeconds,
               shipment.fromSeq,
               shipment.toSeq
          );
          await prisma.sagaLog.update({
               where: { id: sagaLog.id },
               data: { status: 'COMPLETED', response: result },
          });
          await prisma.shipmentBooking.update({
               where: { id: shipment.id },
               data: { status: 'CAPACITY_HELD' },
          });
          logger.info(`Saga HOLD_CAPACITY completed for shipment ${shipment.id}`);
          return result;
     } catch (error) {
          await prisma.sagaLog.update({
               where: { id: sagaLog.id },
               data: { status: 'FAILED', error: error.response?.data?.message || error.message },
          });
          throw error;
     }
}

async function executeCreatePayment(shipment) {
     const idempotencyKey = `${shipment.id}-payment`;
     const sagaLog = await prisma.sagaLog.create({
          data: {
               shipmentBookingId: shipment.id,
               step: 'CREATE_PAYMENT',
               status: 'PENDING',
               request: { shipmentBookingId: shipment.id, amount: shipment.totalAmount, userId: shipment.userId },
          },
     });

     try {
          const result = await paymentClient.createPaymentOrder(
               shipment.id,
               shipment.totalAmount,
               shipment.userId,
               idempotencyKey
          );
          await prisma.sagaLog.update({
               where: { id: sagaLog.id },
               data: { status: 'COMPLETED', response: result },
          });
          await prisma.shipmentBooking.update({
               where: { id: shipment.id },
               data: { status: 'PAYMENT_PENDING', paymentOrderId: result.paymentOrderId },
          });
          logger.info(`Saga CREATE_PAYMENT completed for shipment ${shipment.id}`);
          return result;
     } catch (error) {
          await prisma.sagaLog.update({
               where: { id: sagaLog.id },
               data: { status: 'FAILED', error: error.response?.data?.message || error.message },
          });
          throw error;
     }
}

async function executeConfirmCapacity(shipment, capacityUnitIds) {
     const sagaLog = await prisma.sagaLog.create({
          data: {
               shipmentBookingId: shipment.id,
               step: 'CONFIRM_CAPACITY',
               status: 'PENDING',
               request: {
                    tripId: shipment.tripId,
                    capacityUnitIds,
                    userId: shipment.userId,
                    shipmentBookingId: shipment.id,
                    fromSeq: shipment.fromSeq,
                    toSeq: shipment.toSeq,
               },
          },
     });

     try {
          const result = await inventoryClient.confirmCapacityUnits(
               shipment.tripId,
               capacityUnitIds,
               shipment.userId,
               shipment.id,
               shipment.fromSeq,
               shipment.toSeq
          );
          await prisma.sagaLog.update({
               where: { id: sagaLog.id },
               data: { status: 'COMPLETED', response: result },
          });
          logger.info(`Saga CONFIRM_CAPACITY completed for shipment ${shipment.id}`);
          return result;
     } catch (error) {
          await prisma.sagaLog.update({
               where: { id: sagaLog.id },
               data: { status: 'FAILED', error: error.response?.data?.message || error.message },
          });
          throw error;
     }
}

async function executeComplete(shipment) {
     const existing = await prisma.sagaLog.findFirst({
          where: { shipmentBookingId: shipment.id, step: 'COMPLETE', status: 'COMPLETED' },
     });
     if (existing) return existing;
     const result = await prisma.sagaLog.create({
          data: {
               shipmentBookingId: shipment.id,
               step: 'COMPLETE',
               status: 'COMPLETED',
               response: { completedAt: new Date().toISOString() },
          },
     });
     logger.info(`Saga COMPLETE recorded for shipment ${shipment.id}`);
     return result;
}

async function compensateHoldCapacity(shipment, capacityUnitIds) {
     logger.info(`Compensating HOLD_CAPACITY for shipment ${shipment.id}`);
     try {
          await inventoryClient.releaseCapacityUnits(
               shipment.tripId,
               capacityUnitIds,
               shipment.userId,
               shipment.id,
               shipment.fromSeq,
               shipment.toSeq
          );
          await prisma.sagaLog.updateMany({
               where: { shipmentBookingId: shipment.id, step: 'HOLD_CAPACITY', status: 'COMPLETED' },
               data: { status: 'COMPENSATED' },
          });
     } catch (error) {
          logger.error(`Failed to compensate HOLD_CAPACITY for shipment ${shipment.id}`, {
               error: error.message,
          });
     }
}

async function compensateCreatePayment(shipment) {
     if (!shipment.paymentOrderId) return;
     logger.info(`Compensating CREATE_PAYMENT for shipment ${shipment.id}`);
     try {
          await paymentClient.initiateRefund(
               shipment.paymentOrderId,
               shipment.totalAmount,
               'shipment_compensation',
               `${shipment.id}-refund-compensation`
          );
          await prisma.sagaLog.updateMany({
               where: { shipmentBookingId: shipment.id, step: 'CREATE_PAYMENT', status: 'COMPLETED' },
               data: { status: 'COMPENSATED' },
          });
     } catch (error) {
          logger.error(`Failed to compensate CREATE_PAYMENT for shipment ${shipment.id}`, {
               error: error.message,
          });
     }
}

async function compensateConfirmCapacity(shipment) {
     logger.info(`Compensating CONFIRM_CAPACITY for shipment ${shipment.id}`);
     try {
          await inventoryClient.cancelShipmentCapacity(shipment.tripId, shipment.id, shipment.userId);
          await prisma.sagaLog.updateMany({
               where: { shipmentBookingId: shipment.id, step: 'CONFIRM_CAPACITY', status: 'COMPLETED' },
               data: { status: 'COMPENSATED' },
          });
     } catch (error) {
          logger.error(`Failed to compensate CONFIRM_CAPACITY for shipment ${shipment.id}`, {
               error: error.message,
          });
     }
}

async function compensateAll(shipment, capacityUnitIds) {
     const completedSteps = await prisma.sagaLog.findMany({
          where: { shipmentBookingId: shipment.id, status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
     });
     for (const step of completedSteps) {
          if (step.step === 'CONFIRM_CAPACITY') await compensateConfirmCapacity(shipment);
          if (step.step === 'CREATE_PAYMENT') await compensateCreatePayment(shipment);
          if (step.step === 'HOLD_CAPACITY') await compensateHoldCapacity(shipment, capacityUnitIds);
     }
}

module.exports = {
     executeHoldCapacity,
     executeCreatePayment,
     executeConfirmCapacity,
     executeComplete,
     compensateHoldCapacity,
     compensateCreatePayment,
     compensateConfirmCapacity,
     compensateAll,
};
