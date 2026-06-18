'use strict';

const db = require('../config/db');

/**
 * Log a meaningful employee or admin action to employee_activity_logs.
 */
async function logAction({ userId, userName, userEmail, action, entityType, entityId, details }, client = db) {
  try {
    const query = `
      INSERT INTO employee_activity_logs (user_id, user_name, user_email, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const res = await client.query(query, [
      userId,
      userName,
      userEmail,
      action,
      entityType,
      entityId || null,
      details || null
    ]);
    console.log(`[ActivityLog] Logged action: ${action} on ${entityType}:${entityId || 'none'} by ${userEmail}`);
    return res.rows[0];
  } catch (err) {
    console.error('[ActivityLogService] Failed to insert log entry:', err.message);
  }
}

/**
 * Retrieve activity logs. Accessible only by main admin.
 */
async function getActivityLogs({ userId, dateFrom, dateTo, page = 1, limit = 50 }) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (userId) {
    conditions.push(`user_id = $${idx++}`);
    params.push(userId);
  }
  if (dateFrom) {
    conditions.push(`timestamp >= $${idx++}`);
    params.push(new Date(dateFrom).toISOString());
  }
  if (dateTo) {
    // Add one day to dateTo to include the full day
    const dTo = new Date(dateTo);
    dTo.setHours(23, 59, 59, 999);
    conditions.push(`timestamp <= $${idx++}`);
    params.push(dTo.toISOString());
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  // Count query
  const countSql = `SELECT COUNT(*)::int FROM employee_activity_logs ${where}`;
  const countRes = await db.query(countSql, params);
  const total = countRes.rows[0].count;

  // Data query
  const dataSql = `
    SELECT * FROM employee_activity_logs
    ${where}
    ORDER BY timestamp DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `;
  const dataParams = [...params, limit, offset];
  const dataRes = await db.query(dataSql, dataParams);

  return {
    data: dataRes.rows,
    pagination: {
      page,
      limit,
      total_records: total,
      total_pages: Math.ceil(total / limit)
    }
  };
}

module.exports = { logAction, getActivityLogs };
