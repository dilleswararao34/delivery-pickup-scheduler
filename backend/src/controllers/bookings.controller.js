'use strict';

const bookingsService    = require('../services/bookings.service');
const stateMachine       = require('../services/stateMachine.service');
const alertsService      = require('../services/alerts.service');
const notificationsService = require('../services/notifications.service');

function respond(res, statusCode, data, meta = {}) {
  res.status(statusCode).json({
    success: true,
    data,
    meta: { requestId: res.req.requestId || null, timestamp: new Date().toISOString(), pagination: meta.pagination || null },
    error: null,
  });
}

// POST /api/v1/bookings
async function createBooking(req, res, next) {
  try {
    const { customer, creator, equipment_ids, location, scheduled_delivery_date, scheduled_return_date, notes } = req.body;

    // Date range guard
    if (new Date(scheduled_return_date) <= new Date(scheduled_delivery_date)) {
      const err = new Error('scheduled_return_date must be after scheduled_delivery_date.');
      err.statusCode = 422;
      err.code = 'INVALID_DATE_RANGE';
      return next(err);
    }

    // Equipment conflict check
    const conflicts = await alertsService.checkEquipmentConflict(equipment_ids, scheduled_delivery_date, scheduled_return_date);
    if (conflicts.length) {
      const err = new Error(
        `Equipment conflict detected: ${conflicts.map((c) => `${c.equipment_name} (booked in ${c.booking_ref})`).join(', ')}`
      );
      err.statusCode = 409;
      err.code = 'EQUIPMENT_CONFLICT';
      return next(err);
    }

    const booking = await bookingsService.createBooking(req.body);
    respond(res, 201, booking);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/bookings
async function listBookings(req, res, next) {
  try {
    const query = {
      ...req.query,
      customer_email: req.user?.role === 'CUSTOMER' ? req.user.email : req.query.customer_email
    };
    const result = await bookingsService.listBookings(query);
    respond(res, 200, result.data, { pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/bookings/:id
async function getBooking(req, res, next) {
  try {
    const { id } = req.params;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(id)) {
      const err = new Error('Booking ID must be a valid UUID.');
      err.statusCode = 400;
      err.code = 'INVALID_ID_FORMAT';
      return next(err);
    }
    const booking = await bookingsService.getBookingById(id);
    respond(res, 200, booking);
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/bookings/:id/status
async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { new_status, changed_by, reason, operations_update } = req.body;

    const result = await stateMachine.transition(id, new_status, changed_by, reason, operations_update);
    respond(res, 200, result);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/bookings/alerts
async function getAlerts(req, res, next) {
  try {
    const alerts = await alertsService.getActiveAlerts(50);
    respond(res, 200, alerts);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/v1/bookings/alerts/:id
async function resolveAlert(req, res, next) {
  try {
    const { id } = req.params;
    const resolvedBy = req.user?.name || 'System Operator';
    const alert = await alertsService.resolveAlert(id, resolvedBy);
    if (!alert) {
      const err = new Error(`Alert with ID ${id} not found.`);
      err.statusCode = 404;
      err.code = 'ALERT_NOT_FOUND';
      return next(err);
    }
    respond(res, 200, alert);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/bookings/export/csv
async function exportCSV(req, res, next) {
  try {
    const query = {
      ...req.query,
      customer_email: req.user?.role === 'CUSTOMER' ? req.user.email : req.query.customer_email,
      page: 1,
      limit: 100000
    };
    const result = await bookingsService.listBookings(query);
    const csvContent = await notificationsService.generateCSV(result.data);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="bookings_export.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/bookings/invoices/:id/pdf
async function downloadInvoicePDF(req, res, next) {
  try {
    const { id } = req.params;
    const booking = await bookingsService.getBookingById(id);

    if (req.user?.role === 'CUSTOMER' && booking.customer.email.toLowerCase() !== req.user.email.toLowerCase()) {
      const err = new Error('You are not authorized to access this invoice.');
      err.statusCode = 403;
      return next(err);
    }

    const invoice = booking.invoices[0];
    if (!invoice) {
      const err = new Error('No invoice found for this booking.');
      err.statusCode = 404;
      return next(err);
    }

    const pdfBuffer = await notificationsService.generatePDF(booking, invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_ref}.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { createBooking, listBookings, getBooking, updateStatus, getAlerts, resolveAlert, exportCSV, downloadInvoicePDF };
