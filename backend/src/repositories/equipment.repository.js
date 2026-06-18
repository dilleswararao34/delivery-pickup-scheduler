'use strict';

/**
 * Equipment Repository
 * Raw SQL data access for the equipment table.
 */

const db = require('../config/db');

async function findAll({ status, category } = {}) {
  const conditions = [];
  const params     = [];
  let idx = 1;

  if (status) {
    conditions.push(`status = $${idx++}::equipment_status`);
    params.push(status);
  }
  if (category) {
    conditions.push(`category ILIKE $${idx++}`);
    params.push(`%${category}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query(
    `SELECT * FROM equipment ${where} ORDER BY category, name`,
    params
  );
  return result.rows;
}

async function findByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const result = await db.query(
    `SELECT * FROM equipment WHERE equipment_id IN (${placeholders})`,
    ids
  );
  return result.rows;
}

async function updateStatus(client, equipmentId, newStatus) {
  const result = await client.query(
    `UPDATE equipment SET status = $1::equipment_status, updated_at = NOW()
     WHERE equipment_id = $2 RETURNING *`,
    [newStatus, equipmentId]
  );
  return result.rows[0];
}

module.exports = { findAll, findByIds, updateStatus };
