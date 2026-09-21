const express = require('express');
const { getUserContext } = require('../middlewares/getUserContext.middleware');
const {
     createShipment,
     getShipment,
     getUserShipments,
     cancelShipment,
     verifyPayment,
} = require('../controllers/shipment.controller');

const router = express.Router();

router.post('/shipments', getUserContext, createShipment);
router.get('/shipments', getUserContext, getUserShipments);
router.get('/shipments/:shipmentBookingId', getUserContext, getShipment);
router.post('/shipments/:shipmentBookingId/verify-payment', getUserContext, verifyPayment);
router.post('/shipments/:shipmentBookingId/cancel', getUserContext, cancelShipment);

module.exports = router;
