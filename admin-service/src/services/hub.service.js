const prisma = require('../config/prisma');
const { BadRequestError, ConflictError, NotFoundError } = require('../utils/error');
const logger = require('../config/logger');
const adminProducer = require('../kafka/producer/admin.producer');

const validateOptionalCoordinate = (value, fieldName) => {
     if (value !== undefined && value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
          throw new BadRequestError(`${fieldName} must be a finite number`);
     }
};

const createHub = async (data) => {
     validateOptionalCoordinate(data.latitude, 'latitude');
     validateOptionalCoordinate(data.longitude, 'longitude');

     const existing = await prisma.logisticsHub.findFirst({
          where: { OR: [{ code: data.code }, { name: data.name }] },
     });
     if (existing?.code === data.code) throw new ConflictError('Logistics hub code already exists');
     if (existing) throw new ConflictError('Logistics hub name already exists');

     const hub = await prisma.logisticsHub.create({ data });
     logger.info('Logistics hub created', { id: hub.id, code: hub.code });

     await adminProducer.publishHubCreated(hub).catch((error) => {
          logger.error('Failed to publish hub created event', { error: error.message });
     });
     return hub;
};

const getAllHubs = async (page, limit, search) => {
     const skip = (page - 1) * limit;
     const where = search ? {
          OR: [
               { code: { contains: search, mode: 'insensitive' } },
               { name: { contains: search, mode: 'insensitive' } },
               { city: { contains: search, mode: 'insensitive' } },
          ],
     } : {};

     const [hubs, total] = await Promise.all([
          prisma.logisticsHub.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
          prisma.logisticsHub.count({ where }),
     ]);
     return { hubs, total };
};

const getHubById = async (hubId) => {
     const hub = await prisma.logisticsHub.findUnique({ where: { id: hubId } });
     if (!hub) throw new NotFoundError('Logistics hub not found');
     return hub;
};

module.exports = { createHub, getAllHubs, getHubById };
