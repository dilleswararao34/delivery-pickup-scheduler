'use strict';

const quotationsService = require('../services/quotations.service');

function respond(res, statusCode, data, meta = {}) {
  res.status(statusCode).json({
    success: true,
    data,
    meta: { requestId: res.req.requestId || null, timestamp: new Date().toISOString(), pagination: meta.pagination || null },
    error: null,
  });
}

// GET /api/v1/quotations
async function listQuotations(req, res, next) {
  try {
    const filters = {};
    
    // If CUSTOMER, only show their quotations
    if (req.user.role === 'CUSTOMER') {
      filters.customer_email = req.user.email;
    } else {
      // Admin can filter
      if (req.query.status) filters.status = req.query.status;
      if (req.query.customer_id) filters.customer_id = req.query.customer_id;
    }

    const quotations = await quotationsService.listQuotations(filters);
    respond(res, 200, quotations);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/quotations/:id
async function getQuotation(req, res, next) {
  try {
    const { id } = req.params;
    const quotation = await quotationsService.getQuotationById(id);
    
    if (req.user.role === 'CUSTOMER' && quotation.customer_email.toLowerCase().trim() !== req.user.email.toLowerCase().trim()) {
      const err = new Error('Unauthorized');
      err.statusCode = 403;
      return next(err);
    }

    respond(res, 200, quotation);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/quotations/:id/revise
async function requestRevision(req, res, next) {
  try {
    const { id } = req.params;
    const { reason_for_revision } = req.body;

    const result = await quotationsService.requestRevision(id, req.user.email, reason_for_revision);
    respond(res, 200, result);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/quotations/:id/admin/send-revised-quote
async function sendRevisedQuote(req, res, next) {
  try {
    const { id } = req.params;
    const { discount_amount, reason, admin_notes, new_amount, breakdown } = req.body;

    const result = await quotationsService.sendRevisedQuote(
      id, 
      req.user.email, 
      new_amount, 
      reason, 
      admin_notes, 
      breakdown
    );
    respond(res, 200, result);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/quotations/:id/accept
async function acceptQuote(req, res, next) {
  try {
    const { id } = req.params;
    const { version_id } = req.body;

    const result = await quotationsService.acceptQuote(id, version_id, req.user.email);
    respond(res, 200, result);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/quotations/:id/reject
async function rejectQuote(req, res, next) {
  try {
    const { id } = req.params;

    const result = await quotationsService.rejectQuote(id, req.user.email);
    respond(res, 200, result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listQuotations,
  getQuotation,
  requestRevision,
  sendRevisedQuote,
  acceptQuote,
  rejectQuote
};
