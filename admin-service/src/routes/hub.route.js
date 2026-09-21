const express = require('express');
const { createHub, getAllHubs, getHubById } = require('../controllers/hub.controller');
const { getUserContext } = require('../middlewares/getUserContext.middleware');
const { requireRole } = require('../middlewares/requireRole.middleware');
const { internalAuth } = require('../middlewares/internalAuth.middleware');

const router = express.Router();

router.post('/hub', internalAuth, getUserContext, requireRole('ADMIN'), createHub);
router.get('/hub', internalAuth, getUserContext, requireRole('ADMIN'), getAllHubs);
router.get('/hub/:hubId', internalAuth, getUserContext, requireRole('ADMIN'), getHubById);

module.exports = router;
