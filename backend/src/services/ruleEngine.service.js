'use strict';

const db = require('../config/db');

/**
 * Business Rule Engine
 * Analyzes booking status, equipment lists, and dates to:
 * - Validate records
 * - Assign/verify priority levels
 * - Assign/verify owner
 * - Generate text summaries
 * - Generate operational recommendations
 * - Suggest next workflow actions
 * - Flag potential conflicts or overdue states (alerts)
 * - Determine invoice and security deposit amounts
 */

function runRules(booking, equipment = [], opsLog = {}, staffList = []) {
  const now = new Date();
  const deliveryDate = new Date(booking.scheduled_delivery_date);
  const returnDate = new Date(booking.scheduled_return_date);
  
  // Calculate rental duration
  const diffTime = Math.abs(returnDate - deliveryDate);
  const rentalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

  // Compute financial metrics
  const totalDailyRate = equipment.reduce((sum, eq) => sum + parseFloat(eq.rental_rate_per_day || 0), 0);
  const rentalCost = totalDailyRate * rentalDays;
  const totalReplacementValue = equipment.reduce((sum, eq) => sum + parseFloat(eq.replacement_value || 0), 0);

  // 1. Determine Priority
  // High financial value or urgency increases priority
  let priority = 'MEDIUM';
  if (rentalCost > 1000 || totalReplacementValue > 8000) {
    priority = 'CRITICAL';
  } else if (rentalCost > 500 || totalReplacementValue > 4000) {
    priority = 'HIGH';
  } else if (rentalDays < 2) {
    priority = 'LOW';
  }

  // 2. Track Ownership (Assign appropriate personnel)
  // High value/priority bookings go to Admin users (Senior Staff), others to Employee users (Junior Staff)
  let assignedOwner = booking.assigned_owner;

  if (staffList && staffList.length > 0) {
    const admins = staffList.filter(s => s.role === 'ADMIN');
    const employees = staffList.filter(s => s.role === 'EMPLOYEE');

    if (priority === 'CRITICAL' || priority === 'HIGH') {
      const target = admins.length > 0 ? admins[0] : (employees.length > 0 ? employees[0] : null);
      if (target) assignedOwner = target.name;
    } else {
      const target = employees.length > 0 ? employees[0] : (admins.length > 0 ? admins[0] : null);
      if (target) assignedOwner = target.name;
    }
  }

  if (!assignedOwner) {
    assignedOwner = booking.creator_details?.operator_name || 'Admin';
  }

  // 3. Generate Summary
  const equipNames = equipment.map(eq => eq.name).join(', ');
  const summary = `${booking.customer_name || 'Customer'} (${booking.customer_company || 'Individual'}) requested a ${rentalDays}-day rental for: ${equipNames || 'No equipment selected'}. Total Rental Fee: ₹${rentalCost.toFixed(2)}. Gear replacement valuation: ₹${totalReplacementValue.toFixed(2)}.`;

  // 4. Generate Recommendations
  const recommendations = [];
  if (totalReplacementValue > 5000) {
    recommendations.push('High-value equipment in transit. Ensure double lock-cases and secure vehicle storage.');
  }
  if (equipment.some(eq => eq.category === 'Drone / Aerial')) {
    recommendations.push('Drone kit included. Verify pilot certification and local airspace flight permissions before dispatch.');
  }
  if (equipment.some(eq => eq.status === 'UNDER_MAINTENANCE')) {
    recommendations.push('WARNING: One or more selected gear items are marked as under maintenance. Run diagnostic check before dispatch.');
  }
  if (rentalDays > 7) {
    recommendations.push('Long-term rental checklist: Schedule mid-rental maintenance check-in with the customer.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Follow standard cinema equipment handling checklists during dispatch.');
  }

  // 5. Suggest Next Actions
  const nextActions = [];
  const status = booking.status;
  if (status === 'DRAFT') {
    nextActions.push('Submit quotation request to customer.');
    nextActions.push('Review gear availability timelines.');
  } else if (status === 'QUOTATION_REQUESTED') {
    nextActions.push('Review total amount (₹' + rentalCost.toFixed(2) + '), approve quote, and issue invoice.');
    nextActions.push('Request security deposit from customer.');
  } else if (status === 'CONFIRMED') {
    if (!opsLog || !opsLog.driver_assigned) {
      nextActions.push('Assign delivery personnel and vehicle.');
    } else {
      nextActions.push('Print packing list and prepare equipment for dispatch.');
    }
  } else if (status === 'OUT_FOR_DELIVERY') {
    nextActions.push('Confirm drop-off and mark as DELIVERED upon customer receipt.');
    nextActions.push('Verify client signature on physical delivery receipt.');
  } else if (status === 'DELIVERED') {
    nextActions.push('Awaiting rental period completion.');
    nextActions.push('Schedule return/pickup vehicle collection.');
  } else if (status === 'AWAITING_PICKUP') {
    nextActions.push('Examine gear condition upon receipt and log return.');
    nextActions.push('Verify serial numbers match the booking records.');
  } else if (status === 'PICKED_UP_AND_RETURNED') {
    nextActions.push('Verify deposit refund status.');
    nextActions.push('Archive booking record.');
  } else if (status === 'ARCHIVED') {
    nextActions.push('No further actions needed. Archive complete.');
  }

  // 6. Produce Alerts
  const alerts = [];
  
  // Overdue check
  if (status !== 'PICKED_UP_AND_RETURNED' && status !== 'ARCHIVED' && now > returnDate) {
    const hoursOverdue = Math.round((now - returnDate) / (1000 * 60 * 60));
    alerts.push({
      trigger_type: 'OVERDUE_RETURN',
      priority: 'CRITICAL',
      message: `Equipment return is overdue by ${hoursOverdue} hour(s). Contact ${booking.customer_name} at ${booking.customer_phone || 'phone'} immediately.`,
    });
  }

  // Missing driver check for confirmed bookings
  if (status === 'CONFIRMED' && (!opsLog || !opsLog.driver_assigned)) {
    const timeToDelivery = (deliveryDate - now) / (1000 * 60 * 60); // hours
    if (timeToDelivery < 24) {
      alerts.push({
        trigger_type: 'DRIVER_UNASSIGNED',
        priority: 'HIGH',
        message: `Booking ${booking.booking_ref} is starting in less than 24 hours but no driver is assigned.`,
      });
    }
  }

  // Financial values for automated table insertion
  const invoiceAmount = rentalCost;
  const depositAmount = parseFloat((totalReplacementValue * 0.10).toFixed(2)); // 10% of replacement value

  return {
    priority,
    assigned_owner: assignedOwner,
    summary,
    recommendations,
    next_actions: nextActions,
    alerts,
    invoiceAmount,
    depositAmount,
    rentalDays,
  };
}

/**
 * Evaluates a booking and syncs generated entities (invoices, deposits, alerts) to the database.
 */
async function processBookingRules(bookingId, client = db) {
  // 1. Fetch booking details
  const bookingRes = await client.query(
    `SELECT
       b.id AS booking_id, b.booking_ref, b.status, b.priority, b.source, b.assigned_owner,
       b.scheduled_delivery_date, b.scheduled_return_date,
       c.name AS customer_name, c.email AS customer_email,
       c.phone AS customer_phone, c.company AS customer_company
     FROM bookings b
     JOIN customers c ON b.customer_id = c.id
     WHERE b.id = $1 AND b.is_deleted = FALSE`,
    [bookingId]
  );

  if (!bookingRes.rows.length) return null;
  const booking = bookingRes.rows[0];

  // 2. Fetch equipment
  const equipRes = await client.query(
    `SELECT e.id, e.name, e.category, e.rental_rate_per_day, e.replacement_value, e.status
     FROM booking_equipment be JOIN equipment e ON be.equipment_id = e.id
     WHERE be.booking_id = $1`,
    [bookingId]
  );
  const equipment = equipRes.rows;

  // 3. Fetch ops log
  const opsRes = await client.query('SELECT * FROM operations_logs WHERE booking_id = $1', [bookingId]);
  const opsLog = opsRes.rows[0] || {};

  // Fetch active employees/admins
  const staffRes = await client.query(
    `SELECT name, role FROM users WHERE role IN ('ADMIN', 'EMPLOYEE') AND is_active = TRUE`
  );
  const staffList = staffRes.rows;

  // 4. Run rules logic
  const analysis = runRules(booking, equipment, opsLog, staffList);

  // 5. Update booking with computed priority & assigned_owner if different
  if (booking.priority !== analysis.priority || booking.assigned_owner !== analysis.assigned_owner) {
    await client.query(
      `UPDATE bookings
       SET priority = $1, assigned_owner = $2
       WHERE id = $3`,
      [analysis.priority, analysis.assigned_owner, bookingId]
    );
  }

  // 6. Auto-generate Invoice
  // If status is QUOTATION_REQUESTED, CONFIRMED, DELIVERED, etc.
  if (['QUOTATION_REQUESTED', 'CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'AWAITING_PICKUP', 'PICKED_UP_AND_RETURNED'].includes(booking.status)) {
    const invRes = await client.query('SELECT id FROM invoices WHERE booking_id = $1', [bookingId]);
    if (!invRes.rows.length) {
      const invoiceRef = `INV-${booking.booking_ref.slice(3)}-01`;
      const dueDays = booking.status === 'QUOTATION_REQUESTED' ? 7 : 0;
      const dueAt = new Date(new Date(booking.scheduled_delivery_date).getTime() - (dueDays * 24 * 60 * 60 * 1000));
      
      await client.query(
        `INSERT INTO invoices (booking_id, invoice_ref, amount_due, amount_paid, status, due_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [bookingId, invoiceRef, analysis.invoiceAmount, 0, 'UNPAID', dueAt]
      );
    }
  }

  // 7. Auto-generate Deposit
  if (['QUOTATION_REQUESTED', 'CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'AWAITING_PICKUP', 'PICKED_UP_AND_RETURNED'].includes(booking.status)) {
    const depRes = await client.query('SELECT id FROM deposits WHERE booking_id = $1', [bookingId]);
    if (!depRes.rows.length && analysis.depositAmount > 0) {
      await client.query(
        `INSERT INTO deposits (booking_id, amount, status, payment_method)
         VALUES ($1, $2, $3, $4)`,
        [bookingId, analysis.depositAmount, 'PENDING', null]
      );
    }
  }

  // 8. Auto-create System Alerts in DB if overdue
  for (const alert of analysis.alerts) {
    // Check if duplicate alert exists
    const alertDup = await client.query(
      `SELECT id FROM system_alerts
       WHERE related_entity = $1 AND trigger_type = $2 AND resolved_at IS NULL`,
      [`booking:${booking.booking_ref}`, alert.trigger_type]
    );
    if (!alertDup.rows.length) {
      await client.query(
        `INSERT INTO system_alerts (related_entity, trigger_type, priority, message)
         VALUES ($1, $2, $3, $4)`,
        [`booking:${booking.booking_ref}`, alert.trigger_type, alert.priority, alert.message]
      );
    }
  }

  return analysis;
}

module.exports = {
  runRules,
  processBookingRules,
};
