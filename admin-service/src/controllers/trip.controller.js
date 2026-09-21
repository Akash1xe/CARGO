const asyncHandler = require('../utils/asyncHandler');
const { BadRequestError } = require('../utils/error');
const tripService = require('../services/trip.service');

exports.createTrip = asyncHandler(async (req, res) => {
     const { vehicleId, departureDate } = req.body;
     if (!vehicleId || !departureDate) {
          throw new BadRequestError('vehicleId and departureDate are required');
     }

     const trip = await tripService.createTrip({ vehicleId, departureDate });
     return res.status(201).json({
          success: true,
          message: 'Cargo trip created successfully',
          data: trip,
     });
});

exports.cancelTrip = asyncHandler(async (req, res) => {
     const { tripId } = req.params;
     if (!tripId) throw new BadRequestError('Trip ID is missing');

     const trip = await tripService.cancelTrip(tripId);
     return res.status(200).json({
          success: true,
          message: 'Cargo trip cancelled',
          data: trip,
     });
});

exports.getAllTrips = asyncHandler(async (req, res) => {
     const trips = await tripService.getAllTrips(req.query);
     return res.status(200).json({ success: true, data: trips });
});
