'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/equipment.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { optionalAuth } = require('../middleware/auth.middleware');
const requireRole = require('../middleware/requireRole');

// GET /api/v1/equipment
router.get('/', optionalAuth, ctrl.listEquipment);

// POST /api/v1/equipment
router.post('/', authMiddleware, requireRole('ADMIN', 'EMPLOYEE'), ctrl.createEquipment);

// PUT /api/v1/equipment/:id/status
router.put('/:id/status', authMiddleware, requireRole('ADMIN', 'EMPLOYEE'), ctrl.updateEquipmentStatus);

module.exports = router;
