'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/equipment.controller');

// GET /api/v1/equipment
router.get('/', ctrl.listEquipment);

// POST /api/v1/equipment
router.post('/', ctrl.createEquipment);

// PUT /api/v1/equipment/:id/status
router.put('/:id/status', ctrl.updateEquipmentStatus);

module.exports = router;
