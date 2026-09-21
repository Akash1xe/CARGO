const asyncHandler = require('../utils/asyncHandler');
const { BadRequestError } = require('../utils/error');
const inventoryService = require('../services/inventory.service');

const requireCapacityUnitIds = (capacityUnitIds) => {
     if (!Array.isArray(capacityUnitIds) || capacityUnitIds.length === 0) {
          throw new BadRequestError('capacityUnitIds must be a non-empty array');
     }
     if (new Set(capacityUnitIds).size !== capacityUnitIds.length) {
          throw new BadRequestError('capacityUnitIds must not contain duplicates');
     }
};

exports.getTripAvailability = asyncHandler(async (req, res) => {
     const data = await inventoryService.getAvailability(req.params.tripId);
     return res.status(200).json({ success: true, data });
});

exports.getTripCapacityUnits = asyncHandler(async (req, res) => {
     const { status, unitType, fromSeq, toSeq } = req.query;
     const filters = {};
     if (status) filters.status = status.toUpperCase();
     if (unitType) filters.unitType = unitType.toUpperCase();
     if (fromSeq) filters.fromSeq = fromSeq;
     if (toSeq) filters.toSeq = toSeq;

     const data = await inventoryService.getCapacityUnits(req.params.tripId, filters);
     return res.status(200).json({ success: true, data });
});

exports.lockCapacityUnits = asyncHandler(async (req, res) => {
     const { tripId, capacityUnitIds, ttlSeconds, userId, fromSeq, toSeq } = req.body;
     if (!tripId) throw new BadRequestError('tripId is required');
     requireCapacityUnitIds(capacityUnitIds);
     if (!userId) throw new BadRequestError('userId is required');

     const result = await inventoryService.lockCapacityUnits(
          tripId, capacityUnitIds, userId, ttlSeconds, fromSeq, toSeq
     );
     return res.status(200).json({
          success: true,
          message: `${result.lockedCapacityUnits.length} capacity unit(s) locked successfully`,
          data: {
               tripId: result.tripId,
               lockedCapacityUnits: result.lockedCapacityUnits,
               lockExpiresAt: result.lockExpiresAt,
          },
     });
});

exports.unlockCapacityUnits = asyncHandler(async (req, res) => {
     const { tripId, capacityUnitIds, userId, fromSeq, toSeq } = req.body;
     if (!tripId) throw new BadRequestError('tripId is required');
     requireCapacityUnitIds(capacityUnitIds);
     if (!userId) throw new BadRequestError('userId is required');

     const result = await inventoryService.unlockCapacityUnits(
          tripId, capacityUnitIds, userId, fromSeq, toSeq
     );
     return res.status(200).json({
          success: true,
          message: `${result.unlockedCapacityUnits.length} capacity unit(s) unlocked successfully`,
          data: {
               tripId: result.tripId,
               unlockedCapacityUnits: result.unlockedCapacityUnits,
          },
     });
});

exports.confirmCapacityUnits = asyncHandler(async (req, res) => {
     const { tripId, capacityUnitIds, bookingId, userId, fromSeq, toSeq } = req.body;
     if (!tripId) throw new BadRequestError('tripId is required');
     requireCapacityUnitIds(capacityUnitIds);
     if (!bookingId) throw new BadRequestError('bookingId is required');
     if (!userId) throw new BadRequestError('userId is required');

     const result = await inventoryService.confirmCapacityUnits(
          tripId, capacityUnitIds, userId, bookingId, fromSeq, toSeq
     );
     return res.status(200).json({
          success: true,
          message: `${result.confirmedCapacityUnits.length} capacity unit(s) confirmed`,
          data: {
               tripId: result.tripId,
               bookingId: result.bookingId,
               confirmedCapacityUnits: result.confirmedCapacityUnits,
          },
     });
});

exports.cancelBooking = asyncHandler(async (req, res) => {
     const { tripId, bookingId, userId } = req.body;
     if (!tripId || !bookingId) throw new BadRequestError('tripId and bookingId are required');
     if (!userId) throw new BadRequestError('userId is required');

     const result = await inventoryService.cancelBooking(tripId, bookingId, userId);
     return res.status(200).json({
          success: true,
          message: `Booking cancelled, ${result.releasedCapacityUnits.length} capacity unit(s) released`,
          data: {
               tripId: result.tripId,
               bookingId: result.bookingId,
               releasedCapacityUnits: result.releasedCapacityUnits,
          },
     });
});
