const { BadRequestError, ConflictError, NotFoundError } = require('../utils/error');
const adminProducer = require('../kafka/producer/admin.producer');
const logger = require('../config/logger');
const prisma = require('../config/prisma');

const parseDepartureDate = (value) => {
     if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          throw new BadRequestError('Invalid departure date format. Use YYYY-MM-DD');
     }
     const parsed = new Date(`${value}T00:00:00.000Z`);
     if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
          throw new BadRequestError('Invalid departure date');
     }
     return parsed;
};

const createTrip = async ({ vehicleId, departureDate }) => {
     const vehicle = await prisma.cargoVehicle.findUnique({
          where: { id: vehicleId },
          include: {
               capacityUnits: { orderBy: { unitNumber: 'asc' } },
               transportRoute: {
                    include: {
                         routeHubs: {
                              include: { hub: true },
                              orderBy: { sequenceNumber: 'asc' },
                         },
                    },
               },
          },
     });

     if (!vehicle) throw new NotFoundError('Cargo vehicle not found');
     if (!vehicle.transportRoute) {
          throw new BadRequestError('Cargo vehicle has no transport route. Create a route first.');
     }
     if (vehicle.capacityUnits.length === 0) {
          throw new BadRequestError('Cargo vehicle has no capacity units defined.');
     }

     const parsedDate = parseDepartureDate(departureDate);
     const existing = await prisma.cargoTrip.findUnique({
          where: { vehicleId_departureDate: { vehicleId, departureDate: parsedDate } },
     });
     if (existing) throw new ConflictError('Cargo trip already exists for this vehicle on this date');

     const trip = await prisma.cargoTrip.create({ data: { vehicleId, departureDate: parsedDate } });
     const eventPayload = {
          tripId: trip.id,
          vehicleId: vehicle.id,
          vehicleNumber: vehicle.vehicleNumber,
          vehicleName: vehicle.vehicleName,
          vehicleType: vehicle.vehicleType,
          totalCapacityUnits: vehicle.totalCapacityUnits,
          departureDate,
          status: trip.status,
          capacityUnits: vehicle.capacityUnits.map((unit) => ({
               capacityUnitId: unit.id,
               unitNumber: unit.unitNumber,
               unitType: unit.unitType,
               price: unit.price,
               maxWeightKg: unit.maxWeightKg,
          })),
          route: vehicle.transportRoute.routeHubs.map((routeHub) => ({
               hubId: routeHub.hub.id,
               hubName: routeHub.hub.name,
               hubCode: routeHub.hub.code,
               city: routeHub.hub.city,
               sequenceNumber: routeHub.sequenceNumber,
               arrivalTime: routeHub.arrivalTime,
               departureTime: routeHub.departureTime,
               distanceFromOriginKm: routeHub.distanceFromOriginKm,
          })),
     };

     await adminProducer.publishCargoTripCreated(eventPayload);
     logger.info('Cargo trip created and event published', {
          tripId: trip.id,
          vehicleNumber: vehicle.vehicleNumber,
          departureDate,
     });
     return trip;
};

const getAllTrips = (query = {}) => {
     const where = {};
     if (query.vehicleId) where.vehicleId = query.vehicleId;
     if (query.status) {
          if (!['ACTIVE', 'CANCELLED'].includes(query.status)) {
               throw new BadRequestError('status must be ACTIVE or CANCELLED');
          }
          where.status = query.status;
     }
     if (query.date) where.departureDate = parseDepartureDate(query.date);

     return prisma.cargoTrip.findMany({
          where,
          include: {
               vehicle: {
                    include: {
                         transportRoute: {
                              include: {
                                   routeHubs: {
                                        include: { hub: true },
                                        orderBy: { sequenceNumber: 'asc' },
                                   },
                              },
                         },
                    },
               },
          },
          orderBy: { departureDate: 'asc' },
     });
};

const cancelTrip = async (tripId) => {
     const trip = await prisma.cargoTrip.findUnique({ where: { id: tripId } });
     if (!trip) throw new NotFoundError('Cargo trip not found');

     const updated = await prisma.cargoTrip.update({
          where: { id: tripId },
          data: { status: 'CANCELLED' },
     });
     await adminProducer.publishCargoTripCancelled({
          tripId: updated.id,
          vehicleId: updated.vehicleId,
          departureDate: updated.departureDate.toISOString().slice(0, 10),
          status: updated.status,
     });
     return updated;
};

module.exports = { createTrip, getAllTrips, cancelTrip };
