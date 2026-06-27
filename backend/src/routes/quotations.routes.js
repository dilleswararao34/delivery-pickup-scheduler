'use strict';

const express = require('express');
const router = express.Router();
const quotationsController = require('../controllers/quotations.controller');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/requireRole');

router.use(authMiddleware);

// Common routes
router.get('/', quotationsController.listQuotations);
router.get('/:id', quotationsController.getQuotation);

// Customer specific actions
router.post('/:id/revise', quotationsController.requestRevision);
router.post('/:id/accept', quotationsController.acceptQuote);
router.post('/:id/reject', quotationsController.rejectQuote);

// Admin specific actions
router.post('/:id/admin/send-revised-quote', requireRole('ADMIN', 'EMPLOYEE'), quotationsController.sendRevisedQuote);

module.exports = router;
