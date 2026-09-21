const test = require('node:test');
const assert = require('node:assert/strict');

const { validateCapacityUnits, validateRouteHubs } = require('../../admin-service/src/services/vehicle.service');

const unit = overrides => ({ unitNumber: 1, unitType: 'STANDARD', price: 1200, maxWeightKg: 500, ...overrides });

test('capacity-unit validation accepts valid input and rejects duplicates/non-positive values', () => {
     assert.doesNotThrow(() => validateCapacityUnits([unit()]));
     assert.throws(() => validateCapacityUnits([unit(), unit()]), /Duplicate/);
     assert.throws(() => validateCapacityUnits([unit({ price: 0 })]), /greater than zero/);
     assert.throws(() => validateCapacityUnits([unit({ maxWeightKg: -1 })]), /greater than zero/);
});

test('route validation enforces topology and increasing distance', () => {
     const valid = [
          { hubId: 'a', sequenceNumber: 1, distanceFromOriginKm: 0 },
          { hubId: 'b', sequenceNumber: 2, distanceFromOriginKm: 100 },
     ];
     assert.deepEqual(validateRouteHubs(valid), valid);
     assert.throws(() => validateRouteHubs([valid[0]]), /at least two/);
     assert.throws(() => validateRouteHubs([valid[0], { ...valid[1], hubId: 'a' }]), /cannot appear twice/);
     assert.throws(() => validateRouteHubs([valid[0], { ...valid[1], sequenceNumber: 3 }]), /continuous/);
     assert.throws(() => validateRouteHubs([valid[0], { ...valid[1], distanceFromOriginKm: 0 }]), /must increase/);
});
