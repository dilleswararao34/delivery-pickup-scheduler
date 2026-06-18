'use strict';

/**
 * Bookings Repository
 * Raw SQL data access layer for the bookings table.
 * Services call these methods — never raw DB queries directly.
 */

const db = require('../config/db');

// ─── Pagination helper ────────────────────────────────────────────────────────
function buildPagination(page = 1, limit = 25) {
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
  return { limit: l, offset: (p - 1) * l, page: p };
}

// ─── Find many with optional filters ─────────────────────────────────────────
async function findMany({ status, customer_name, from_date, to_date, page = 1, limit = 25 }) {
  const conditions = [];
  const params     = [];
  let idx = 1;

  if (status) {
    const statuses = status.split('|');
    const placeholders = statuses.map(() => `$${idx++}`).join(', ');
    conditions.push(`b.status IN (${placeholders})`);
    params.push(...statuses);
  }
  if (customer_name) {
    conditions.push(`b.customer_name ILIKE $${idx++}`);
    params.push(`%${customer_name}%`);
  }
  if (from_date) {
    conditions.push(`b.scheduled_delivery_date >= $${idx++}::timestamptz`);
    params.push(from_date);
  }
  if (to_date) {
    conditions.push(`b.scheduled_return_date <= $${idx++}::timestamptz`);
    params.push(to_date);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { limit: lim, offset, page: pg } = buildPagination(page, limit);

  const countResult = await db.query(
    `SELECT COUNT(*) FROM bookings b ${where}`,
    params
  );
  const totalRecords = parseInt(countResult.rows[0].count, 10);

  const dataResult = await db.query(
    `SELECT b.*, ol.driver_assigned, ol.operational_status
     FROM bookings b
     LEFT JOIN operations_logs ol ON ol.booking_id = b.booking_id
     ${where}
     ORDER BY b.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, lim, offset]
  );

  return {
    rows:     dataResult.rows,
    total:    totalRecords,
    page:     pg,
    limit:    lim,
    pages:    Math.ceil(totalRecords / lim),
  };
}

// ─── Find one by ID ───────────────────────────────────────────────────────────
async function findById(bookingId) {
  const result = await db.query(
    `SELECT b.*,
            ol.log_id, ol.driver_assigned, ol.driver_phone, ol.vehicle_id,
            ol.scheduled_pickup_time, ol.scheduled_return_time,
            ol.actual_delivery_time, ol.actual_return_time,
            ol.operational_status, ol.dispatch_notes
     FROM bookings b
     LEFT JOIN operations_logs ol ON ol.booking_id = b.booking_id
     WHERE b.booking_id = $1`,
    [bookingId]
  );
  return result.rows[0] || null;
}

// ─── Insert ───────────────────────────────────────────────────────────────────
async function insert(client, data) {
  const {
    booking_id, booking_ref, customer_name, customer_email, customer_phone,
    customer_company, creator_details, location, equipment_ids,
    scheduled_delivery_date, scheduled_return_date, notes,
  } = data;

  const result = await client.query(
    `INSERT INTO bookings
       (booking_id, booking_ref, customer_name, customer_email, customer_phone,
        customer_company, creator_details, location, equipment_ids,
        scheduled_delivery_date, scheduled_return_date, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      booking_id, booking_ref, customer_name, customer_email, customer_phone,
      customer_company,
      JSON.stringify(creator_details),
      JSON.stringify(location),
      equipment_ids,
      scheduled_delivery_date, scheduled_return_date, notes,
    ]
  );
  return result.rows[0];
}

// ─── Update status ────────────────────────────────────────────────────────────
async function updateStatus(client, bookingId, newStatus) {
  const result = await client.query(
    `UPDATE bookings SET status = $1::booking_status, updated_at = NOW()
     WHERE booking_id = $2 RETURNING *`,
    [newStatus, bookingId]
  );
  return result.rows[0];
}

// ─── Lock row for update (returns current row) ────────────────────────────────
async function lockForUpdate(client, bookingId) {
  const result = await client.query(
    `SELECT * FROM bookings WHERE booking_id = $1 FOR UPDATE`,
    [bookingId]
  );
  return result.rows[0] || null;
}

module.exports = { findMany, findById, insert, updateStatus, lockForUpdate };
