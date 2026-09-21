const prisma = require('../config/prisma');
const { BadRequestError, ConflictError, NotFoundError } = require('../utils/error');
const adminProducer = require('../kafka/producer/admin.producer');
const logger = require('../config/logger');

const CAPACITY_UNIT_TYPES = new Set(['STANDARD', 'FRAGILE', 'REFRIGERATED', 'HAZARDOUS']);

const validateCapacityUnits = (capacityUnits) => {
     if (!Array.isArray(capacityUnits) || capacityUnits.length === 0) {
          throw new BadRequestError('capacityUnits must be a non-empty array');
     }

     const unitNumbers = new Set();
     for (const unit of capacityUnits) {
          if (!unit || !Number.isInteger(unit.unitNumber) || unit.unitNumber < 1) {
               throw new BadRequestError('Each unitNumber must be a positive integer');
          }
          if (unitNumbers.has(unit.unitNumber)) {
               throw new BadRequestError('Duplicate capacity unit numbers found');
          }
          unitNumbers.add(unit.unitNumber);

          if (!CAPACITY_UNIT_TYPES.has(unit.unitType)) {
               throw new BadRequestError('Invalid capacity unit type');
          }
          if (typeof unit.price !== 'number' || !Number.isFinite(unit.price) || unit.price <= 0) {
               throw new BadRequestError('Each capacity unit price must be greater than zero');
          }
          if (typeof unit.maxWeightKg !== 'number' || !Number.isFinite(unit.maxWeightKg) || unit.maxWeightKg <= 0) {
               throw new BadRequestError('Each capacity unit maxWeightKg must be greater than zero');
          }
     }
};

const createVehicle = async ({ vehicleNumber, vehicleName, vehicleType, capacityUnits }) => {
     validateCapacityUnits(capacityUnits);

     const existing = await prisma.cargoVehicle.findUnique({ where: { vehicleNumber } });
     if (existing) throw new ConflictError('Cargo vehicle with this number already exists');

     const vehicle = await prisma.cargoVehicle.create({
          data: {
               vehicleNumber,
               vehicleName,
               vehicleType,
               totalCapacityUnits: capacityUnits.length,
               capacityUnits: {
                    create: capacityUnits.map((unit) => ({
                         unitNumber: unit.unitNumber,
                         unitType: unit.unitType,
                         price: unit.price,
                         maxWeightKg: unit.maxWeightKg,
                    })),
               },
          },
          include: { capacityUnits: { orderBy: { unitNumber: 'asc' } } },
     });

     await adminProducer.publishVehicleCreated(vehicle).catch((error) => {
          logger.error('Failed to publish vehicle created event', { error: error.message });
     });
     return vehicle;
};

const validateRouteHubs = (hubs) => {
     if (!Array.isArray(hubs) || hubs.length < 2) {
          throw new BadRequestError('hubs must contain at least two entries');
     }

     const hubIds = hubs.map((hub) => hub?.hubId);
     if (hubIds.some((hubId) => !hubId)) throw new BadRequestError('Each route hub requires a hubId');
     if (new Set(hubIds).size !== hubIds.length) {
          throw new BadRequestError('A hub cannot appear twice in the same transport route');
     }

     const sorted = [...hubs].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
     let previousDistance = -1;
     sorted.forEach((hub, index) => {
          if (!Number.isInteger(hub.sequenceNumber) || hub.sequenceNumber !== index + 1) {
               throw new BadRequestError('Sequence numbers must be continuous and start at 1');
          }

          const distance = hub.distanceFromOriginKm === undefined ? 0 : hub.distanceFromOriginKm;
          if (typeof distance !== 'number' || !Number.isFinite(distance) || distance < 0) {
               throw new BadRequestError('distanceFromOriginKm must be a non-negative number');
          }
          if (index > 0 && distance <= previousDistance) {
               throw new BadRequestError('distanceFromOriginKm must increase along the transport route');
          }
          previousDistance = distance;
     });
     return sorted;
};

const createTransportRoute = async ({ vehicleId, hubs }) => {
     const sortedHubs = validateRouteHubs(hubs);
     const vehicle = await prisma.cargoVehicle.findUnique({
          where: { id: vehicleId },
          include: { capacityUnits: { orderBy: { unitNumber: 'asc' } } },
     });
     if (!vehicle) throw new NotFoundError('Cargo vehicle not found');

     const existingRoute = await prisma.transportRoute.findUnique({ where: { vehicleId } });
     if (existingRoute) throw new ConflictError('Transport route already exists for this cargo vehicle');

     const hubIds = sortedHubs.map((hub) => hub.hubId);
     const existingHubs = await prisma.logisticsHub.findMany({ where: { id: { in: hubIds } } });
     if (existingHubs.length !== hubIds.length) {
          throw new BadRequestError('One or more logistics hub IDs are invalid');
     }

     const route = await prisma.transportRoute.create({
          data: {
               vehicleId,
               routeHubs: {
                    create: sortedHubs.map((hub) => ({
                         hubId: hub.hubId,
                         sequenceNumber: hub.sequenceNumber,
                         arrivalTime: hub.arrivalTime || null,
                         departureTime: hub.departureTime || null,
                         distanceFromOriginKm: hub.distanceFromOriginKm === undefined ? 0 : hub.distanceFromOriginKm,
                    })),
               },
          },
          include: {
               routeHubs: {
                    include: { hub: true },
                    orderBy: { sequenceNumber: 'asc' },
               },
          },
     });

     await adminProducer.publishTransportRouteCreated({ ...route, vehicle });
     return route;
};

const vehicleInclude = {
     capacityUnits: { orderBy: { unitNumber: 'asc' } },
     transportRoute: {
          include: {
               routeHubs: {
                    include: { hub: true },
                    orderBy: { sequenceNumber: 'asc' },
               },
          },
     },
};

const getAllVehicles = () => prisma.cargoVehicle.findMany({
     include: vehicleInclude,
     orderBy: { vehicleNumber: 'asc' },
});

const getVehicleById = async (id) => {
     const vehicle = await prisma.cargoVehicle.findUnique({ where: { id }, include: vehicleInclude });
     if (!vehicle) throw new NotFoundError('Cargo vehicle not found');
     return vehicle;
};

module.exports = {
     createVehicle,
     createTransportRoute,
     getAllVehicles,
     getVehicleById,
     validateCapacityUnits,
     validateRouteHubs,
};
