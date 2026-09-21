const { esClient, HUB_INDEX, VEHICLE_INDEX } = require('../config/elasticsearch');
const logger = require('../config/logger');

const emptyCapacitySummary = () => ({
     total: 0,
     STANDARD: 0,
     FRAGILE: 0,
     REFRIGERATED: 0,
     HAZARDOUS: 0,
});

const summarizeCapacity = (capacityUnits = []) => {
     const summary = emptyCapacitySummary();
     for (const unit of capacityUnits) {
          summary.total += 1;
          if (Object.hasOwn(summary, unit.unitType)) summary[unit.unitType] += 1;
     }
     return summary;
};

const toHubDocument = (hub) => ({
     hubId: hub.id || hub.hubId,
     name: hub.name || hub.hubName,
     code: hub.code || hub.hubCode,
     city: hub.city,
     state: hub.state,
     latitude: hub.latitude,
     longitude: hub.longitude,
     suggest: {
          input: [hub.name || hub.hubName, hub.code || hub.hubCode, hub.city].filter(Boolean),
          weight: 10,
     },
});

const indexHub = async (event) => {
     const hub = event?.data || event;
     const document = hub && toHubDocument(hub);
     if (!document?.hubId) throw new Error('HUB_CREATED event is missing hub data');

     try {
          await esClient.index({ index: HUB_INDEX, id: document.hubId, document, refresh: true });
          logger.info(`Indexed hub ${document.name} (${document.code})`);
     } catch (error) {
          logger.error('Failed to index hub', { hubId: document.hubId, error: error.message });
          throw error;
     }
};

const normalizeRoute = (routeHubs = []) => routeHubs
     .map(routeHub => {
          const hub = routeHub.hub || routeHub;
          return {
               hubId: hub.id || routeHub.hubId,
               hubName: hub.name || routeHub.hubName,
               hubCode: hub.code || routeHub.hubCode,
               city: hub.city || routeHub.city,
               sequenceNumber: routeHub.sequenceNumber,
               arrivalTime: routeHub.arrivalTime,
               departureTime: routeHub.departureTime,
               distanceFromOriginKm: routeHub.distanceFromOriginKm,
          };
     })
     .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

const indexVehicleRoute = async (event) => {
     const vehicle = event?.vehicle;
     const route = normalizeRoute(event?.routeHubs || event?.route || []);
     if (!vehicle?.id || route.length === 0) {
          throw new Error('TRANSPORT_ROUTE_CREATED event is missing vehicle or route data');
     }

     const document = {
          vehicleId: vehicle.id,
          vehicleNumber: vehicle.vehicleNumber,
          vehicleName: vehicle.vehicleName,
          vehicleType: vehicle.vehicleType,
          route,
          capacitySummary: summarizeCapacity(vehicle.capacityUnits),
     };

     try {
          await esClient.update({
               index: VEHICLE_INDEX,
               id: vehicle.id,
               doc: document,
               upsert: { ...document, trips: [] },
               refresh: true,
          });

          for (const hub of route) {
               await esClient.index({
                    index: HUB_INDEX,
                    id: hub.hubId,
                    document: toHubDocument(hub),
                    refresh: true,
               });
          }
          logger.info(`Indexed vehicle ${vehicle.vehicleNumber} with ${route.length} route hubs`);
     } catch (error) {
          logger.error('Failed to index vehicle route', { vehicleId: vehicle.id, error: error.message });
          throw error;
     }
};

const indexCargoTrip = async (event) => {
     if (!event?.tripId || !event?.vehicleId) {
          throw new Error('CARGO_TRIP_CREATED event is missing tripId or vehicleId');
     }

     const capacitySummary = summarizeCapacity(event.capacityUnits);
     const route = normalizeRoute(event.route || []);
     const trip = {
          tripId: event.tripId,
          departureDate: event.departureDate,
          status: event.status,
          available: event.totalCapacityUnits,
          locked: 0,
          booked: 0,
     };
     const upsert = {
          vehicleId: event.vehicleId,
          vehicleNumber: event.vehicleNumber,
          vehicleName: event.vehicleName,
          vehicleType: event.vehicleType,
          route,
          trips: [trip],
          capacitySummary,
     };

     try {
          await esClient.update({
               index: VEHICLE_INDEX,
               id: event.vehicleId,
               scripted_upsert: true,
               script: {
                    source: `
                         if (ctx._source.trips == null) { ctx._source.trips = []; }
                         ctx._source.trips.removeIf(t -> t.tripId == params.trip.tripId);
                         ctx._source.trips.add(params.trip);
                         ctx._source.vehicleId = params.vehicleId;
                         ctx._source.vehicleNumber = params.vehicleNumber;
                         ctx._source.vehicleName = params.vehicleName;
                         ctx._source.vehicleType = params.vehicleType;
                         if (params.route != null && !params.route.isEmpty()) { ctx._source.route = params.route; }
                         ctx._source.capacitySummary = params.capacitySummary;
                    `,
                    params: { ...upsert, trip },
               },
               upsert,
               refresh: true,
          });
          logger.info(`Indexed cargo trip ${event.tripId} for vehicle ${event.vehicleId}`);
     } catch (error) {
          logger.error('Failed to index cargo trip', { tripId: event.tripId, error: error.message });
          throw error;
     }
};

const cancelCargoTrip = async (event) => {
     const trip = event?.data || event;
     if (!trip?.tripId || !trip?.vehicleId) throw new Error('CARGO_TRIP_CANCELLED event is incomplete');

     try {
          await esClient.update({
               index: VEHICLE_INDEX,
               id: trip.vehicleId,
               script: {
                    source: `
                         if (ctx._source.trips != null) {
                              for (def item : ctx._source.trips) {
                                   if (item.tripId == params.tripId) { item.status = 'CANCELLED'; }
                              }
                         }
                    `,
                    params: { tripId: trip.tripId },
               },
               refresh: true,
          });
          logger.info(`Cancelled cargo trip ${trip.tripId} in search index`);
     } catch (error) {
          logger.error('Failed to cancel cargo trip in search index', { tripId: trip.tripId, error: error.message });
          throw error;
     }
};

const updateCapacityAvailability = async (event) => {
     if (!event?.tripId || !event?.vehicleId) {
          throw new Error('CAPACITY_AVAILABILITY_UPDATED event is incomplete');
     }

     try {
          await esClient.update({
               index: VEHICLE_INDEX,
               id: event.vehicleId,
               script: {
                    source: `
                         if (ctx._source.trips != null) {
                              for (def trip : ctx._source.trips) {
                                   if (trip.tripId == params.tripId) {
                                        trip.available = params.available;
                                        trip.locked = params.locked;
                                        trip.booked = params.booked;
                                   }
                              }
                         }
                    `,
                    params: {
                         tripId: event.tripId,
                         available: event.available ?? 0,
                         locked: event.locked ?? 0,
                         booked: event.booked ?? 0,
                    },
               },
               refresh: true,
          });
          logger.info(`Updated capacity availability for trip ${event.tripId}`);
     } catch (error) {
          logger.error('Failed to update capacity availability', { tripId: event.tripId, error: error.message });
          throw error;
     }
};

const resolveHub = async (input) => {
     const exactResult = await esClient.search({
          index: HUB_INDEX,
          query: { term: { code: input.toUpperCase() } },
          size: 1,
     });
     if (exactResult.hits.hits.length > 0) return exactResult.hits.hits[0]._source;

     try {
          const suggestResult = await esClient.search({
               index: HUB_INDEX,
               suggest: {
                    hub_suggest: {
                         prefix: input,
                         completion: { field: 'suggest', fuzzy: { fuzziness: 'AUTO' }, size: 1 },
                    },
               },
          });
          const options = suggestResult.suggest?.hub_suggest?.[0]?.options || [];
          if (options.length > 0) return options[0]._source;
     } catch (error) {
          logger.warn(`Hub suggest fallback failed: ${error.message}`);
     }

     const fuzzyResult = await esClient.search({
          index: HUB_INDEX,
          query: {
               multi_match: {
                    query: input,
                    fields: ['name', 'city'],
                    fuzziness: 'AUTO',
                    prefix_length: 1,
               },
          },
          size: 1,
     });
     return fuzzyResult.hits.hits[0]?._source || null;
};

const normalizeDate = value => new Date(value).toISOString().slice(0, 10);

const searchVehicles = async (from, to, date) => {
     const fromHub = await resolveHub(from);
     const toHub = await resolveHub(to);

     if (!fromHub) return { vehicles: [], message: `Logistics hub "${from}" not found` };
     if (!toHub) return { vehicles: [], message: `Logistics hub "${to}" not found` };

     const result = await esClient.search({
          index: VEHICLE_INDEX,
          query: {
               bool: {
                    must: [
                         {
                              nested: {
                                   path: 'route',
                                   query: { term: { 'route.hubId': fromHub.hubId } },
                                   inner_hits: { name: 'from_hub' },
                              },
                         },
                         {
                              nested: {
                                   path: 'route',
                                   query: { term: { 'route.hubId': toHub.hubId } },
                                   inner_hits: { name: 'to_hub' },
                              },
                         },
                    ],
               },
          },
          size: 50,
     });

     const vehicles = result.hits.hits.map(hit => {
          const source = hit._source;
          const fromRouteHub = hit.inner_hits?.from_hub?.hits?.hits?.[0]?._source;
          const toRouteHub = hit.inner_hits?.to_hub?.hits?.hits?.[0]?._source;
          if (!fromRouteHub || !toRouteHub || fromRouteHub.sequenceNumber >= toRouteHub.sequenceNumber) {
               return null;
          }

          const activeTrips = (source.trips || []).filter(trip => trip.status === 'ACTIVE');
          const matchingTrip = date
               ? activeTrips.find(trip => normalizeDate(trip.departureDate) === date)
               : activeTrips[0] || null;
          if (date && !matchingTrip) return null;

          return {
               vehicleId: source.vehicleId,
               vehicleNumber: source.vehicleNumber,
               vehicleName: source.vehicleName,
               vehicleType: source.vehicleType,
               from: {
                    hubId: fromRouteHub.hubId,
                    name: fromRouteHub.hubName,
                    code: fromRouteHub.hubCode,
                    departure: fromRouteHub.departureTime,
                    sequenceNumber: fromRouteHub.sequenceNumber,
               },
               to: {
                    hubId: toRouteHub.hubId,
                    name: toRouteHub.hubName,
                    code: toRouteHub.hubCode,
                    arrival: toRouteHub.arrivalTime,
                    sequenceNumber: toRouteHub.sequenceNumber,
               },
               fromSeq: fromRouteHub.sequenceNumber,
               toSeq: toRouteHub.sequenceNumber,
               capacitySummary: source.capacitySummary || emptyCapacitySummary(),
               trip: matchingTrip,
          };
     }).filter(Boolean);

     return {
          from: { resolved: fromHub.name, code: fromHub.code },
          to: { resolved: toHub.name, code: toHub.code },
          date: date || 'any',
          count: vehicles.length,
          vehicles,
     };
};

const autocompleteHub = async (prefix) => {
     const result = await esClient.search({
          index: HUB_INDEX,
          suggest: {
               hub_suggest: {
                    prefix,
                    completion: { field: 'suggest', fuzzy: { fuzziness: 'AUTO' }, size: 10 },
               },
          },
     });
     const options = result.suggest?.hub_suggest?.[0]?.options || [];
     return options.map(option => ({
          name: option._source.name,
          code: option._source.code,
          hubId: option._source.hubId,
     }));
};

const getAllHubs = async () => {
     const result = await esClient.search({ index: HUB_INDEX, query: { match_all: {} }, size: 100 });
     return result.hits.hits.map(hit => hit._source);
};

const getAllVehicles = async () => {
     const result = await esClient.search({ index: VEHICLE_INDEX, query: { match_all: {} }, size: 100 });
     return result.hits.hits.map(hit => hit._source);
};

module.exports = {
     indexHub,
     indexVehicleRoute,
     indexCargoTrip,
     cancelCargoTrip,
     updateCapacityAvailability,
     searchVehicles,
     autocompleteHub,
     getAllHubs,
     getAllVehicles,
};
