const test = require('node:test');
const assert = require('node:assert/strict');
const { segmentsOverlap } = require('../../inventory-service/src/utils/segmentsOverlap');

test('half-open cargo route segment overlap rules', () => {
     assert.equal(segmentsOverlap(1, 3, 2, 4), true);
     assert.equal(segmentsOverlap(1, 3, 3, 5), false);
     assert.equal(segmentsOverlap(2, 4, 1, 5), true);
     assert.equal(segmentsOverlap(1, 5, 2, 3), true);
});
