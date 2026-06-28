'use strict';

const db = require('../config/db');

async function createAlert({ relatedEntity, triggerType, priority, message, payload }) {
  const res = await db.query(
    `INSERT INTO system_alerts (related_entity, trigger_type, priority, message, payload)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [relatedEntity, triggerType, priority || 'MEDIUM', message, payload ? JSON.stringify(payload) : null]
  );
  return res.rows[0];
}

async function getActiveAlerts(limit = 50) {
  const res = await db.query(
    `SELECT * FROM system_alerts
     WHERE dispatched_status = FALSE AND resolved_at IS NULL
     ORDER BY
       CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
       created_at DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

async function getAlertsByEntity(relatedEntity) {
  const res = await db.query(
    `SELECT * FROM system_alerts
     WHERE related_entity = $1 AND resolved_at IS NULL
     ORDER BY created_at DESC`,
    [relatedEntity]
  );
  return res.rows;
}

async function resolveAlert(alertId, resolvedBy) {
  const res = await db.query(
    `UPDATE system_alerts
     SET resolved_at = NOW(), resolved_by = $1, dispatched_status = TRUE
     WHERE id = $2
     RETURNING *`,
    [resolvedBy, alertId]
  );
  return res.rows[0];
}

async function checkEquipmentConflict(equipmentIds, deliveryDate, returnDate, excludeBookingId = null) {
  const conflicts = [];

  for (const eqId of equipmentIds) {
    const query = `
      SELECT b.booking_ref, e.name as equipment_name
      FROM booking_equipment be
      JOIN bookings b ON be.booking_id = b.id
      JOIN equipment e ON be.equipment_id = e.id
      WHERE be.equipment_id = $1
        AND b.is_deleted = FALSE
        AND b.status IN ('CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'AWAITING_PICKUP')
        AND b.scheduled_delivery_date < $3
        AND b.scheduled_return_date   > $2
        ${excludeBookingId ? 'AND b.id != $4' : ''}
    `;
    const params = excludeBookingId
      ? [eqId, deliveryDate, returnDate, excludeBookingId]
      : [eqId, deliveryDate, returnDate];

    const res = await db.query(query, params);
    if (res.rows.length) {
      conflicts.push(...res.rows);
    }
  }

  return conflicts;
}

async function checkConflictsAndLock(client, equipmentIds, deliveryDate, returnDate, excludeBookingId = null) {
  if (!equipmentIds || equipmentIds.length === 0) return;

  // 1. Row-level lock on the requested equipment rows
  await client.query('SELECT id FROM equipment WHERE id = ANY($1) FOR UPDATE', [equipmentIds]);

  // 2. Query for overlapping active bookings
  const query = `
    SELECT b.booking_ref, e.name as equipment_name
    FROM booking_equipment be
    JOIN bookings b ON be.booking_id = b.id
    JOIN equipment e ON be.equipment_id = e.id
    WHERE be.equipment_id = ANY($1)
      AND b.is_deleted = FALSE
      AND b.status IN ('CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'AWAITING_PICKUP')
      AND b.scheduled_delivery_date < $3
      AND b.scheduled_return_date > $2
      ${excludeBookingId ? 'AND b.id != $4' : ''}
  `;
  
  const params = excludeBookingId
    ? [equipmentIds, deliveryDate, returnDate, excludeBookingId]
    : [equipmentIds, deliveryDate, returnDate];

  const res = await client.query(query, params);

  if (res.rows.length > 0) {
    const list = res.rows.map(r => `${r.equipment_name} (reserved in booking ${r.booking_ref})`).join(', ');
    const err = new Error(`Equipment conflict detected: ${list}`);
    err.statusCode = 409;
    err.code = 'EQUIPMENT_CONFLICT';
    throw err;
  }
}

module.exports = {
  createAlert,
  getActiveAlerts,
  getAlertsByEntity,
  resolveAlert,
  checkEquipmentConflict,
  checkConflictsAndLock,
};
