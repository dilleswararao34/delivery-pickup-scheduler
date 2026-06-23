'use strict';

const authService = require('../services/auth.service');
const activityLogService = require('../services/activityLog.service');

/**
 * POST /api/v1/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false, data: null,
        meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.', fields: null },
      });
    }

    const result = await authService.authenticate(email, password);

    res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        tokenType:   'Bearer',
        expiresIn:   '8h',
        user: result.user,
      },
      meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
      error: null,
    });
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      return res.status(err.statusCode).json({
        success: false, data: null,
        meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
        error: { code: err.code || 'AUTH_ERROR', message: err.message, fields: null },
      });
    }
    next(err);
  }
}

/**
 * POST /api/v1/auth/logout
 * Stateless JWT — client discards the token. Returns 200.
 */
function logout(req, res) {
  res.status(200).json({
    success: true,
    data: { message: 'Logged out successfully. Discard your access token.' },
    meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
    error: null,
  });
}

/**
 * GET /api/v1/auth/me
 * Returns current user from the verified JWT (populated by authMiddleware).
 */
function me(req, res) {
  res.status(200).json({
    success: true,
    data: { user: req.user },
    meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
    error: null,
  });
}

/**
 * POST /api/v1/auth/register
 */
async function register(req, res, next) {
  try {
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false, data: null,
        meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
        error: { code: 'VALIDATION_ERROR', message: 'Name, email, password, and role are required.', fields: null },
      });
    }

    if (role !== 'CUSTOMER') {
      return res.status(400).json({
        success: false, data: null,
        meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
        error: { code: 'FORBIDDEN_REGISTRATION', message: 'Only customer registrations are allowed through the public portal.', fields: null },
      });
    }

    const result = await authService.registerUser({ name, email, password, role, phone });

    res.status(201).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        tokenType:   'Bearer',
        expiresIn:   '8h',
        user: result.user,
      },
      meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
      error: null,
    });
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 409) {
      return res.status(err.statusCode).json({
        success: false, data: null,
        meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
        error: { code: err.code || 'REGISTER_ERROR', message: err.message, fields: null },
      });
    }
    next(err);
  }
}

/**
 * POST /api/v1/auth/google
 */
async function googleLogin(req, res, next) {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false, data: null,
        meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
        error: { code: 'VALIDATION_ERROR', message: 'Name and email are required for Google Login.', fields: null },
      });
    }

    const result = await authService.googleAuthenticate({ name, email });

    res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        tokenType:   'Bearer',
        expiresIn:   '8h',
        user: result.user,
      },
      meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
      error: null,
    });
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 403 || err.statusCode === 409) {
      return res.status(err.statusCode).json({
        success: false, data: null,
        meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
        error: { code: err.code || 'AUTH_ERROR', message: err.message, fields: null },
      });
    }
    next(err);
  }
}

// GET /api/v1/auth/employees
async function listEmployees(req, res, next) {
  try {
    const employees = await authService.listEmployees();
    res.json({ success: true, data: employees });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/employees
async function createEmployee(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name, email, and password are required.' }
      });
    }

    const employee = await authService.registerUser({ name, email, password, role: 'EMPLOYEE' });
    
    // Dispatch onboarding welcome email with temporary password
    try {
      const notificationsService = require('../services/notifications.service');
      await notificationsService.sendEmployeeWelcome(email, name, password);
    } catch (mailErr) {
      console.error('[AuthController] Failed to send onboarding welcome email:', mailErr.message);
    }

    // Log audit activity
    await activityLogService.logAction({
      userId: req.user.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'CREATE_EMPLOYEE',
      entityType: 'USER',
      entityId: employee.user.userId,
      details: `Created employee account for ${email}`
    });

    res.status(201).json({ success: true, data: employee.user });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/auth/employees/:id/status
async function updateEmployeeStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    if (is_active === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'is_active field is required.' }
      });
    }

    const updated = await authService.updateUserStatus(id, is_active);
    
    // Log audit activity
    await activityLogService.logAction({
      userId: req.user.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'UPDATE_EMPLOYEE_STATUS',
      entityType: 'USER',
      entityId: id,
      details: `Set employee active status to ${is_active}`
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/employees/:id/reset-password
async function forcePasswordReset(req, res, next) {
  try {
    const { id } = req.params;
    const { tempPassword } = req.body;
    if (!tempPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'tempPassword is required.' }
      });
    }

    await authService.forceUserPassword(id, tempPassword);
    
    // Log audit activity
    await activityLogService.logAction({
      userId: req.user.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'PASSWORD_RESET_FORCED',
      entityType: 'USER',
      entityId: id,
      details: `Admin forced password reset for employee`
    });

    res.json({ success: true, data: { message: 'Password reset successfully.' } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/auth/password
async function changePassword(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Old and new passwords are required.' }
      });
    }

    await authService.changeUserPassword(req.user.userId, oldPassword, newPassword);

    // Log audit activity
    await activityLogService.logAction({
      userId: req.user.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'PASSWORD_CHANGED',
      entityType: 'USER',
      entityId: req.user.userId,
      details: 'User updated their password'
    });

    res.json({ success: true, data: { message: 'Password updated successfully.' } });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/auth/activity-logs
async function getActivityLogs(req, res, next) {
  try {
    const { userId, dateFrom, dateTo, page, limit } = req.query;
    const logs = await activityLogService.getActivityLogs({
      userId,
      dateFrom,
      dateTo,
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '50', 10)
    });
    res.json({ success: true, data: logs.data, meta: { pagination: logs.pagination } });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/auth/customers
async function listCustomers(req, res, next) {
  try {
    const customers = await authService.listCustomers();
    res.json({ success: true, data: customers });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/auth/profile
async function updateProfile(req, res, next) {
  try {
    const { name, phone, company, billing_address } = req.body;
    const updated = await authService.updateUserProfile(req.user.userId, req.user.role, {
      name, phone, company, billing_address
    });
    
    // Log profile update if employee/admin
    if (req.user.role === 'ADMIN' || req.user.role === 'EMPLOYEE') {
      await activityLogService.logAction({
        userId: req.user.userId,
        userName: req.user.name,
        userEmail: req.user.email,
        action: 'UPDATE_PROFILE',
        entityType: 'USER',
        entityId: req.user.userId,
        details: `Updated user profile details`
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  logout,
  me,
  register,
  googleLogin,
  listEmployees,
  createEmployee,
  updateEmployeeStatus,
  forcePasswordReset,
  changePassword,
  getActivityLogs,
  listCustomers,
  updateProfile
};

