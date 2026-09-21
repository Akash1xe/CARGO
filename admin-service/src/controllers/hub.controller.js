const asyncHandler = require('../utils/asyncHandler');
const { BadRequestError } = require('../utils/error');
const hubService = require('../services/hub.service');

exports.createHub = asyncHandler(async (req, res) => {
     const { name, code, city, state, address, latitude, longitude } = req.body;
     if ([name, code, city, state].some((value) => typeof value !== 'string' || !value.trim())) {
          throw new BadRequestError('name, code, city and state are required');
     }

     const hub = await hubService.createHub({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          city: city.trim(),
          state: state.trim(),
          address,
          latitude,
          longitude,
     });

     return res.status(201).json({
          success: true,
          message: 'Logistics hub created successfully',
          data: hub,
     });
});

exports.getAllHubs = asyncHandler(async (req, res) => {
     const page = Number.parseInt(req.query.page, 10) || 1;
     const limit = Number.parseInt(req.query.limit, 10) || 50;
     const search = req.query.search;
     if (page < 1 || limit < 1) {
          throw new BadRequestError('page and limit must be positive integers');
     }

     const result = await hubService.getAllHubs(page, limit, search);
     return res.status(200).json({
          success: true,
          data: result.hubs,
          pagination: {
               page,
               limit,
               total: result.total,
               totalPages: Math.ceil(result.total / limit),
          },
     });
});

exports.getHubById = asyncHandler(async (req, res) => {
     const { hubId } = req.params;
     if (!hubId) throw new BadRequestError('Hub ID is missing');

     const hub = await hubService.getHubById(hubId);
     return res.status(200).json({ success: true, data: hub });
});
