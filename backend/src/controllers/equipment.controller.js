'use strict';

const db = require('../config/db');

async function listEquipment(req, res, next) {
  try {
    const { status, category } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) { conditions.push(`status = $${idx++}::equipment_status`); params.push(status); }
    if (category) { conditions.push(`category ILIKE $${idx++}`); params.push(`%${category}%`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(`SELECT * FROM equipment ${where} ORDER BY category, name`, params);

    const isStaff = req.user && (req.user.role === 'ADMIN' || req.user.role === 'EMPLOYEE');
    const data = result.rows.map(row => {
      if (!isStaff) {
        const { replacement_value, notes, acquired_at, last_serviced_at, ...rest } = row;
        return rest;
      }
      return row;
    });

    res.json({
      success: true,
      data,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function updateEquipmentStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      const err = new Error('Status field is required.');
      err.statusCode = 400;
      err.code = 'STATUS_REQUIRED';
      throw err;
    }

    const query = `
      UPDATE equipment
      SET status = $1::equipment_status, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(query, [status, id]);

    if (result.rows.length === 0) {
      const err = new Error(`Equipment item with ID ${id} not found.`);
      err.statusCode = 404;
      err.code = 'EQUIPMENT_NOT_FOUND';
      throw err;
    }

    if (req.user?.role === 'ADMIN' || req.user?.role === 'EMPLOYEE') {
      const activityLogService = require('../services/activityLog.service');
      await activityLogService.logAction({
        userId: req.user.userId,
        userName: req.user.name,
        userEmail: req.user.email,
        action: 'UPDATE_EQUIPMENT_STATUS',
        entityType: 'EQUIPMENT',
        entityId: id,
        details: `Changed status of ${result.rows[0].name} to ${status}`
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function createEquipment(req, res, next) {
  try {
    const { serial_number, name, category, brand, model_number, rental_rate_per_day, replacement_value, description, notes } = req.body;
    if (!serial_number || !name || !category) {
      const err = new Error('Serial number, name, and category are required.');
      err.statusCode = 400;
      err.code = 'VALIDATION_FAILED';
      throw err;
    }

    const query = `
      INSERT INTO equipment (serial_number, name, category, brand, model_number, rental_rate_per_day, replacement_value, description, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const result = await db.query(query, [
      serial_number,
      name,
      category,
      brand || null,
      model_number || null,
      rental_rate_per_day || 0.00,
      replacement_value || 0.00,
      description || null,
      notes || null
    ]);

    const eq = result.rows[0];

    // Log audit activity
    if (req.user?.role === 'ADMIN' || req.user?.role === 'EMPLOYEE') {
      const activityLogService = require('../services/activityLog.service');
      await activityLogService.logAction({
        userId: req.user.userId,
        userName: req.user.name,
        userEmail: req.user.email,
        action: 'CREATE_EQUIPMENT',
        entityType: 'EQUIPMENT',
        entityId: eq.id,
        details: `Added new equipment: ${name} (${serial_number})`
      });
    }

    res.status(201).json({
      success: true,
      data: eq,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() }
    });
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation (serial_number)
      err.statusCode = 409;
      err.message = 'An equipment with this serial number already exists.';
    }
    next(err);
  }
}

module.exports = { listEquipment, updateEquipmentStatus, createEquipment };
