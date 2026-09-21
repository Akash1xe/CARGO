const { UnauthorizedError, ForbiddenError } = require('../utils/error');

const requireRole = (...allowedRoles) => (req, res, next) => {
     if (!req.user) return next(new UnauthorizedError('Authentication required'));
     if (!allowedRoles.includes(req.user.role)) {
          return next(new ForbiddenError('Insufficient permissions'));
     }
     next();
};

module.exports = { requireRole };
