const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCreateInput } = require('../../booking-service/src/utils/shipmentValidation');

const valid = overrides => ({
     tripId: 'trip-1',
     capacityUnitIds: ['capacity-1'],
     packages: [{ description: 'Machine parts', category: 'STANDARD', weightKg: 25, declaredValue: 1000 }],
     fromHubId: 'hub-1',
     toHubId: 'hub-2',
     fromSeq: 1,
     toSeq: 2,
     idempotencyKey: 'shipment-key-1',
     ...overrides,
});

test('accepts a valid shipment request', () => {
     assert.doesNotThrow(() => validateCreateInput(valid()));
});

test('rejects empty or duplicate capacity units and mismatched packages', () => {
     assert.throws(() => validateCreateInput(valid({ capacityUnitIds: [] })), /non-empty/);
     assert.throws(() => validateCreateInput(valid({ capacityUnitIds: ['a', 'a'], packages: [{}, {}] })), /duplicates/);
     assert.throws(() => validateCreateInput(valid({ capacityUnitIds: ['a', 'b'] })), /must equal/);
});

test('rejects invalid segments, package weights, and declared values', () => {
     assert.throws(() => validateCreateInput(valid({ fromSeq: 2, toSeq: 2 })), /lower than/);
     assert.throws(() => validateCreateInput(valid({ packages: [{ description: 'x', category: 'STANDARD', weightKg: 0 }] })), /greater than zero/);
     assert.throws(() => validateCreateInput(valid({ packages: [{ description: 'x', category: 'STANDARD', weightKg: 1, declaredValue: -1 }] })), /cannot be negative/);
});
