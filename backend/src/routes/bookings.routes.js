'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/bookings.controller');
const { validate } = require('../middleware/validate');
const requireRole = require('../middleware/requireRole');
const { createBookingSchema, updateStatusSchema, listBookingsQuerySchema } = require('../schemas/bookings.schema');

// GET  /api/v1/bookings/alerts
router.get('/alerts', ctrl.getAlerts);

// DELETE /api/v1/bookings/alerts/:id
router.delete('/alerts/:id', ctrl.resolveAlert);

// GET /api/v1/bookings/export/csv
router.get('/export/csv', requireRole('ADMIN', 'EMPLOYEE'), ctrl.exportCSV);

// GET  /api/v1/bookings
router.get('/', validate(listBookingsQuerySchema, 'query'), ctrl.listBookings);

async function populateCustomerDetails(req, res, next) {
  if (req.body && req.body.customer && req.body.customer.email) {
    try {
      const db = require('../config/db');
      const email = req.body.customer.email.toLowerCase().trim();
      const custRes = await db.query(
        "SELECT phone, company FROM customers WHERE email = $1",
        [email]
      );
      if (custRes.rows.length) {
        const dbCust = custRes.rows[0];
        if ((!req.body.customer.phone || req.body.customer.phone.trim() === '') && dbCust.phone) {
          req.body.customer.phone = dbCust.phone;
        }
        if ((!req.body.customer.company || req.body.customer.company.trim() === '') && dbCust.company) {
          req.body.customer.company = dbCust.company;
        }
      } else {
        if (!req.body.customer.phone || req.body.customer.phone.trim() === '') {
          req.body.customer.phone = '+91 99999 99999';
        }
      }
    } catch (err) {
      console.error('[populateCustomerDetails] Failed:', err.message);
    }
  }
  next();
}

// POST /api/v1/bookings
router.post('/', populateCustomerDetails, validate(createBookingSchema, 'body'), ctrl.createBooking);

// GET /api/v1/bookings/invoices/:id/pdf
router.get('/invoices/:id/pdf', ctrl.downloadInvoicePDF);

// GET  /api/v1/bookings/:id
router.get('/:id', ctrl.getBooking);

// PUT  /api/v1/bookings/:id/status
router.put('/:id/status', validate(updateStatusSchema, 'body'), ctrl.updateStatus);

module.exports = router;
