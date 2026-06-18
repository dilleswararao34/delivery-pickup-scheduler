'use strict';

const db = require('../config/db');
const bookingsService = require('../services/bookings.service');
const stateMachine = require('../services/stateMachine.service');
const ruleEngine = require('../services/ruleEngine.service');
const alertsService = require('../services/alerts.service');

function respond(res, statusCode, data, meta = {}) {
  res.status(statusCode).json({
    success: true,
    data,
    meta: {
      requestId: res.req.requestId || null,
      timestamp: new Date().toISOString(),
      pagination: meta.pagination || null
    },
    error: null,
  });
}

function respondError(res, statusCode, code, message, fields = null) {
  res.status(statusCode).json({
    success: false,
    data: null,
    meta: {
      timestamp: new Date().toISOString()
    },
    error: { code, message, fields }
  });
}

// POST /api/v1/create
async function create(req, res) {
  console.log(`[operations] POST /create triggered - Request ID: ${req.requestId}`);
  try {
    const { customer, creator, equipment_ids, location, scheduled_delivery_date, scheduled_return_date, notes } = req.body;

    // Validation
    const errors = {};
    if (!customer || !customer.name || !customer.email || !customer.phone) {
      errors.customer = 'Customer name, email, and phone are required.';
    }
    if (!equipment_ids || !Array.isArray(equipment_ids) || equipment_ids.length === 0) {
      errors.equipment_ids = 'At least one equipment ID must be selected.';
    }
    if (!scheduled_delivery_date) {
      errors.scheduled_delivery_date = 'Scheduled delivery date is required.';
    }
    if (!scheduled_return_date) {
      errors.scheduled_return_date = 'Scheduled return date is required.';
    }
    if (scheduled_delivery_date && scheduled_return_date && new Date(scheduled_return_date) <= new Date(scheduled_delivery_date)) {
      errors.date_range = 'Return date must be after delivery date.';
    }

    if (Object.keys(errors).length > 0) {
      console.warn(`[operations] Validation failed on /create:`, errors);
      return respondError(res, 400, 'VALIDATION_FAILED', 'Invalid input data.', errors);
    }

    // Equipment conflict check
    const conflicts = await alertsService.checkEquipmentConflict(equipment_ids, scheduled_delivery_date, scheduled_return_date);
    if (conflicts.length) {
      const conflictMsg = `Equipment conflict detected: ${conflicts.map((c) => `${c.equipment_name} (booked in ${c.booking_ref})`).join(', ')}`;
      console.warn(`[operations] Conflict on /create: ${conflictMsg}`);
      return respondError(res, 409, 'EQUIPMENT_CONFLICT', conflictMsg);
    }

    if (!req.user) {
      console.warn('[operations] req.user is missing on booking creation. Using default creator.');
    }

    // Default creator if not present
    const creatorDetails = creator || {
      operator_name: req.user?.name || 'Customer Portal',
      operator_email: req.user?.email || null
    };

    const booking = await bookingsService.createBooking({
      customer,
      creator: creatorDetails,
      equipment_ids,
      location,
      scheduled_delivery_date,
      scheduled_return_date,
      notes,
      source: req.user?.role === 'ADMIN' ? 'WEBSITE' : 'PORTAL'
    });

    if (req.user?.role === 'ADMIN' || req.user?.role === 'EMPLOYEE') {
      const activityLogService = require('../services/activityLog.service');
      await activityLogService.logAction({
        userId: req.user.userId,
        userName: req.user.name,
        userEmail: req.user.email,
        action: 'CREATE_BOOKING',
        entityType: 'BOOKING',
        entityId: booking.booking_id,
        details: `Created booking ${booking.booking_ref} for ${customer.name}`
      });
    }

    respond(res, 201, booking);
  } catch (err) {
    console.error(`[operations] Error in /create:`, err);
    respondError(res, 500, 'SERVER_ERROR', err.message || 'Internal server error occurred.');
  }
}

// GET /api/v1/list
async function list(req, res) {
  console.log(`[operations] GET /list triggered - Request ID: ${req.requestId}`);
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '25', 10);
    const sort = req.query.sort || 'created_at';
    const order = req.query.order || 'desc';

    const filters = {
      status: req.query.status,
      priority: req.query.priority,
      source: req.query.source,
      assigned_owner: req.query.assigned_owner,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      customer_name: req.query.customer_name,
      customer_email: req.user?.role === 'CUSTOMER' ? req.user.email : req.query.customer_email,
      page,
      limit,
      sort,
      order
    };

    const result = await bookingsService.listBookings(filters);
    respond(res, 200, result.data, { pagination: result.pagination });
  } catch (err) {
    console.error(`[operations] Error in /list:`, err);
    respondError(res, 500, 'SERVER_ERROR', err.message || 'Internal server error occurred.');
  }
}

// GET /api/v1/detail/:id
async function detail(req, res) {
  const { id } = req.params;
  console.log(`[operations] GET /detail/${id} triggered - Request ID: ${req.requestId}`);
  try {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(id)) {
      return respondError(res, 400, 'INVALID_ID_FORMAT', 'Booking ID must be a valid UUID.');
    }

    const booking = await bookingsService.getBookingById(id);
    respond(res, 200, booking);
  } catch (err) {
    console.error(`[operations] Error in /detail/:id:`, err);
    if (err.code === 'BOOKING_NOT_FOUND') {
      return respondError(res, 404, 'NOT_FOUND', err.message);
    }
    respondError(res, 500, 'SERVER_ERROR', err.message || 'Internal server error occurred.');
  }
}

// POST /api/v1/process
async function processRules(req, res) {
  const { booking_id } = req.body;
  console.log(`[operations] POST /process triggered for ID: ${booking_id}`);
  try {
    if (!booking_id) {
      return respondError(res, 400, 'VALIDATION_FAILED', 'booking_id is required.');
    }

    const result = await ruleEngine.processBookingRules(booking_id, db);
    if (!result) {
      return respondError(res, 404, 'NOT_FOUND', `Booking ${booking_id} not found.`);
    }

    respond(res, 200, result);
  } catch (err) {
    console.error(`[operations] Error in /process:`, err);
    respondError(res, 500, 'SERVER_ERROR', err.message || 'Internal server error occurred.');
  }
}

// POST /api/v1/status-update
async function statusUpdate(req, res) {
  const { booking_id, new_status, changed_by, reason, operations_update } = req.body;
  console.log(`[operations] POST /status-update triggered for ID: ${booking_id} -> ${new_status}`);
  try {
    if (!booking_id || !new_status) {
      return respondError(res, 400, 'VALIDATION_FAILED', 'booking_id and new_status are required.');
    }

    const operatorName = changed_by || req.user?.name || 'System Auto-Workflow';
    const result = await stateMachine.transition(booking_id, new_status, operatorName, reason, operations_update);

    if (req.user?.role === 'ADMIN' || req.user?.role === 'EMPLOYEE') {
      const activityLogService = require('../services/activityLog.service');
      await activityLogService.logAction({
        userId: req.user.userId,
        userName: req.user.name,
        userEmail: req.user.email,
        action: 'UPDATE_BOOKING_STATUS',
        entityType: 'BOOKING',
        entityId: booking_id,
        details: `Transitioned status to ${new_status}. Reason: ${reason || 'none'}`
      });
    }

    respond(res, 200, result);
  } catch (err) {
    console.error(`[operations] Error in /status-update:`, err);
    const code = err.code || 'SERVER_ERROR';
    const status = err.statusCode || 500;
    respondError(res, status, code, err.message);
  }
}

// GET /api/v1/dashboard
async function getDashboard(req, res) {
  console.log(`[operations] GET /dashboard triggered by user: ${req.user?.email}`);
  try {
    // 1. Booking status metrics
    const statusCounts = await db.query(
      `SELECT status, COUNT(*)::int as count FROM bookings WHERE is_deleted = FALSE GROUP BY status`
    );

    // 2. Equipment utilization metrics
    const equipCounts = await db.query(
      `SELECT status, COUNT(*)::int as count FROM equipment GROUP BY status`
    );

    // 3. Alerts count
    const activeAlerts = await alertsService.getActiveAlerts(10);
    const alertCountRes = await db.query(
      `SELECT COUNT(*)::int FROM system_alerts WHERE resolved_at IS NULL AND dispatched_status = FALSE`
    );
    const totalAlerts = alertCountRes.rows[0].count;

    // 4. Overdue returns count
    const overdueRes = await db.query(
      `SELECT COUNT(*)::int
       FROM bookings
       WHERE is_deleted = FALSE
         AND status IN ('AWAITING_PICKUP', 'DELIVERED')
         AND scheduled_return_date < NOW()`
    );
    const overdueCount = overdueRes.rows[0].count;

    // 5. Recent activity log
    const recentHistory = await db.query(
      `SELECT h.*, b.booking_ref, c.name as customer_name
       FROM booking_status_history h
       JOIN bookings b ON h.booking_id = b.id
       JOIN customers c ON b.customer_id = c.id
       ORDER BY h.changed_at DESC
       LIMIT 10`
    );

    // 6. Build response stats
    const stats = {
      bookings: {
        total: statusCounts.rows.reduce((sum, r) => sum + r.count, 0),
        by_status: statusCounts.rows.reduce((acc, r) => { acc[r.status] = r.count; return acc; }, {}),
        overdue_returns: overdueCount,
      },
      equipment: {
        total: equipCounts.rows.reduce((sum, r) => sum + r.count, 0),
        by_status: equipCounts.rows.reduce((acc, r) => { acc[r.status] = r.count; return acc; }, {}),
      },
      alerts: {
        total_active: totalAlerts,
        recent: activeAlerts,
      },
      recent_activity: recentHistory.rows
    };

    respond(res, 200, stats);
  } catch (err) {
    console.error(`[operations] Error in /dashboard:`, err);
    respondError(res, 500, 'SERVER_ERROR', err.message || 'Internal server error occurred.');
  }
}

// POST /api/v1/damage-report
async function logDamageReport(req, res) {
  const { booking_id, equipment_id, reported_by, description, estimated_cost } = req.body;
  console.log(`[operations] POST /damage-report triggered for booking ${booking_id}`);
  const client = await db.getClient();
  try {
    if (!booking_id || !equipment_id || !description) {
      return respondError(res, 400, 'VALIDATION_FAILED', 'booking_id, equipment_id, and description are required.');
    }

    await client.query('BEGIN');

    // 1. Insert damage report
    const damageRes = await client.query(
      `INSERT INTO damage_reports (booking_id, equipment_id, reported_by, description, estimated_cost)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [booking_id, equipment_id, reported_by || req.user?.name || 'Logistics Operator', description, estimated_cost || 0]
    );

    // 2. Set equipment status to IN_MAINTENANCE
    await client.query(
      `UPDATE equipment SET status = 'IN_MAINTENANCE' WHERE id = $1`,
      [equipment_id]
    );

    // 3. Create system alert
    const bookingRes = await client.query('SELECT booking_ref FROM bookings WHERE id = $1', [booking_id]);
    const bookingRef = bookingRes.rows[0]?.booking_ref || 'Unknown';
    const equipRes = await client.query('SELECT name FROM equipment WHERE id = $1', [equipment_id]);
    const equipName = equipRes.rows[0]?.name || 'Unknown';

    // 3. Create system alert
    await client.query(
      `INSERT INTO system_alerts (related_entity, trigger_type, priority, message)
       VALUES ($1, $2, $3, $4)`,
      [`booking:${bookingRef}`, 'GEAR_DAMAGED', 'HIGH', `Equipment ${equipName} reported damaged on booking ${bookingRef}. Cost est: ₹${estimated_cost || 0}. Details: ${description}`]
    );

    if (req.user?.role === 'ADMIN' || req.user?.role === 'EMPLOYEE') {
      const activityLogService = require('../services/activityLog.service');
      await activityLogService.logAction({
        userId: req.user.userId,
        userName: req.user.name,
        userEmail: req.user.email,
        action: 'CREATE_DAMAGE_REPORT',
        entityType: 'DAMAGE_REPORT',
        entityId: damageRes.rows[0].id,
        details: `Reported damage on equipment ${equipName} for booking ${bookingRef}`
      }, client);
    }

    await client.query('COMMIT');

    respond(res, 201, damageRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[operations] Error in /damage-report:`, err);
    respondError(res, 500, 'SERVER_ERROR', err.message || 'Internal server error occurred.');
  } finally {
    client.release();
  }
}

// POST /api/v1/operations/trigger-daily-jobs
async function triggerDailyJobs(req, res) {
  console.log(`[operations] POST /trigger-daily-jobs triggered - Request ID: ${req.requestId}`);
  try {
    if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'EMPLOYEE') {
      return respondError(res, 403, 'FORBIDDEN', 'Only administrators or employees can trigger scheduled logistics jobs.');
    }
    const reportingService = require('../services/reporting.service');
    const results = await reportingService.runDailyJobs();
    respond(res, 200, results);
  } catch (err) {
    console.error(`[operations] Error in /trigger-daily-jobs:`, err);
    respondError(res, 500, 'SERVER_ERROR', err.message || 'Internal server error occurred.');
  }
}

module.exports = {
  create,
  list,
  detail,
  processRules,
  statusUpdate,
  getDashboard,
  logDamageReport,
  triggerDailyJobs,
};
