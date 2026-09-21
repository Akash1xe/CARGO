const { Router } = require('express');
const controller = require('../controllers/search.controller');

const router = Router();

router.get('/vehicles', controller.searchVehicles);
router.get('/autocomplete', controller.autocomplete);
router.get('/debug/hubs', controller.debugHubs);
router.get('/debug/vehicles', controller.debugVehicles);

module.exports = router;
