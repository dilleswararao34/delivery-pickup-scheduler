'use strict';

const db = require('../config/db');

// ─── State machine transition map ─────────────────────────────────────────────

const ALLOWED_TRANSITIONS = {
  DRAFT:                  ['QUOTATION_REQUESTED', 'CANCELLED', 'CANCELLATION_REQUESTED'],
  QUOTATION_REQUESTED:    ['CONFIRMED', 'DRAFT', 'CANCELLED', 'CANCELLATION_REQUESTED'],
  CONFIRMED:              ['OUT_FOR_DELIVERY', 'CANCELLED', 'CANCELLATION_REQUESTED'],
  OUT_FOR_DELIVERY:       ['DELIVERED'],
  DELIVERED:              ['AWAITING_PICKUP'],
  AWAITING_PICKUP:        ['PICKED_UP_AND_RETURNED'],
  PICKED_UP_AND_RETURNED: ['ARCHIVED'],
  CANCELLATION_REQUESTED: ['CANCELLED', 'CONFIRMED', 'DRAFT'],
  ARCHIVED:               ['DRAFT'],
  CANCELLED:              ['DRAFT'],
};

// ─── Transition guards ────────────────────────────────────────────────────────

function applyGuard(toStatus, opsLog, booking) {
  if (toStatus === 'OUT_FOR_DELIVERY') {
    if (!opsLog || !opsLog.driver_assigned) {
      const err = new Error('A driver must be assigned before dispatching equipment for delivery.');
      err.statusCode = 422;
      err.code = 'MISSING_REQUIRED_FOR_TRANSITION';
      throw err;
    }
    if (!opsLog.scheduled_pickup_time) {
      const err = new Error('A scheduled pickup time must be set before dispatching for delivery.');
      err.statusCode = 422;
      err.code = 'MISSING_REQUIRED_FOR_TRANSITION';
      throw err;
    }
  }

  // 24-Hour Cancellation Cutoff Logic
  if (toStatus === 'CANCELLED' && ['CONFIRMED', 'QUOTATION_REQUESTED'].includes(booking.status)) {
    const now = new Date();
    const deliveryDate = new Date(booking.scheduled_delivery_date);
    const hoursUntilDelivery = (deliveryDate - now) / (1000 * 60 * 60);

    if (hoursUntilDelivery <= 24 && hoursUntilDelivery > 0) {
      return 'CANCELLATION_REQUESTED';
    }
  }

  return toStatus;
}

// ─── Core transition executor ─────────────────────────────────────────────────

async function transition(bookingId, toStatus, changedBy, reason, operationsUpdate) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // 1. Lock the booking row
    const bookingRes = await client.query(
      'SELECT id, booking_ref, status, scheduled_delivery_date FROM bookings WHERE id = $1 AND is_deleted = FALSE FOR UPDATE',
      [bookingId]
    );

    if (!bookingRes.rows.length) {
      const err = new Error(`Booking with ID ${bookingId} not found.`);
      err.statusCode = 404;
      err.code = 'BOOKING_NOT_FOUND';
      throw err;
    }

    const booking = bookingRes.rows[0];
    const fromStatus = booking.status;

    // 2. Validate transition
    const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
    if (!allowed.includes(toStatus)) {
      const err = new Error(
        `Cannot transition booking ${booking.booking_ref} from '${fromStatus}' to '${toStatus}'. This transition is not permitted by the workflow state machine.`
      );
      err.statusCode = 400;
      err.code = 'INVALID_TRANSITION';
      throw err;
    }

    // 3. Fetch operations log for guard checks
    const opsRes = await client.query(
      'SELECT * FROM operations_logs WHERE booking_id = $1',
      [bookingId]
    );
    const opsLog = opsRes.rows[0] || {};

    // Apply guard — merge incoming update for the check
    const mergedOps = { ...opsLog, ...(operationsUpdate || {}) };
    toStatus = applyGuard(toStatus, mergedOps, booking);

    // Guard: block CONFIRMED if invoice is UNPAID or deposit is PENDING/FAILED
    if (toStatus === 'CONFIRMED') {
      const invRes = await client.query(
        "SELECT status, payment_method FROM invoices WHERE booking_id = $1",
        [bookingId]
      );
      const depRes = await client.query(
        "SELECT status FROM deposits WHERE booking_id = $1",
        [bookingId]
      );

      const invoicePaid = invRes.rows.length > 0 && (invRes.rows[0].status === 'PAID' || invRes.rows[0].payment_method === 'COD');
      const depositHeld = depRes.rows.length === 0 || depRes.rows.every(d => d.status === 'HELD');

      if (!invoicePaid) {
        const err = new Error('Cannot confirm booking: The invoice has not been paid.');
        err.statusCode = 422;
        err.code = 'UNPAID_INVOICE';
        throw err;
      }
      if (!depositHeld) {
        const err = new Error('Cannot confirm booking: The security deposit has not been authorized/held.');
        err.statusCode = 422;
        err.code = 'PENDING_DEPOSIT';
        throw err;
      }

      // Concurrency check: verify no overlapping bookings exist for the same equipment
      const bookingDetails = await client.query(
        "SELECT scheduled_delivery_date, scheduled_return_date FROM bookings WHERE id = $1",
        [bookingId]
      );
      const equipRes = await client.query(
        "SELECT equipment_id FROM booking_equipment WHERE booking_id = $1",
        [bookingId]
      );
      const equipmentIds = equipRes.rows.map(r => r.equipment_id);

      if (bookingDetails.rows.length > 0 && equipmentIds.length > 0) {
        const { scheduled_delivery_date, scheduled_return_date } = bookingDetails.rows[0];
        const alertsService = require('./alerts.service');
        await alertsService.checkConflictsAndLock(client, equipmentIds, scheduled_delivery_date, scheduled_return_date, bookingId);
      }
    }

    // 4. Update booking status
    await client.query(
      'UPDATE bookings SET status = $1 WHERE id = $2',
      [toStatus, bookingId]
    );

    // 5. Upsert operations log
    if (operationsUpdate && Object.keys(operationsUpdate).length) {
      const fields = ['driver_assigned', 'driver_phone', 'vehicle_id', 'scheduled_pickup_time', 'scheduled_return_time', 'dispatch_notes', 'operational_status'];
      const setClauses = [];
      const values = [bookingId];
      let idx = 2;

      for (const field of fields) {
        if (operationsUpdate[field] !== undefined) {
          setClauses.push(`${field} = $${idx++}`);
          values.push(operationsUpdate[field]);
        }
      }

      if (setClauses.length) {
        await client.query(
          `UPDATE operations_logs SET ${setClauses.join(', ')} WHERE booking_id = $1`,
          values
        );
      }
    }

    // 6. Auto-stamp timestamps for specific transitions
    if (toStatus === 'DELIVERED') {
      await client.query(
        'UPDATE operations_logs SET actual_delivery_time = NOW(), operational_status = $1 WHERE booking_id = $2',
        ['EQUIPMENT_DELIVERED', bookingId]
      );
    }
    if (toStatus === 'PICKED_UP_AND_RETURNED') {
      await client.query(
        'UPDATE operations_logs SET actual_return_time = NOW(), operational_status = $1 WHERE booking_id = $2',
        ['RETURNED_TO_DEPOT', bookingId]
      );
      // Release equipment back to AVAILABLE
      await client.query(
        `UPDATE equipment SET status = 'AVAILABLE'
         WHERE id IN (SELECT equipment_id FROM booking_equipment WHERE booking_id = $1)`,
        [bookingId]
      );

      // Automatically trigger Razorpay deposit refund if one exists and is HELD
      const depRes = await client.query(
        "SELECT id, amount, razorpay_payment_id FROM deposits WHERE booking_id = $1 AND status = 'HELD'",
        [bookingId]
      );
      for (const dep of depRes.rows) {
        if (dep.razorpay_payment_id) {
          try {
            console.log(`[stateMachine] Automatically triggering refund for deposit ${dep.id}...`);
            const paymentsService = require('./payments.service');
            await paymentsService.refundDeposit(dep.id, changedBy, 'Automated refund on equipment returned undamaged', client);
          } catch (refundErr) {
            console.error(`[stateMachine] Automated refund for deposit ${dep.id} failed:`, refundErr.message);
          }
        }
      }
    }
    if (toStatus === 'ARCHIVED' || toStatus === 'CANCELLED') {
      // Release equipment back to AVAILABLE
      await client.query(
        `UPDATE equipment SET status = 'AVAILABLE'
         WHERE id IN (SELECT equipment_id FROM booking_equipment WHERE booking_id = $1)`,
        [bookingId]
      );

      // Automatically trigger Razorpay deposit refund if one exists and is HELD
      const depRes = await client.query(
        "SELECT id, amount, razorpay_payment_id FROM deposits WHERE booking_id = $1 AND status = 'HELD'",
        [bookingId]
      );
      for (const dep of depRes.rows) {
        if (dep.razorpay_payment_id) {
          try {
            console.log(`[stateMachine] Automatically triggering refund for deposit ${dep.id}...`);
            const paymentsService = require('./payments.service');
            await paymentsService.refundDeposit(dep.id, changedBy, 'Booking cancelled/archived', client);
          } catch (refundErr) {
            console.error(`[stateMachine] Refund for deposit ${dep.id} failed:`, refundErr.message);
          }
        }
      }

      // Automatically trigger Razorpay invoice refund if one exists, is PAID and payment_method = 'RAZORPAY'
      const invRes = await client.query(
        "SELECT id, amount_paid, razorpay_payment_id, payment_method FROM invoices WHERE booking_id = $1 AND status = 'PAID'",
        [bookingId]
      );
      for (const inv of invRes.rows) {
        if (inv.payment_method === 'RAZORPAY' && inv.razorpay_payment_id) {
          try {
            console.log(`[stateMachine] Automatically triggering refund for invoice ${inv.id}...`);
            const paymentsService = require('./payments.service');
            await paymentsService.refundInvoice(inv.id, changedBy, 'Booking cancelled/archived', client);
          } catch (refundErr) {
            console.error(`[stateMachine] Refund for invoice ${inv.id} failed:`, refundErr.message);
          }
        }
      }
    }

    // 7. Append status history record
    await client.query(
      `INSERT INTO booking_status_history (booking_id, from_status, to_status, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [bookingId, fromStatus, toStatus, changedBy, reason || null]
    );

    // Run rules evaluation to ensure everything (invoices/deposits/alerts) updates in sync
    const ruleEngine = require('./ruleEngine.service');

    if (toStatus === 'QUOTATION_REQUESTED') {
      const qrRes = await client.query('SELECT id FROM quotation_requests WHERE booking_id = $1', [bookingId]);
      if (!qrRes.rows.length) {
        const bDetailsRes = await client.query(
          `SELECT customer_id, scheduled_delivery_date, scheduled_return_date, notes 
           FROM bookings WHERE id = $1`,
          [bookingId]
        );
        const bDetails = bDetailsRes.rows[0];
        const eqRes = await client.query('SELECT equipment_id FROM booking_equipment WHERE booking_id = $1', [bookingId]);
        const equipmentIds = eqRes.rows.map(r => r.equipment_id);

        if (bDetails && equipmentIds.length > 0) {
          const eqRatesRes = await client.query('SELECT SUM(rental_rate_per_day) as total_rate FROM equipment WHERE id = ANY($1)', [equipmentIds]);
          const dailyRate = parseFloat(eqRatesRes.rows[0].total_rate || 0);
          const days = Math.ceil((new Date(bDetails.scheduled_return_date) - new Date(bDetails.scheduled_delivery_date)) / (1000 * 60 * 60 * 24));
          const initialAmount = dailyRate * (days || 1);

          const insertQrRes = await client.query(
            `INSERT INTO quotation_requests (booking_id, customer_id, equipment_ids, scheduled_delivery_date, scheduled_return_date, initial_amount, notes_from_customer, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING_QUOTE')
             RETURNING id`,
            [bookingId, bDetails.customer_id, JSON.stringify(equipmentIds), bDetails.scheduled_delivery_date, bDetails.scheduled_return_date, initialAmount, bDetails.notes || null]
          );
          const quotationId = insertQrRes.rows[0].id;

          const breakdown = {
            equipment_cost: initialAmount,
            delivery_fee: 500,
            insurance: 0,
            total: initialAmount + 500
          };

          await client.query(
            `INSERT INTO quotation_versions (quotation_request_id, version_number, quote_amount, breakdown, created_by)
             VALUES ($1, 1, $2, $3, 'SYSTEM')`,
            [quotationId, breakdown.total, JSON.stringify(breakdown)]
          );
        }
      }
    }

    await ruleEngine.processBookingRules(bookingId, client);

    await client.query('COMMIT');

    // Asynchronously dispatch notifications based on status changes
    (async () => {
      try {
        const bookingsService = require('./bookings.service');
        const notificationsService = require('./notifications.service');
        const fullBooking = await bookingsService.getBookingById(bookingId);
        
        if (toStatus === 'CONFIRMED') {
          await notificationsService.sendConfirmation(fullBooking);
        } else if (toStatus === 'OUT_FOR_DELIVERY') {
          await notificationsService.sendReminder(fullBooking, 'DELIVERY_REMINDER');
        } else if (toStatus === 'PICKED_UP_AND_RETURNED') {
          await notificationsService.sendFollowUp(fullBooking);
        } else if (toStatus === 'QUOTATION_REQUESTED') {
          await notificationsService.sendQuoteAcknowledgement(fullBooking);
        } else if (toStatus === 'CANCELLATION_REQUESTED') {
          await notificationsService.sendCancellationRequested(fullBooking);
        } else if (toStatus === 'CANCELLED') {
          await notificationsService.sendCancellationConfirmed(fullBooking);
        }
      } catch (err) {
        console.error('[stateMachine] Notification dispatch failed:', err.message);
      }
    })();

    // 8. Return updated booking summary
    const updatedOps = await db.query('SELECT * FROM operations_logs WHERE booking_id = $1', [bookingId]);
    return {
      booking_id:      booking.id,
      booking_ref:     booking.booking_ref,
      previous_status: fromStatus,
      current_status:  toStatus,
      changed_by:      changedBy,
      changed_at:      new Date().toISOString(),
      operations_log:  updatedOps.rows[0] || null,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function getAllowedTransitions(fromStatus) {
  return ALLOWED_TRANSITIONS[fromStatus] || [];
}

module.exports = { transition, getAllowedTransitions, ALLOWED_TRANSITIONS };
