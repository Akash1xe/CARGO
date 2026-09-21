const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.ELASTICSEARCH_URL = 'http://localhost:9200';
process.env.ELASTICSEARCH_HUB_INDEX = 'cargoflow_hubs_test';
process.env.ELASTICSEARCH_VEHICLE_INDEX = 'cargoflow_vehicles_test';

const elastic = require('../../search-service/src/config/elasticsearch');
const searchService = require('../../search-service/src/services/search.service');

const originalIndex = elastic.esClient.index;
const originalUpdate = elastic.esClient.update;
const originalSearch = elastic.esClient.search;

test.after(async () => {
     elastic.esClient.index = originalIndex;
     elastic.esClient.update = originalUpdate;
     elastic.esClient.search = originalSearch;
     await elastic.esClient.close();
});

test('hub indexing uses the test-specific index and exact cargo document', async () => {
     let request;
     elastic.esClient.index = async value => { request = value; return {}; };
     await searchService.indexHub({ id: 'hub-1', name: 'Delhi Hub', code: 'DEL', city: 'Delhi', state: 'Delhi' });
     assert.equal(request.index, 'cargoflow_hubs_test');
     assert.equal(request.id, 'hub-1');
     assert.equal(request.document.code, 'DEL');
     assert.deepEqual(request.document.suggest.input, ['Delhi Hub', 'DEL', 'Delhi']);
});

test('cargo-trip indexing uses an idempotent replace-before-add script', async () => {
     let request;
     elastic.esClient.update = async value => { request = value; return {}; };
     await searchService.indexCargoTrip({
          tripId: 'trip-1', vehicleId: 'vehicle-1', vehicleNumber: 'CF-1', vehicleName: 'Carrier',
          vehicleType: 'TRUCK', departureDate: '2030-01-01', status: 'ACTIVE', totalCapacityUnits: 1,
          capacityUnits: [{ unitType: 'STANDARD' }], route: [],
     });
     assert.equal(request.index, 'cargoflow_vehicles_test');
     assert.match(request.script.source, /removeIf\(t -> t\.tripId == params\.trip\.tripId\)/);
     assert.equal(request.script.params.trip.tripId, 'trip-1');
});

test('missing origin hub returns a controlled empty result', async () => {
     elastic.esClient.search = async request => {
          if (request.suggest) return { suggest: { hub_suggest: [{ options: [] }] } };
          return { hits: { hits: [] } };
     };
     const result = await searchService.searchVehicles('unknown', 'DEL');
     assert.deepEqual(result.vehicles, []);
     assert.match(result.message, /not found/);
});

test('search rejects routes where origin does not precede destination', async () => {
     let call = 0;
     elastic.esClient.search = async () => {
          call += 1;
          if (call === 1) return { hits: { hits: [{ _source: { hubId: 'from', name: 'From', code: 'FRO' } }] } };
          if (call === 2) return { hits: { hits: [{ _source: { hubId: 'to', name: 'To', code: 'TO' } }] } };
          return {
               hits: { hits: [{
                    _source: { vehicleId: 'vehicle-1', trips: [{ tripId: 'trip-1', status: 'ACTIVE' }] },
                    inner_hits: {
                         from_hub: { hits: { hits: [{ _source: { hubId: 'from', sequenceNumber: 3 } }] } },
                         to_hub: { hits: { hits: [{ _source: { hubId: 'to', sequenceNumber: 2 } }] } },
                    },
               }] },
          };
     };
     const result = await searchService.searchVehicles('FRO', 'TO');
     assert.equal(result.count, 0);
     assert.deepEqual(result.vehicles, []);
});
