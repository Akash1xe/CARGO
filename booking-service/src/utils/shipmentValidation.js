const { BadRequestError } = require('./error');

const validateCreateInput = ({
     tripId, capacityUnitIds, packages, fromHubId, toHubId, fromSeq, toSeq, idempotencyKey,
}) => {
     if (!tripId) throw new BadRequestError('tripId is required');
     if (!Array.isArray(capacityUnitIds) || capacityUnitIds.length === 0) {
          throw new BadRequestError('capacityUnitIds must be a non-empty array');
     }
     if (new Set(capacityUnitIds).size !== capacityUnitIds.length) {
          throw new BadRequestError('capacityUnitIds must not contain duplicates');
     }
     if (!Array.isArray(packages) || packages.length === 0) {
          throw new BadRequestError('packages must be a non-empty array');
     }
     if (packages.length !== capacityUnitIds.length) {
          throw new BadRequestError('Number of packages must equal number of capacity units');
     }
     packages.forEach((item, index) => {
          if (!item || typeof item.description !== 'string' || !item.description.trim()) {
               throw new BadRequestError(`packages[${index}].description is required`);
          }
          if (typeof item.category !== 'string' || !item.category.trim()) {
               throw new BadRequestError(`packages[${index}].category is required`);
          }
          if (typeof item.weightKg !== 'number' || !Number.isFinite(item.weightKg) || item.weightKg <= 0) {
               throw new BadRequestError(`packages[${index}].weightKg must be greater than zero`);
          }
          if (item.declaredValue !== undefined && item.declaredValue !== null &&
               (typeof item.declaredValue !== 'number' || !Number.isFinite(item.declaredValue) || item.declaredValue < 0)) {
               throw new BadRequestError(`packages[${index}].declaredValue cannot be negative`);
          }
     });
     if (!fromHubId || !toHubId || fromSeq === undefined || toSeq === undefined) {
          throw new BadRequestError('fromHubId, toHubId, fromSeq and toSeq are required');
     }
     if (fromHubId === toHubId) throw new BadRequestError('Origin and destination hubs must differ');
     if (!Number.isInteger(fromSeq) || !Number.isInteger(toSeq) || fromSeq >= toSeq) {
          throw new BadRequestError('fromSeq must be an integer lower than toSeq');
     }
     if (!idempotencyKey) throw new BadRequestError('idempotencyKey is required');
};

module.exports = { validateCreateInput };
