const asyncHandler = require('../utils/asyncHandler');
const { BadRequestError } = require('../utils/error');
const vehicleService = require('../services/vehicle.service');

exports.createVehicle = asyncHandler(async (req, res) => {
     const { vehicleNumber, vehicleName, vehicleType, capacityUnits } = req.body;
     if (
          [vehicleNumber, vehicleName, vehicleType].some(
               (value) => typeof value !== 'string' || !value.trim()
          ) || !Array.isArray(capacityUnits)
     ) {
          throw new BadRequestError('vehicleNumber, vehicleName, vehicleType and capacityUnits are required');
     }
     if (capacityUnits.length === 0) {
          throw new BadRequestError('At least one capacity unit must be defined');
     }

     const vehicle = await vehicleService.createVehicle({
          vehicleNumber: vehicleNumber.trim(),
          vehicleName: vehicleName.trim(),
          vehicleType: vehicleType.trim(),
          capacityUnits,
     });
     return res.status(201).json({
          success: true,
          message: 'Cargo vehicle created successfully',
          data: vehicle,
     });
});

exports.createTransportRoute = asyncHandler(async (req, res) => {
     const { vehicleId, hubs } = req.body;
     if (!vehicleId || !Array.isArray(hubs)) {
          throw new BadRequestError('vehicleId and hubs are required');
     }
     if (hubs.length < 2) {
          throw new BadRequestError('A transport route must have at least two hubs');
     }

     const route = await vehicleService.createTransportRoute({ vehicleId, hubs });
     return res.status(201).json({
          success: true,
          message: 'Transport route created successfully',
          data: route,
     });
});

exports.getAllVehicles = asyncHandler(async (req, res) => {
     const vehicles = await vehicleService.getAllVehicles();
     return res.status(200).json({ success: true, data: vehicles });
});

exports.getVehicleById = asyncHandler(async (req, res) => {
     const { vehicleId } = req.params;
     if (!vehicleId) throw new BadRequestError('Vehicle ID is missing');

     const vehicle = await vehicleService.getVehicleById(vehicleId);
     return res.status(200).json({ success: true, data: vehicle });
});
