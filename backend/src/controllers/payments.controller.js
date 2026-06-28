'use strict';

const db = require('../config/db');
const paymentsService = require('../services/payments.service');
const ruleEngine = require('../services/ruleEngine.service');
const stateMachine = require('../services/stateMachine.service');
const notificationsService = require('../services/notifications.service');
const crypto = require('crypto');

/**
 * Endpoint: POST /api/v1/payments/create-order
 * Creates a Razorpay Order for either an invoice or deposit
 */
async function createOrder(req, res, next) {
  const { type, id } = req.body;

  if (!type || !['invoice', 'deposit'].includes(type)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: "Type must be either 'invoice' or 'deposit'." }
    });
  }

  if (!id) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'ID is required.' }
    });
  }

  try {
    let amount = 0;
    let receiptRef = '';
    let bookingId = '';

    if (type === 'invoice') {
      const invRes = await db.query(
        `SELECT i.*, c.email AS customer_email, b.booking_ref, b.id AS booking_id
         FROM invoices i
         JOIN bookings b ON i.booking_id = b.id
         JOIN customers c ON b.customer_id = c.id
         WHERE i.id = $1`,
        [id]
      );

      if (!invRes.rows.length) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Invoice not found.' }
        });
      }

      const invoice = invRes.rows[0];
      bookingId = invoice.booking_id;

      // Access control for customer role
      if (req.user.role === 'CUSTOMER' && req.user.email.toLowerCase().trim() !== invoice.customer_email.toLowerCase().trim()) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have permission to pay this invoice.' }
        });
      }

      if (invoice.status === 'PAID') {
        return res.status(400).json({
          success: false,
          error: { code: 'ALREADY_PAID', message: 'This invoice has already been paid.' }
        });
      }

      amount = parseFloat(invoice.amount_due);
      receiptRef = invoice.invoice_ref;
    } else {
      const depRes = await db.query(
        `SELECT d.*, c.email AS customer_email, b.booking_ref, b.id AS booking_id
         FROM deposits d
         JOIN bookings b ON d.booking_id = b.id
         JOIN customers c ON b.customer_id = c.id
         WHERE d.id = $1`,
        [id]
      );

      if (!depRes.rows.length) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Deposit record not found.' }
        });
      }

      const deposit = depRes.rows[0];
      bookingId = deposit.booking_id;

      // Access control for customer role
      if (req.user.role === 'CUSTOMER' && req.user.email.toLowerCase().trim() !== deposit.customer_email.toLowerCase().trim()) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have permission to pay this deposit.' }
        });
      }

      if (deposit.status !== 'PENDING') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: `Deposit cannot be paid in status: ${deposit.status}` }
        });
      }

      amount = parseFloat(deposit.amount);
      receiptRef = `DEP-${deposit.booking_ref.slice(3)}`;
    }

    // Call Razorpay Order generation
    const order = await paymentsService.createOrder(amount, receiptRef);

    // Save order ID to local record
    if (type === 'invoice') {
      await db.query(
        'UPDATE invoices SET razorpay_order_id = $1, updated_at = NOW() WHERE id = $2',
        [order.id, id]
      );
    } else {
      await db.query(
        'UPDATE deposits SET razorpay_order_id = $1, updated_at = NOW() WHERE id = $2',
        [order.id, id]
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder'
      }
    });

  } catch (err) {
    next(err);
  }
}

/**
 * Endpoint: POST /api/v1/payments/webhook
 * Handles Razorpay's signature-verified payment confirmation
 */
async function webhook(req, res, next) {
  const signature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'placeholder_webhook_secret';

  if (!signature) {
    console.warn('[PaymentsWebhook] Missing x-razorpay-signature header.');
    return res.status(400).json({ success: false, error: 'Missing signature' });
  }

  // Validate the signature using HMAC SHA256 against raw request body
  const bodyToSign = req.rawBody || JSON.stringify(req.body);
  const shasum = crypto.createHmac('sha256', webhookSecret);
  shasum.update(bodyToSign);
  const digest = shasum.digest('hex');

  if (digest !== signature) {
    console.error(`[PaymentsWebhook] Signature mismatch. Expected: ${digest}, Received: ${signature}`);
    console.error(`[PaymentsWebhook] Ensure RAZORPAY_WEBHOOK_SECRET in your .env matches the Razorpay Dashboard exactly.`);
    return res.status(401).json({ success: false, error: 'Invalid signature validation' });
  }

  const event = req.body;
  console.log(`[PaymentsWebhook] Received valid signature event: ${event.event}`);

  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    const payment = event.payload.payment.entity;
    const orderId = payment.order_id;
    const paymentId = payment.id;
    const razorpaySignature = signature; // Use the verified header signature

    try {
      // 1. Check if order corresponds to an invoice
      const invRes = await db.query(
        `SELECT i.*, c.name AS customer_name, c.email AS customer_email, b.booking_ref, b.status AS booking_status
         FROM invoices i
         JOIN bookings b ON i.booking_id = b.id
         JOIN customers c ON b.customer_id = c.id
         WHERE i.razorpay_order_id = $1`,
        [orderId]
      );

      if (invRes.rows.length) {
        const invoice = invRes.rows[0];
        if (invoice.status !== 'PAID') {
          console.log(`[PaymentsWebhook] Found invoice ${invoice.id} for order ${orderId}. Marking as PAID.`);
          
          await db.query(
            `UPDATE invoices
             SET status = 'PAID', amount_paid = amount_due, razorpay_payment_id = $1, razorpay_signature = $2, updated_at = NOW()
             WHERE id = $3`,
            [paymentId, razorpaySignature, invoice.id]
          );

          // Trigger email notification
          const mockBooking = {
            booking_ref: invoice.booking_ref,
            customer_name: invoice.customer_name,
            customer_email: invoice.customer_email
          };
          await notificationsService.sendPaymentConfirmation(mockBooking, {
            invoice_ref: invoice.invoice_ref,
            amount_paid: invoice.amount_due
          });

          // Re-evaluate rules
          await ruleEngine.processBookingRules(invoice.booking_id);

          // Auto-confirm if both criteria met
          await checkAndAutoConfirmBooking(invoice.booking_id);
        }
        return res.status(200).json({ success: true, message: 'Invoice payment updated' });
      }

      // 2. Check if order corresponds to a deposit
      const depRes = await db.query(
        `SELECT d.*, b.id AS booking_id, b.booking_ref
         FROM deposits d
         JOIN bookings b ON d.booking_id = b.id
         WHERE d.razorpay_order_id = $1`,
        [orderId]
      );

      if (depRes.rows.length) {
        const deposit = depRes.rows[0];
        if (deposit.status !== 'HELD') {
          console.log(`[PaymentsWebhook] Found deposit ${deposit.id} for order ${orderId}. Marking as HELD.`);

          await db.query(
            `UPDATE deposits
             SET status = 'HELD', razorpay_payment_id = $1, payment_method = 'RAZORPAY', held_at = NOW(), updated_at = NOW()
             WHERE id = $2`,
            [paymentId, deposit.id]
          );

          // Re-evaluate rules
          await ruleEngine.processBookingRules(deposit.booking_id);

          // Auto-confirm if both criteria met
          await checkAndAutoConfirmBooking(deposit.booking_id);
        }
        return res.status(200).json({ success: true, message: 'Deposit hold updated' });
      }

      console.warn(`[PaymentsWebhook] Order ID ${orderId} not found in invoices or deposits.`);
      return res.status(404).json({ success: false, error: 'Matching order not found' });

    } catch (err) {
      console.error('[PaymentsWebhook] Processing error:', err.message);
      return res.status(500).json({ success: false, error: 'Database processing error' });
    }
  }

  return res.status(200).json({ success: true, message: 'Event ignored' });
}

/**
 * Helper: Automatically transitions booking to CONFIRMED if invoice is paid and deposit holds are satisfied
 */
async function checkAndAutoConfirmBooking(bookingId) {
  try {
    const invRes = await db.query("SELECT status, payment_method FROM invoices WHERE booking_id = $1", [bookingId]);
    const depRes = await db.query("SELECT status FROM deposits WHERE booking_id = $1", [bookingId]);
    const bookingRes = await db.query("SELECT status, booking_ref FROM bookings WHERE id = $1", [bookingId]);

    if (!bookingRes.rows.length) return;
    const booking = bookingRes.rows[0];

    // Only transition if currently in DRAFT or QUOTATION_REQUESTED
    if (!['DRAFT', 'QUOTATION_REQUESTED'].includes(booking.status)) return;

    const invoicePaid = invRes.rows.length > 0 && (invRes.rows[0].status === 'PAID' || invRes.rows[0].payment_method === 'COD');
    const depositHeld = depRes.rows.length === 0 || depRes.rows.every(d => d.status === 'HELD');

    if (invoicePaid && depositHeld) {
      console.log(`[PaymentsWebhook] Auto-confirming booking ${booking.booking_ref} since all payments are verified.`);
      await stateMachine.transition(
        bookingId,
        'CONFIRMED',
        'System / Webhook',
        'Automated transition triggered by Razorpay payment webhook capture'
      );
    }
  } catch (err) {
    console.error(`[PaymentsWebhook] checkAndAutoConfirmBooking failed for booking ${bookingId}:`, err.message);
  }
}

/**
 * Endpoint: POST /api/v1/payments/deposits/:id/refund
 * Staff manual triggers a refund for a security deposit
 */
async function refundDeposit(req, res, next) {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const refundInfo = await paymentsService.refundDeposit(
      id,
      req.user.email,
      reason || 'Manual refund from administrator panel'
    );

    return res.status(200).json({
      success: true,
      data: refundInfo
    });

  } catch (err) {
    next(err);
  }
}

async function selectCODPayment(req, res, next) {
  const { invoiceId } = req.body;
  if (!invoiceId) {
    return res.status(400).json({ success: false, error: 'Invoice ID is required.' });
  }

  try {
    const invRes = await db.query(
      `SELECT i.*, c.email AS customer_email, b.booking_ref, b.id AS booking_id
       FROM invoices i
       JOIN bookings b ON i.booking_id = b.id
       JOIN customers c ON b.customer_id = c.id
       WHERE i.id = $1`,
      [invoiceId]
    );

    if (!invRes.rows.length) {
      return res.status(404).json({ success: false, error: 'Invoice not found.' });
    }

    const invoice = invRes.rows[0];

    // Check ownership for customer
    if (req.user.role === 'CUSTOMER' && req.user.email.toLowerCase().trim() !== invoice.customer_email.toLowerCase().trim()) {
      return res.status(403).json({ success: false, error: 'You are not authorized to modify this invoice.' });
    }

    await db.query(
      "UPDATE invoices SET payment_method = 'COD', updated_at = NOW() WHERE id = $1",
      [invoiceId]
    );

    // Re-evaluate rules
    await ruleEngine.processBookingRules(invoice.booking_id);

    // Check and auto-confirm
    await checkAndAutoConfirmBooking(invoice.booking_id);

    res.json({
      success: true,
      message: 'Payment method set to Cash on Delivery (COD) successfully.'
    });
  } catch (err) {
    next(err);
  }
}

async function markInvoicePaid(req, res, next) {
  const { id } = req.params;
  try {
    const invRes = await db.query(
      `SELECT i.*, c.name AS customer_name, c.email AS customer_email, b.booking_ref, b.id AS booking_id
       FROM invoices i
       JOIN bookings b ON i.booking_id = b.id
       JOIN customers c ON b.customer_id = c.id
       WHERE i.id = $1`,
      [id]
    );

    if (!invRes.rows.length) {
      return res.status(404).json({ success: false, error: 'Invoice not found.' });
    }

    const invoice = invRes.rows[0];

    if (invoice.status === 'PAID') {
      return res.status(400).json({ success: false, error: 'Invoice is already paid.' });
    }

    await db.query(
      `UPDATE invoices
       SET status = 'PAID', amount_paid = amount_due, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    // Log audit activity
    const activityLogService = require('../services/activityLog.service');
    await activityLogService.logAction({
      userId: req.user.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'MARK_COD_INVOICE_PAID',
      entityType: 'INVOICE',
      entityId: id,
      details: `Marked Invoice ${invoice.invoice_ref} as PAID manually`
    });

    // Re-evaluate rules
    await ruleEngine.processBookingRules(invoice.booking_id);

    // Trigger payment email notification
    const mockBooking = {
      booking_ref: invoice.booking_ref,
      customer_name: invoice.customer_name,
      customer_email: invoice.customer_email
    };
    await notificationsService.sendPaymentConfirmation(mockBooking, {
      invoice_ref: invoice.invoice_ref,
      amount_paid: invoice.amount_due
    });

    res.json({
      success: true,
      message: 'Invoice marked as paid successfully.'
    });
  } catch (err) {
    next(err);
  }
}

async function markDepositHeld(req, res, next) {
  const { id } = req.params;
  try {
    const depRes = await db.query(
      `SELECT d.*, c.name AS customer_name, c.email AS customer_email, b.booking_ref, b.id AS booking_id
       FROM deposits d
       JOIN bookings b ON d.booking_id = b.id
       JOIN customers c ON b.customer_id = c.id
       WHERE d.id = $1`,
      [id]
    );

    if (!depRes.rows.length) {
      return res.status(404).json({ success: false, error: 'Deposit not found.' });
    }

    const deposit = depRes.rows[0];

    if (deposit.status === 'HELD') {
      return res.status(400).json({ success: false, error: 'Deposit is already held.' });
    }

    await db.query(
      `UPDATE deposits
       SET status = 'HELD', payment_method = 'MANUAL', held_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    // Log audit activity
    const activityLogService = require('../services/activityLog.service');
    await activityLogService.logAction({
      userId: req.user.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'MARK_DEPOSIT_HELD',
      entityType: 'DEPOSIT',
      entityId: id,
      details: `Marked Deposit for booking ${deposit.booking_ref} as HELD manually`
    });

    // Re-evaluate rules
    await ruleEngine.processBookingRules(deposit.booking_id);

    // Check and auto-confirm
    await checkAndAutoConfirmBooking(deposit.booking_id);

    res.json({
      success: true,
      message: 'Deposit marked as HELD successfully.'
    });
  } catch (err) {
    next(err);
  }
}

async function verifyPayment(req, res, next) {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, type, item_id } = req.body;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || 'placeholder_key_secret';

  console.log(`[PaymentsVerify] Verifying signature for ${type} id ${item_id}. Order: ${razorpay_order_id}, Payment: ${razorpay_payment_id}`);

  // Verify the signature
  const bodyToSign = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(bodyToSign)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    console.error(`[PaymentsVerify] Signature mismatch!`);
    console.error(`  Expected: ${expectedSignature}`);
    console.error(`  Received: ${razorpay_signature}`);
    console.error(`  Signed Body: ${bodyToSign}`);
    console.error(`  Key Secret Length: ${keySecret.length}`);
    const err = new Error('Invalid signature verification');
    err.statusCode = 400;
    err.code = 'INVALID_PAYMENT_SIGNATURE';
    return next(err);
  }

  try {
    if (type === 'invoice') {
      const invRes = await db.query(
        `SELECT i.*, c.name AS customer_name, c.email AS customer_email, b.booking_ref, b.id AS booking_id, b.status AS booking_status
         FROM invoices i
         JOIN bookings b ON i.booking_id = b.id
         JOIN customers c ON b.customer_id = c.id
         WHERE i.id = $1 AND i.razorpay_order_id = $2`,
        [item_id, razorpay_order_id]
      );

      if (!invRes.rows.length) {
        const err = new Error('Invoice not found');
        err.statusCode = 404;
        return next(err);
      }

      const invoice = invRes.rows[0];
      if (invoice.status !== 'PAID') {
        await db.query(
          `UPDATE invoices
           SET status = 'PAID', amount_paid = amount_due, razorpay_payment_id = $1, razorpay_signature = $2, updated_at = NOW()
           WHERE id = $3`,
          [razorpay_payment_id, razorpay_signature, invoice.id]
        );

        // Trigger email notification
        const mockBooking = {
          booking_ref: invoice.booking_ref,
          customer_name: invoice.customer_name,
          customer_email: invoice.customer_email
        };
        await notificationsService.sendPaymentConfirmation(mockBooking, {
          invoice_ref: invoice.invoice_ref,
          amount_paid: invoice.amount_due
        });

        // Log action
        const activityLogService = require('../services/activityLog.service');
        await activityLogService.logAction({
          userId: req.user.userId,
          userName: req.user.name,
          userEmail: req.user.email,
          action: 'VERIFY_PAYMENT',
          entityType: 'INVOICE',
          entityId: invoice.id,
          details: `Verified payment ${razorpay_payment_id} for Invoice ${invoice.invoice_ref}`
        });

        // Re-evaluate rules
        await ruleEngine.processBookingRules(invoice.booking_id);

        // Auto-confirm
        await checkAndAutoConfirmBooking(invoice.booking_id);
      }
      
      return res.status(200).json({ success: true, message: 'Invoice payment verified and updated successfully' });
    } else if (type === 'deposit') {
      const depRes = await db.query(
        `SELECT d.*, b.id AS booking_id, b.booking_ref
         FROM deposits d
         JOIN bookings b ON d.booking_id = b.id
         WHERE d.id = $1 AND d.razorpay_order_id = $2`,
        [item_id, razorpay_order_id]
      );

      if (!depRes.rows.length) {
        const err = new Error('Deposit not found');
        err.statusCode = 404;
        return next(err);
      }

      const deposit = depRes.rows[0];
      if (deposit.status !== 'HELD') {
        await db.query(
          `UPDATE deposits
           SET status = 'HELD', razorpay_payment_id = $1, payment_method = 'RAZORPAY', held_at = NOW(), updated_at = NOW()
           WHERE id = $2`,
          [razorpay_payment_id, deposit.id]
        );

        // Log action
        const activityLogService = require('../services/activityLog.service');
        await activityLogService.logAction({
          userId: req.user.userId,
          userName: req.user.name,
          userEmail: req.user.email,
          action: 'VERIFY_PAYMENT',
          entityType: 'DEPOSIT',
          entityId: deposit.id,
          details: `Verified payment ${razorpay_payment_id} for Deposit on booking ${deposit.booking_ref}`
        });

        // Re-evaluate rules
        await ruleEngine.processBookingRules(deposit.booking_id);

        // Auto-confirm
        await checkAndAutoConfirmBooking(deposit.booking_id);
      }

      return res.status(200).json({ success: true, message: 'Deposit payment verified and updated successfully' });
    }

    return res.status(400).json({ success: false, error: 'Invalid payment type' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrder,
  webhook,
  verifyPayment,
  refundDeposit,
  selectCODPayment,
  markInvoicePaid,
  markDepositHeld
};
