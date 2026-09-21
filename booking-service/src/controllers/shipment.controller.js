const asyncHandler = require('../utils/asyncHandler');
const { BadRequestError } = require('../utils/error');
const shipmentService = require('../services/shipment.service');

exports.createShipment = asyncHandler(async (req, res) => {
     const {
          tripId,
          capacityUnitIds,
          packages,
          fromHubId,
          toHubId,
          fromSeq,
          toSeq,
          idempotencyKey,
     } = req.body;
     const result = await shipmentService.createShipment(req.user.id, {
          tripId,
          capacityUnitIds,
          packages,
          fromHubId,
          toHubId,
          fromSeq,
          toSeq,
          idempotencyKey,
     });
     res.status(201).json({ success: true, data: result });
});

exports.getShipment = asyncHandler(async (req, res) => {
     const result = await shipmentService.getShipment(req.params.shipmentBookingId, req.user.id);
     res.status(200).json({ success: true, data: result });
});

exports.getUserShipments = asyncHandler(async (req, res) => {
     const page = req.query.page ? Number.parseInt(req.query.page, 10) : 1;
     const limit = req.query.limit ? Number.parseInt(req.query.limit, 10) : 10;
     if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1) {
          throw new BadRequestError('page and limit must be positive integers');
     }
     const result = await shipmentService.getUserShipments(req.user.id, {
          status: req.query.status,
          page,
          limit: Math.min(limit, 100),
     });
     res.status(200).json({ success: true, data: result });
});

exports.verifyPayment = asyncHandler(async (req, res) => {
     const { razorpayPaymentId, razorpaySignature } = req.body;
     if (!razorpayPaymentId || !razorpaySignature) {
          throw new BadRequestError('razorpayPaymentId and razorpaySignature are required');
     }
     const result = await shipmentService.verifyPayment(
          req.params.shipmentBookingId,
          req.user.id,
          razorpayPaymentId,
          razorpaySignature
     );
     res.status(200).json({ success: true, data: result });
});

exports.cancelShipment = asyncHandler(async (req, res) => {
     const result = await shipmentService.cancelShipment(req.params.shipmentBookingId, req.user.id);
     res.status(200).json({
          success: true,
          message: 'Shipment cancelled successfully',
          data: result,
     });
});
