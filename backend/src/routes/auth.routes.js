'use strict';

const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const authMiddleware  = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate');
const { loginSchema, registerSchema, employeeCreateSchema, passwordChangeSchema } = require('../schemas/auth.schema');

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per window
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Public ────────────────────────────────────────────────────────────────
// POST /api/v1/auth/login
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// POST /api/v1/auth/register
router.post('/register', authLimiter, validate(registerSchema), authController.register);

// POST /api/v1/auth/logout
router.post('/logout', authController.logout);

// POST /api/v1/auth/google
router.post('/google', authLimiter, authController.googleLogin);

const requireRole = require('../middleware/requireRole');

// ─── Protected ────────────────────────────────────────────────────────────
// GET /api/v1/auth/me  — requires valid token
router.get('/me', authMiddleware, authController.me);

// GET /api/v1/auth/employees - List all employees (ADMIN only)
router.get('/employees', authMiddleware, requireRole('ADMIN'), authController.listEmployees);

// POST /api/v1/auth/employees - Create a new employee (ADMIN only)
router.post('/employees', authMiddleware, requireRole('ADMIN'), validate(employeeCreateSchema), authController.createEmployee);

// PUT /api/v1/auth/employees/:id/status - Activate or Deactivate employee status (ADMIN only)
router.put('/employees/:id/status', authMiddleware, requireRole('ADMIN'), authController.updateEmployeeStatus);

// POST /api/v1/auth/employees/:id/reset-password - Force employee password reset (ADMIN only)
router.post('/employees/:id/reset-password', authMiddleware, requireRole('ADMIN'), authController.forcePasswordReset);

// PUT /api/v1/auth/password - User changing their own password (ADMIN, EMPLOYEE and CUSTOMER)
router.put('/password', authMiddleware, requireRole('ADMIN', 'EMPLOYEE', 'CUSTOMER'), validate(passwordChangeSchema), authController.changePassword);

// GET /api/v1/auth/activity-logs - Retrieve employee activity logs (ADMIN only)
router.get('/activity-logs', authMiddleware, requireRole('ADMIN'), authController.getActivityLogs);

// GET /api/v1/auth/customers - Retrieve registered customer profiles (ADMIN only)
router.get('/customers', authMiddleware, requireRole('ADMIN'), authController.listCustomers);

// PUT /api/v1/auth/profile - Update user / customer profile
router.put('/profile', authMiddleware, authController.updateProfile);

module.exports = router;

