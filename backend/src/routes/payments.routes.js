'use strict';

const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/payments.controller');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/requireRole');

// Public webhook endpoint (no authentication, verified server-to-server via signature)
router.post('/webhook', paymentsController.webhook);

// Protected endpoint to generate Razorpay orders
router.post('/create-order', authMiddleware, paymentsController.createOrder);

// Customer option to choose COD payment method
router.post('/select-cod', authMiddleware, paymentsController.selectCODPayment);

// Admin / Employee only endpoint to manual trigger security deposit refunds
router.post('/deposits/:id/refund', authMiddleware, requireRole('ADMIN', 'EMPLOYEE'), paymentsController.refundDeposit);

// Admin / Employee only endpoint to mark COD invoice as PAID
router.post('/invoices/:id/mark-paid', authMiddleware, requireRole('ADMIN', 'EMPLOYEE'), paymentsController.markCODInvoicePaid);

module.exports = router;
