'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const bookingsRouter  = require('./src/routes/bookings.routes');
const equipmentRouter = require('./src/routes/equipment.routes');
const authRouter      = require('./src/routes/auth.routes');
const operationsRouter = require('./src/routes/operations.routes');
const paymentsRouter   = require('./src/routes/payments.routes');
const chatRouter       = require('./src/routes/chat.routes');
const quotationsRouter = require('./src/routes/quotations.routes');
const authMiddleware  = require('./src/middleware/auth.middleware');
const requireRole      = require('./src/middleware/requireRole');
const errorHandler    = require('./src/middleware/errorHandler');


const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL].filter(Boolean)
  : [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
    ];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS policy: origin ${origin} not permitted`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  credentials: true,
}));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Request ID propagation ───────────────────────────────────────────────────
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || require('crypto').randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: { 
      status: 'healthy', 
      service: 'sd-digitals-scheduler-api', 
      version: '1.0.0',
      smtp: {
        configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD),
        host: process.env.SMTP_HOST || null,
        user: process.env.SMTP_USER || null,
        from: process.env.SMTP_FROM || null
      }
    },
    meta: { timestamp: new Date().toISOString() },
    error: null,
  });
});

// ─── Email Diagnostic Test ──────────────────────────────────────────────────
app.get('/test-email', async (req, res) => {
  const to = req.query.to || 'potnurudilleswararao34@gmail.com';
  const notificationsService = require('./src/services/notifications.service');
  
  const resendApiKey = process.env.RESEND_API_KEY;
  const transporter = resendApiKey ? null : await notificationsService.getTransporter();
  
  if (!resendApiKey && !transporter) {
    return res.json({ success: false, error: 'Neither SMTP Transporter nor Resend API Key is configured.' });
  }

  try {
    await notificationsService.logDispatch(
      'email',
      'TEST',
      to,
      'SD Digitals - Email Diagnostic Test',
      'If you are reading this, your email configurations are 100% working!',
      '<p>If you are reading this, your email configurations are 100% working!</p>'
    );
    res.json({ success: true, message: `Email dispatch triggered to ${to}. Check backend server logs or inbox.` });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ─── Razorpay Diagnostic Test ────────────────────────────────────────────────
app.get('/test-razorpay', async (req, res) => {
  const Razorpay = require('razorpay');
  const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
  const key_secret = process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret';
  
  console.log(`[test-razorpay] Initializing with key_id: ${key_id}`);
  const r = new Razorpay({ key_id, key_secret });

  const start = Date.now();
  try {
    const order = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Razorpay API request timed out (8s)')), 8000);
      
      r.orders.create({
        amount: 100,
        currency: 'INR',
        receipt: 'TEST-REC-' + Date.now(),
        payment_capture: 1
      }, (err, order) => {
        clearTimeout(t);
        if (err) return reject(err);
        resolve(order);
      });
    });
    res.json({ success: true, duration: `${Date.now() - start}ms`, order });
  } catch (err) {
    res.json({ success: false, duration: `${Date.now() - start}ms`, error: err.message });
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1/auth',      authRouter);
app.use('/api/v1/chat',      chatRouter);
app.use('/api/v1/payments',  paymentsRouter);
app.use('/api/v1/quotations', quotationsRouter);
app.use('/api/v1/bookings',  authMiddleware, bookingsRouter);         // JWT protected
app.use('/api/v1/equipment', equipmentRouter);                        // Selectively protected
app.use('/api/v1',           authMiddleware, requireRole('ADMIN', 'EMPLOYEE'), operationsRouter); // Staff operations only



// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found`, fields: null },
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ── Bootstrap ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n┌─────────────────────────────────────────────────┐`);
  console.log(`│  SD Digitals Scheduler API                      │`);
  console.log(`│  Listening on http://localhost:${PORT}              │`);
  console.log(`│  Environment: ${(process.env.NODE_ENV || 'development').padEnd(33)}│`);
  console.log(`└─────────────────────────────────────────────────┘\n`);

  // Run a one-off background sync to set image URLs in production DB
  const db = require('./src/config/db');
  db.query(`UPDATE equipment SET image_url = '/images/sony_fx3.png' WHERE name = 'Sony FX3 Cinema Rig' AND (image_url IS NULL OR image_url = '' OR image_url NOT LIKE '/images/%');`)
    .catch(e => console.error(e));
  db.query(`UPDATE equipment SET image_url = '/images/dji_ronin.png' WHERE name = 'DJI Ronin RS3 Pro Gimbal' AND (image_url IS NULL OR image_url = '' OR image_url NOT LIKE '/images/%');`)
    .catch(e => console.error(e));
  db.query(`UPDATE equipment SET image_url = '/images/aputure_light.png' WHERE name = 'Aputure 600d Light Storm' AND (image_url IS NULL OR image_url = '' OR image_url NOT LIKE '/images/%');`)
    .catch(e => console.error(e));
  db.query(`UPDATE equipment SET image_url = '/images/blackmagic_camera.png' WHERE name = 'Blackmagic Pocket Cinema Camera 6K G2' AND (image_url IS NULL OR image_url = '' OR image_url NOT LIKE '/images/%');`)
    .catch(e => console.error(e));
  db.query(`UPDATE equipment SET image_url = '/images/rode_mic.png' WHERE name = 'Rode NTG5 Shotgun Microphone Kit' AND (image_url IS NULL OR image_url = '' OR image_url NOT LIKE '/images/%');`)
    .catch(e => console.error(e));
  db.query(`UPDATE equipment SET image_url = '/images/dji_drone.png' WHERE name = 'DJI Mavic 3 Enterprise Drone Kit' AND (image_url IS NULL OR image_url = '' OR image_url NOT LIKE '/images/%');`)
    .catch(e => console.error(e));
  db.query(`UPDATE equipment SET image_url = '/images/dji_ronin.png' WHERE name = 'Zhiyun WEEBILL-3S Gimbal' AND (image_url IS NULL OR image_url = '' OR image_url NOT LIKE '/images/%');`)
    .catch(e => console.error(e));
  db.query(`UPDATE equipment SET image_url = '/images/aputure_light.png' WHERE name = 'Aputure NOVA P120c RGBWW Panel' AND (image_url IS NULL OR image_url = '' OR image_url NOT LIKE '/images/%');`)
    .catch(e => console.error(e));
});

// ─── Automated Background Scheduler ───────────────────────────────────────────
const reportingService = require('./src/services/reporting.service');
setTimeout(() => {
  if (process.env.NODE_ENV !== 'test') {
    reportingService.runDailyJobs()
      .then(res => console.log('[scheduler] Initial background daily jobs finished:', JSON.stringify(res)))
      .catch(err => console.error('[scheduler] Background daily jobs failed:', err.message));
  }
}, 5000); // Run once 5 seconds after boot

setInterval(() => {
  reportingService.runDailyJobs()
    .then(res => console.log('[scheduler] Recurring background daily jobs finished:', JSON.stringify(res)))
    .catch(err => console.error('[scheduler] Background daily jobs failed:', err.message));
}, 24 * 60 * 60 * 1000); // Run every 24 hours

module.exports = app;
