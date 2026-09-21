const express = require('express');
const { createTrip, cancelTrip, getAllTrips } = require('../controllers/trip.controller');
const { getUserContext } = require('../middlewares/getUserContext.middleware');
const { requireRole } = require('../middlewares/requireRole.middleware');
const { internalAuth } = require('../middlewares/internalAuth.middleware');

const router = express.Router();

router.post('/trip', internalAuth, getUserContext, requireRole('ADMIN'), createTrip);
router.get('/trip', internalAuth, getUserContext, requireRole('ADMIN'), getAllTrips);
router.put('/trip/:tripId', internalAuth, getUserContext, requireRole('ADMIN'), cancelTrip);

module.exports = router;
