const asyncHandler = require('../utils/asyncHandler');
const { BadRequestError } = require('../utils/error');
const searchService = require('../services/search.service');

exports.searchVehicles = asyncHandler(async (req, res) => {
     const { from, to, date } = req.query;
     if (!from || !to) throw new BadRequestError('from and to hub names/codes are required');
     if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          throw new BadRequestError('date must use YYYY-MM-DD format');
     }

     const results = await searchService.searchVehicles(from, to, date || null);
     return res.json({ success: true, data: results });
});

exports.autocomplete = asyncHandler(async (req, res) => {
     const { q } = req.query;
     if (!q || q.length < 2) throw new BadRequestError('Provide at least 2 characters');
     const suggestions = await searchService.autocompleteHub(q);
     return res.json({ success: true, data: suggestions });
});

exports.debugHubs = asyncHandler(async (req, res) => {
     const data = await searchService.getAllHubs();
     return res.json({ success: true, count: data.length, data });
});

exports.debugVehicles = asyncHandler(async (req, res) => {
     const data = await searchService.getAllVehicles();
     return res.json({ success: true, count: data.length, data });
});
