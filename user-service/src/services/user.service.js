const { config } = require('../config');
const { redis } = require('../config/redis');
const prisma = require('../config/prisma');
const { NotFoundError, BadRequestError } = require('../utils/error');

const safeSelect = {
     id: true,
     firstName: true,
     lastName: true,
     email: true,
     emailVerified: true,
     role: true,
     createdAt: true,
     updatedAt: true,
};

const cacheUser = async (user) => {
     await redis.set(`user:${user.id}`, JSON.stringify(user), 'EX', config.REDIS_USER_TTL);
     return user;
};

const getProfile = async (userId) => {
     const storedUser = await redis.get(`user:${userId}`);
     if (storedUser) return JSON.parse(storedUser);
     const user = await prisma.user.findUnique({ where: { id: userId }, select: safeSelect });
     if (!user) throw new NotFoundError('User not found');
     return cacheUser(user);
};

const updateProfile = async (userId, input) => {
     const data = {};
     for (const field of ['firstName', 'lastName']) {
          if (input[field] !== undefined) {
               if (typeof input[field] !== 'string' || !input[field].trim()) {
                    throw new BadRequestError(`${field} must be a non-empty string`);
               }
               data[field] = input[field].trim();
          }
     }
     if (!Object.keys(data).length) throw new BadRequestError('No supported profile fields supplied');
     const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
     if (!exists) throw new NotFoundError('User not found');
     const user = await prisma.user.update({ where: { id: userId }, data, select: safeSelect });
     await redis.del(`user:${userId}`);
     return cacheUser(user);
};

const deleteRefreshSessions = async (userId) => {
     let cursor = '0';
     do {
          const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `refresh:${userId}:*`, 'COUNT', 100);
          cursor = nextCursor;
          if (keys.length) await redis.del(...keys);
     } while (cursor !== '0');
};

const deleteProfile = async (userId) => {
     const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
     if (!exists) throw new NotFoundError('User not found');
     await prisma.user.delete({ where: { id: userId } });
     await redis.del(`user:${userId}`);
     await deleteRefreshSessions(userId);
};

module.exports = { getProfile, updateProfile, deleteProfile };
