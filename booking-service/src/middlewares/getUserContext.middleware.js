const { UnauthorizedError } = require('../utils/error');

function getUserContext(req, res, next) {
     const userId = req.headers['x-user-id'];
     const role = req.headers['x-user-role'];

     if (!userId) {
          return next(
               new UnauthorizedError('User context missing - must come through gateway')
          );
     }

     req.user = { id: userId, role };
     next();
}

module.exports = { getUserContext };
