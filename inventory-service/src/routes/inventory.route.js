const express = require('express');
const { getUserContext } = require('../middlewares/getUserContext.middleware');
const { internalAuth } = require('../middlewares/internalAuth.middleware');
const { config } = require('../config');
const {
     getTripAvailability,
     getTripCapacityUnits,
     lockCapacityUnits,
     unlockCapacityUnits,
     confirmCapacityUnits,
     cancelBooking,
} = require('../controllers/inventory.controller');

const router = express.Router();

function userOrInternal(req, res, next) {
     const serviceKey = req.headers['x-internal-service-key'];
     if (serviceKey && serviceKey === config.INTERNAL_SERVICE_KEY) {
          req.user = { id: 'internal-service' };
          return next();
     }
     return getUserContext(req, res, next);
}

router.get('/trips/:tripId/availability', getTripAvailability);
router.get('/trips/:tripId/capacity-units', userOrInternal, getTripCapacityUnits);

router.post('/capacity-units/lock', internalAuth, lockCapacityUnits);
router.post('/capacity-units/unlock', internalAuth, unlockCapacityUnits);
router.post('/capacity-units/confirm', internalAuth, confirmCapacityUnits);
router.post('/capacity-units/cancel-booking', internalAuth, cancelBooking);

module.exports = router;
