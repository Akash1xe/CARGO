const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { createProxy, getCircuitBreakerStatus } = require('../services/proxy');
const { ipRateLimit, endpointRateLimit, combinedRateLimit } = require('../middlewares/rateLimiting.middleware')
const { config } = require('../config');

const router = express.Router();
const attachTrustedAdminIdentity = (req, res, next) => {
     req.headers['x-internal-service-key'] = config.INTERNAL_SERVICE_KEY;
     next();
};

// ===========================
// Service Proxy Routes
// ===========================

/**
 * USER SERVICE ROUTES
 * Gateway Path: /api/users/auth/login
 * Service Path: /auth/login
**/

const userServiceProxy = createProxy('userService', config.SERVICES.USER_SERVICE_URL);

// public routes
router.post(
     '/users/auth/send-otp',
     endpointRateLimit(5, 3600000), // 5 requests per hour
     userServiceProxy
);

router.post(
     '/users/auth/verify-otp',
     endpointRateLimit(10, 3600000), // 10 requests per hour
     userServiceProxy
);

router.post(
     '/users/auth/login',
     endpointRateLimit(100, 900000),// 100 requests per 15 minutes
     userServiceProxy
);

router.post(
     '/users/auth/google-auth',
     endpointRateLimit(10, 900000), // 10 requests per 15 minutes
     userServiceProxy
);

router.post(
     '/users/auth/refresh',
     endpointRateLimit(20, 900000), // 20 requests per 15 minutes
     userServiceProxy
);

router.post(
     '/users/auth/logout',
     requireAuth,
     combinedRateLimit(),
     userServiceProxy
);

// private routes
router.get(
     '/users/user/profile',
     requireAuth,
     combinedRateLimit(),
     userServiceProxy
)

router.put(
     '/users/user/profile',
     requireAuth,
     combinedRateLimit(),
     userServiceProxy
)

router.delete(
     '/users/user/profile',
     requireAuth,
     combinedRateLimit(),
     userServiceProxy
)

const adminServiceProxy = createProxy('adminService', config.SERVICES.ADMIN_SERVICE_URL);

router.post(
     '/admins/hubs/hub',
     requireAuth,
     requireRole('ADMIN'),
     attachTrustedAdminIdentity,
     combinedRateLimit(),
     adminServiceProxy
);

router.post(
     '/admins/vehicles/vehicle',
     requireAuth,
     requireRole('ADMIN'),
     attachTrustedAdminIdentity,
     combinedRateLimit(),
     adminServiceProxy
);

router.post(
     '/admins/vehicles/route',
     requireAuth,
     requireRole('ADMIN'),
     attachTrustedAdminIdentity,
     combinedRateLimit(),
     adminServiceProxy
)

router.post(
     '/admins/trips/trip',
     requireAuth,
     requireRole('ADMIN'),
     attachTrustedAdminIdentity,
     combinedRateLimit(),
     adminServiceProxy
)

router.get(
     '/admins/hubs/hub',
     requireAuth,
     requireRole('ADMIN'),
     attachTrustedAdminIdentity,
     combinedRateLimit(),
     adminServiceProxy
)

router.get(
     '/admins/hubs/hub/:hubId',
     requireAuth,
     requireRole('ADMIN'),
     attachTrustedAdminIdentity,
     combinedRateLimit(),
     adminServiceProxy
);

router.get(
     '/admins/vehicles/vehicle',
     requireAuth,
     requireRole('ADMIN'),
     attachTrustedAdminIdentity,
     combinedRateLimit(),
     adminServiceProxy
);

router.get(
     '/admins/vehicles/vehicle/:vehicleId',
     requireAuth,
     requireRole('ADMIN'),
     attachTrustedAdminIdentity,
     combinedRateLimit(),
     adminServiceProxy
);

router.get(
     '/admins/trips/trip',
     requireAuth,
     requireRole('ADMIN'),
     attachTrustedAdminIdentity,
     combinedRateLimit(),
     adminServiceProxy
);

router.put(
     '/admins/trips/trip/:tripId',
     requireAuth,
     requireRole('ADMIN'),
     attachTrustedAdminIdentity,
     combinedRateLimit(),
     adminServiceProxy
)
// ===========================
// SEARCH SERVICE ROUTES (public - no auth required)
// ===========================
const searchServiceProxy = createProxy('searchService', config.SERVICES.SEARCH_SERVICE_URL);

router.get(
     '/search/vehicles',
     endpointRateLimit(60, 60000), // 60 requests per minute
     searchServiceProxy
);

router.get(
     '/search/autocomplete',
     endpointRateLimit(120, 60000), // 120 requests per minute
     searchServiceProxy
);

// ===========================
// INVENTORY SERVICE ROUTES (public read-only)
// ===========================
const inventoryServiceProxy = createProxy('inventoryService', config.SERVICES.INVENTORY_SERVICE_URL);

// Public: aggregate availability (used by search results)
router.get(
     '/inventory/trips/:tripId/availability',
     endpointRateLimit(120, 60000), // 120 requests per minute
     inventoryServiceProxy
);

// Authenticated: individual capacity-unit statuses
router.get(
     '/inventory/trips/:tripId/capacity-units',
     requireAuth,
     combinedRateLimit(),
     inventoryServiceProxy
);

// Note: lock/unlock/confirm/cancel-booking are now internal-only
// (called by booking-service directly, not through the gateway)

// ===========================
// SHIPMENT BOOKING SERVICE ROUTES
// ===========================
const bookingServiceProxy = createProxy('bookingService', config.SERVICES.BOOKING_SERVICE_URL);

router.post(
     '/shipments/shipments',
     requireAuth,
     endpointRateLimit(5, 60000), // 5 shipment attempts per minute
     bookingServiceProxy
);

router.get(
     '/shipments/shipments',
     requireAuth,
     combinedRateLimit(),
     bookingServiceProxy
);

router.get(
     '/shipments/shipments/:shipmentBookingId',
     requireAuth,
     combinedRateLimit(),
     bookingServiceProxy
);

router.post(
     '/shipments/shipments/:shipmentBookingId/verify-payment',
     requireAuth,
     combinedRateLimit(),
     bookingServiceProxy
);

router.post(
     '/shipments/shipments/:shipmentBookingId/cancel',
     requireAuth,
     combinedRateLimit(),
     bookingServiceProxy
);

// ===========================
// PAYMENT SERVICE ROUTES (webhook only - public)
// ===========================
const paymentServiceProxy = createProxy('paymentService', config.SERVICES.PAYMENT_SERVICE_URL);

// Razorpay webhook (public — no auth, signature-verified by payment-service)
router.post(
     '/payments/webhooks/razorpay',
     paymentServiceProxy
);

// Gateway Health Status

router.get('/gateway/health', (req, res) => {
     res.status(200).json({
          success: true,
          message: 'CargoFlow API Gateway is healthy',
          timestamp: new Date().toISOString()
     });
});

router.get('/gateway/circuit-breakers', (req, res) => {
     const status = getCircuitBreakerStatus();
     res.status(200).json({
          success: true,
          circuitBreakers: status,
     });
});

module.exports = router;
