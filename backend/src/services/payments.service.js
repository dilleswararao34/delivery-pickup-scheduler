'use strict';

const db = require('../config/db');
const Razorpay = require('razorpay');
const activityLogService = require('./activityLog.service');
const notificationsService = require('./notifications.service');

// Initialize Razorpay SDK using credentials from env
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret'
});

/**
 * Creates a standard Razorpay Order for a specific amount
 * @param {number} amount - Amount in Rupees
 * @param {string} receiptId - Identifier for the transaction reference
 * @returns {Promise<object>} Razorpay order details
 */
async function createOrder(amount, receiptId) {
  const amountInPaise = Math.round(parseFloat(amount) * 100);
  if (amountInPaise <= 0) {
    throw new Error('Order amount must be greater than zero');
  }

  const options = {
    amount: amountInPaise,
    currency: 'INR',
    receipt: receiptId,
    payment_capture: 1 // Auto-capture payments
  };

  console.log(`[PaymentsService] Creating Razorpay Order for receipt: ${receiptId}, amount: ₹${amount}`);
  return new Promise((resolve, reject) => {
    razorpay.orders.create(options, (err, order) => {
      if (err) {
        console.error('[PaymentsService] Razorpay Order creation failed:', err);
        return reject(err);
      }
      resolve(order);
    });
  });
}

/**
 * Processes a security deposit refund through Razorpay's Refund API
 * @param {string} depositId - UUID of the deposit record
 * @param {string} changedByEmail - User performing/authorizing the action
 * @param {string} reason - Detailed justification for audit trail
 * @param {object} client - Optional DB connection client to execute within transaction
 */
async function refundDeposit(depositId, changedByEmail, reason = 'Equipment returned undamaged', client = db) {
  // 1. Fetch deposit and related customer/booking info
  const depositRes = await client.query(
    `SELECT d.*, c.name AS customer_name, c.email AS customer_email, b.booking_ref, b.id AS booking_id
     FROM deposits d
     JOIN bookings b ON d.booking_id = b.id
     JOIN customers c ON b.customer_id = c.id
     WHERE d.id = $1`,
    [depositId]
  );

  if (!depositRes.rows.length) {
    throw new Error(`Security deposit with ID ${depositId} not found.`);
  }

  const deposit = depositRes.rows[0];

  if (deposit.status === 'REFUNDED') {
    console.log(`[PaymentsService] Deposit ${depositId} is already refunded.`);
    return deposit;
  }

  if (deposit.status !== 'HELD') {
    throw new Error(`Deposit status is '${deposit.status}'. Only deposits with status 'HELD' can be refunded.`);
  }

  if (!deposit.razorpay_payment_id) {
    throw new Error(`Cannot refund deposit ${depositId}: Missing Razorpay Payment ID.`);
  }

  const amountInPaise = Math.round(parseFloat(deposit.amount) * 100);
  console.log(`[PaymentsService] Triggering Razorpay refund for payment ${deposit.razorpay_payment_id}, amount: ₹${deposit.amount}`);

  // 2. Call Razorpay API to process refund
  let refundResult;
  try {
    refundResult = await new Promise((resolve, reject) => {
      razorpay.payments.refund(deposit.razorpay_payment_id, {
        amount: amountInPaise,
        notes: {
          reason: reason,
          booking_ref: deposit.booking_ref,
          deposit_id: depositId
        }
      }, (err, refund) => {
        if (err) {
          console.error('[PaymentsService] Razorpay Refund call failed:', err);
          return reject(err);
        }
        resolve(refund);
      });
    });
  } catch (err) {
    // Save status as FAILED if Razorpay rejects it, but wait:
    // Some rejections might be temporary, but if it fails we log it and throw.
    throw new Error(`Razorpay Refund failed: ${err.message || err.description || 'Unknown error'}`);
  }

  const refundId = refundResult.id;

  // 3. Update database record status to REFUNDED
  await client.query(
    `UPDATE deposits
     SET status = 'REFUNDED', razorpay_refund_id = $1, released_at = NOW(), updated_at = NOW()
     WHERE id = $2`,
    [refundId, depositId]
  );

  // 4. Record Employee/Admin activity log
  // Retrieve user performing the action from email
  const userRes = await client.query(
    "SELECT user_id, name FROM users WHERE email = $1",
    [changedByEmail.toLowerCase().trim()]
  );
  const user = userRes.rows[0] || { user_id: null, name: 'System / Automator' };

  await activityLogService.logAction({
    userId: user.user_id || '00000000-0000-0000-0000-000000000000',
    userName: user.name,
    userEmail: changedByEmail,
    action: 'REFUND_DEPOSIT',
    entityType: 'DEPOSIT',
    entityId: depositId,
    details: `Refunded deposit amount ₹${deposit.amount} for Booking ${deposit.booking_ref}. Refund ID: ${refundId}. Reason: ${reason}`
  }, client);

  // 5. Send Refund confirmation email to Customer
  const mockBookingForEmail = {
    booking_ref: deposit.booking_ref,
    customer_name: deposit.customer_name,
    customer_email: deposit.customer_email
  };
  await notificationsService.sendDepositRefundConfirmation(mockBookingForEmail, {
    amount: deposit.amount,
    razorpay_refund_id: refundId
  });

  return {
    ...deposit,
    status: 'REFUNDED',
    razorpay_refund_id: refundId
  };
}

module.exports = {
  createOrder,
  refundDeposit,
  razorpay
};
