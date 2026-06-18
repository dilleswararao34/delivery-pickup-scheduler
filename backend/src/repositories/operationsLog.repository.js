'use strict';

/**
 * Operations Log Repository
 * Raw SQL data access for the operations_logs table.
 */

const db = require('../config/db');

async function findByBookingId(bookingId) {
  const result = await db.query(
    `SELECT * FROM operations_logs WHERE booking_id = $1 ORDER BY created_at DESC`,
    [bookingId]
  );
  return result.rows;
}

async function insert(client, data) {
  const {
    log_id, booking_id, driver_assigned, driver_phone, vehicle_id,
    scheduled_pickup_time, scheduled_return_time,
    operational_status, dispatch_notes,
  } = data;

  const result = await client.query(
    `INSERT INTO operations_logs
       (log_id, booking_id, driver_assigned, driver_phone, vehicle_id,
        scheduled_pickup_time, scheduled_return_time, operational_status, dispatch_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      log_id, booking_id, driver_assigned, driver_phone, vehicle_id,
      scheduled_pickup_time, scheduled_return_time,
      operational_status, dispatch_notes,
    ]
  );
  return result.rows[0];
}

async function updateOperationalStatus(client, bookingId, operationalStatus) {
  const result = await client.query(
    `UPDATE operations_logs
     SET operational_status = $1, updated_at = NOW()
     WHERE booking_id = $2
     RETURNING *`,
    [operationalStatus, bookingId]
  );
  return result.rows[0];
}

async function recordDelivery(client, bookingId) {
  const result = await client.query(
    `UPDATE operations_logs
     SET actual_delivery_time = NOW(), operational_status = 'EQUIPMENT_DELIVERED', updated_at = NOW()
     WHERE booking_id = $1
     RETURNING *`,
    [bookingId]
  );
  return result.rows[0];
}

async function recordReturn(client, bookingId) {
  const result = await client.query(
    `UPDATE operations_logs
     SET actual_return_time = NOW(), operational_status = 'RETURNED_TO_DEPOT', updated_at = NOW()
     WHERE booking_id = $1
     RETURNING *`,
    [bookingId]
  );
  return result.rows[0];
}

module.exports = { findByBookingId, insert, updateOperationalStatus, recordDelivery, recordReturn };
