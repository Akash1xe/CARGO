const express = require('express');
const {
     createVehicle,
     createTransportRoute,
     getAllVehicles,
     getVehicleById,
} = require('../controllers/vehicle.controller');
const { getUserContext } = require('../middlewares/getUserContext.middleware');
const { requireRole } = require('../middlewares/requireRole.middleware');
const { internalAuth } = require('../middlewares/internalAuth.middleware');

const router = express.Router();

router.post('/vehicle', internalAuth, getUserContext, requireRole('ADMIN'), createVehicle);
router.get('/vehicle', internalAuth, getUserContext, requireRole('ADMIN'), getAllVehicles);
router.get('/vehicle/:vehicleId', internalAuth, getUserContext, requireRole('ADMIN'), getVehicleById);
router.post('/route', internalAuth, getUserContext, requireRole('ADMIN'), createTransportRoute);

module.exports = router;
