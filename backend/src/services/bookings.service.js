'use strict';

const db = require('../config/db');

// ─── List bookings (paginated, filtered) ─────────────────────────────────────

async function listBookings({ status, priority, source, assigned_owner, date_from, date_to, owner, customer_name, equipment_id, customer_email, page, limit, sort, order }) {
  const conditions = ['b.is_deleted = FALSE'];
  const params = [];
  let idx = 1;

  if (customer_email) {
    conditions.push(`c.email = $${idx++}`);
    params.push(customer_email.toLowerCase().trim());
  }

  if (status) {
    const statuses = status.split('|').map((s) => s.trim());
    conditions.push(`b.status = ANY($${idx++}::booking_status[])`);
    params.push(statuses);
  }
  if (priority) {
    conditions.push(`b.priority = $${idx++}`);
    params.push(priority);
  }
  if (source) {
    conditions.push(`b.source = $${idx++}`);
    params.push(source);
  }
  if (assigned_owner) {
    conditions.push(`b.assigned_owner = $${idx++}`);
    params.push(assigned_owner);
  }
  if (date_from) {
    conditions.push(`b.scheduled_delivery_date >= $${idx++}`);
    params.push(date_from);
  }
  if (date_to) {
    conditions.push(`b.scheduled_delivery_date <= $${idx++}`);
    params.push(date_to);
  }
  if (owner) {
    conditions.push(`b.creator_details->>'operator_email' = $${idx++}`);
    params.push(owner);
  }
  if (customer_name) {
    conditions.push(`c.name ILIKE $${idx++}`);
    params.push(`%${customer_name}%`);
  }
  if (equipment_id) {
    conditions.push(`EXISTS (SELECT 1 FROM booking_equipment be WHERE be.booking_id = b.id AND be.equipment_id = $${idx++})`);
    params.push(equipment_id);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const allowedSorts = { created_at: 'b.created_at', scheduled_delivery_date: 'b.scheduled_delivery_date', status: 'b.status' };
  const orderClause = `${allowedSorts[sort] || 'b.created_at'} ${order === 'asc' ? 'ASC' : 'DESC'}`;
  const offset = (page - 1) * limit;

  // Count query
  const countSql = `
    SELECT COUNT(*) FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    ${where}
  `;
  const countRes = await db.query(countSql, params);
  const total = parseInt(countRes.rows[0].count, 10);

  // Data query
  const dataSql = `
    SELECT
      b.id                      AS booking_id,
      b.booking_ref,
      b.status,
      b.priority,
      b.source,
      b.assigned_owner,
      c.name                    AS customer_name,
      c.email                   AS customer_email,
      c.company                 AS customer_company,
      b.location->>'delivery_address' AS delivery_address_short,
      b.scheduled_delivery_date,
      b.scheduled_return_date,
      b.created_at,
      ol.driver_assigned,
      ol.operational_status,
      (SELECT COUNT(*) FROM booking_equipment be WHERE be.booking_id = b.id)::int AS equipment_count,
      (SELECT ARRAY_AGG(e.name ORDER BY e.name) FROM booking_equipment be JOIN equipment e ON be.equipment_id = e.id WHERE be.booking_id = b.id) AS equipment_preview
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    LEFT JOIN operations_logs ol ON ol.booking_id = b.id
    ${where}
    ORDER BY ${orderClause}
    LIMIT $${idx++} OFFSET $${idx++}
  `;
  params.push(limit, offset);
  const dataRes = await db.query(dataSql, params);

  return {
    data: dataRes.rows,
    pagination: { page, limit, total_records: total, total_pages: Math.ceil(total / limit) },
  };
}

// ─── Get single booking (full entity) ────────────────────────────────────────

async function getBookingById(id) {
  const ruleEngine = require('./ruleEngine.service');
  // Run rules evaluation to ensure everything is synced in DB
  const analysis = await ruleEngine.processBookingRules(id);

  const bookingRes = await db.query(
    `SELECT
       b.id AS booking_id, b.booking_ref, b.status, b.priority, b.source, b.assigned_owner,
       b.creator_details, b.location, b.notes,
       b.scheduled_delivery_date, b.scheduled_return_date,
       b.created_at, b.updated_at,
       c.name AS customer_name, c.email AS customer_email,
       c.phone AS customer_phone, c.company AS customer_company
     FROM bookings b
     JOIN customers c ON b.customer_id = c.id
     WHERE b.id = $1 AND b.is_deleted = FALSE`,
    [id]
  );

  if (!bookingRes.rows.length) {
    const err = new Error(`Booking with ID ${id} not found.`);
    err.statusCode = 404;
    err.code = 'BOOKING_NOT_FOUND';
    throw err;
  }

  const booking = bookingRes.rows[0];

  const [equipRes, opsRes, historyRes, alertsRes, invoiceRes, depositRes, damageRes] = await Promise.all([
    db.query(
      `SELECT e.id, e.serial_number, e.name, e.category, e.rental_rate_per_day, e.status, e.brand, e.model_number, e.replacement_value
       FROM booking_equipment be JOIN equipment e ON be.equipment_id = e.id
       WHERE be.booking_id = $1 ORDER BY e.name`,
      [id]
    ),
    db.query('SELECT * FROM operations_logs WHERE booking_id = $1', [id]),
    db.query(
      `SELECT from_status, to_status, changed_by, reason, changed_at
       FROM booking_status_history WHERE booking_id = $1 ORDER BY changed_at ASC`,
      [id]
    ),
    db.query(
      `SELECT id AS alert_id, trigger_type, priority, message, created_at
       FROM system_alerts WHERE related_entity LIKE $1 AND resolved_at IS NULL ORDER BY created_at DESC`,
      [`booking:${booking.booking_ref}%`]
    ),
    db.query('SELECT * FROM invoices WHERE booking_id = $1 ORDER BY created_at DESC', [id]),
    db.query('SELECT * FROM deposits WHERE booking_id = $1 ORDER BY created_at DESC', [id]),
    db.query('SELECT dr.*, e.name as equipment_name FROM damage_reports dr JOIN equipment e ON dr.equipment_id = e.id WHERE dr.booking_id = $1 ORDER BY dr.created_at DESC', [id]),
  ]);

  return {
    booking_id:    booking.booking_id,
    booking_ref:   booking.booking_ref,
    status:        booking.status,
    priority:      booking.priority,
    source:        booking.source,
    assigned_owner: booking.assigned_owner,
    customer: {
      name:    booking.customer_name,
      email:   booking.customer_email,
      phone:   booking.customer_phone,
      company: booking.customer_company,
    },
    creator:       booking.creator_details,
    location:      booking.location,
    notes:         booking.notes,
    scheduled_delivery_date: booking.scheduled_delivery_date,
    scheduled_return_date:   booking.scheduled_return_date,
    equipment:     equipRes.rows,
    operations_log: opsRes.rows[0] || null,
    status_history: historyRes.rows,
    active_alerts:  alertsRes.rows,
    invoices:       invoiceRes.rows,
    deposits:       depositRes.rows,
    damage_reports: damageRes.rows,
    generated_summary: analysis?.summary || '',
    recommendations:   analysis?.recommendations || [],
    next_actions:      analysis?.next_actions || [],
    created_at:    booking.created_at,
    updated_at:    booking.updated_at,
  };
}

// ─── Create booking ───────────────────────────────────────────────────────────

async function createBooking(payload) {
  const { customer, creator, equipment_ids, location, scheduled_delivery_date, scheduled_return_date, notes, priority = 'MEDIUM', source = 'PORTAL', assigned_owner = null, status = 'DRAFT' } = payload;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Check for equipment conflicts and lock equipment rows
    const alertsService = require('./alerts.service');
    await alertsService.checkConflictsAndLock(client, equipment_ids, scheduled_delivery_date, scheduled_return_date);

    // Upsert customer
    const custRes = await client.query(
      `INSERT INTO customers (name, email, phone, company)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [customer.name, customer.email, customer.phone, customer.company || null]
    );

    let customerId;
    if (custRes.rows.length) {
      customerId = custRes.rows[0].id;
    } else {
      const existing = await client.query('SELECT id FROM customers WHERE email = $1', [customer.email]);
      customerId = existing.rows[0].id;
    }

    // Auto booking ref
    const year = new Date().getFullYear();
    const seqRes = await client.query(`SELECT LPAD(nextval('booking_ref_seq')::TEXT, 5, '0') AS ref_num`);
    const bookingRef = `SD-${year}-${seqRes.rows[0].ref_num}`;

    // Insert booking
    const bookingRes = await client.query(
      `INSERT INTO bookings (booking_ref, customer_id, creator_details, location, status, priority, source, assigned_owner, scheduled_delivery_date, scheduled_return_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, booking_ref, status, priority, source, assigned_owner, created_at, updated_at`,
      [bookingRef, customerId, JSON.stringify(creator), JSON.stringify(location), status, priority, source, assigned_owner, scheduled_delivery_date, scheduled_return_date, notes || null]
    );
    const booking = bookingRes.rows[0];

    // Link equipment
    for (const eqId of equipment_ids) {
      await client.query(
        'INSERT INTO booking_equipment (booking_id, equipment_id) VALUES ($1, $2)',
        [booking.id, eqId]
      );
    }

    // Create operations log stub
    await client.query(
      'INSERT INTO operations_logs (booking_id) VALUES ($1)',
      [booking.id]
    );

    // Initial status history
    await client.query(
      `INSERT INTO booking_status_history (booking_id, from_status, to_status, changed_by, reason)
       VALUES ($1, NULL, $2, $3, 'Initial booking creation')`,
      [booking.id, status, creator.operator_name]
    );

    // Run rules engine to build invoices/deposits
    const ruleEngine = require('./ruleEngine.service');
    await ruleEngine.processBookingRules(booking.id, client);

    if (status === 'QUOTATION_REQUESTED') {
      const eqRatesRes = await client.query('SELECT SUM(rental_rate_per_day) as total_rate FROM equipment WHERE id = ANY($1)', [equipment_ids]);
      const dailyRate = parseFloat(eqRatesRes.rows[0].total_rate || 0);
      const days = Math.ceil((new Date(scheduled_return_date) - new Date(scheduled_delivery_date)) / (1000 * 60 * 60 * 24));
      const initialAmount = dailyRate * (days || 1);

      const qRes = await client.query(
        `INSERT INTO quotation_requests (booking_id, customer_id, equipment_ids, scheduled_delivery_date, scheduled_return_date, initial_amount, notes_from_customer, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING_QUOTE')
         RETURNING id`,
        [booking.id, customerId, JSON.stringify(equipment_ids), scheduled_delivery_date, scheduled_return_date, initialAmount, notes || null]
      );
      const quotationId = qRes.rows[0].id;
      
      const breakdown = {
        equipment_cost: initialAmount,
        delivery_fee: 500, // standard delivery fee estimate
        insurance: 0,
        total: initialAmount + 500
      };

      await client.query(
        `INSERT INTO quotation_versions (quotation_request_id, version_number, quote_amount, breakdown, created_by)
         VALUES ($1, 1, $2, $3, 'SYSTEM')`,
        [quotationId, breakdown.total, JSON.stringify(breakdown)]
      );
    }

    await client.query('COMMIT');

    // Fetch full booking details for notifications
    let fullBooking;
    try {
      fullBooking = await getBookingById(booking.id);
      const notificationsService = require('./notifications.service');
      if (status === 'QUOTATION_REQUESTED') {
        await notificationsService.sendQuoteAcknowledgement(fullBooking);
      } else if (status === 'CONFIRMED') {
        await notificationsService.sendConfirmation(fullBooking);
      }
    } catch (err) {
      console.error('[BookingsService] Notification dispatch failed:', err.message);
    }

    // Fetch equipment names for response
    const eqRes = await db.query(
      'SELECT id, name, serial_number FROM equipment WHERE id = ANY($1)',
      [equipment_ids]
    );

    return {
      booking_id:   booking.id,
      booking_ref:  booking.booking_ref,
      status:       booking.status,
      customer,
      equipment:    eqRes.rows,
      location,
      scheduled_delivery_date,
      scheduled_return_date,
      created_at:   booking.created_at,
      updated_at:   booking.updated_at,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { listBookings, getBookingById, createBooking };
