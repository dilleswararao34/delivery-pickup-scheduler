'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/operations.controller');

router.post('/create', ctrl.create);
router.get('/list', ctrl.list);
router.get('/detail/:id', ctrl.detail);
router.post('/process', ctrl.processRules);
router.post('/status-update', ctrl.statusUpdate);
router.get('/dashboard', ctrl.getDashboard);
router.post('/damage-report', ctrl.logDamageReport);
router.post('/trigger-daily-jobs', ctrl.triggerDailyJobs);

module.exports = router;
