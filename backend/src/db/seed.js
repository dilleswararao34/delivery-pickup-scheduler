'use strict';

require('dotenv').config();

const { Pool }  = require('pg');
const { v4: uuidv4 } = require('uuid');
const bcrypt    = require('bcryptjs');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'sd_digitals_scheduler',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// ─── Equipment Seed Data ──────────────────────────────────────────────────────

const EQUIPMENT = [
  { serial_number: 'SNY-FX3-0041',  name: 'Sony FX3 Cinema Rig',                  category: 'Cinema Camera',  brand: 'Sony',              model_number: 'ILME-FX3',    rental_rate_per_day: 8000.00,  replacement_value: 350000.00, status: 'AVAILABLE'     },
  { serial_number: 'DJI-RS3P-0087', name: 'DJI Ronin RS3 Pro Gimbal',             category: 'Stabilizer',     brand: 'DJI',               model_number: 'RS 3 Pro',    rental_rate_per_day: 2500.00,  replacement_value: 75000.00,  status: 'AVAILABLE'     },
  { serial_number: 'APT-600D-0023', name: 'Aputure 600d Light Storm',             category: 'Lighting',       brand: 'Aputure',           model_number: 'LS 600d Pro', rental_rate_per_day: 4500.00,  replacement_value: 150000.00, status: 'OUT_ON_HIRE'   },
  { serial_number: 'ZEN-V3-0012',   name: 'Zhiyun WEEBILL-3S Gimbal',             category: 'Stabilizer',     brand: 'Zhiyun',            model_number: 'WEEBILL-3S',  rental_rate_per_day: 1500.00,  replacement_value: 35000.00,  status: 'AVAILABLE'     },
  { serial_number: 'BMD-PCC6K-009', name: 'Blackmagic Pocket Cinema Camera 6K G2',category: 'Cinema Camera',  brand: 'Blackmagic Design', model_number: 'BMPCC6KG2',   rental_rate_per_day: 6500.00,  replacement_value: 180000.00, status: 'IN_MAINTENANCE'},
  { serial_number: 'RDE-NTG5-0055', name: 'Rode NTG5 Shotgun Microphone Kit',     category: 'Audio',          brand: 'Rode',              model_number: 'NTG5 Kit',    rental_rate_per_day: 1200.00,  replacement_value: 45000.00,  status: 'AVAILABLE'     },
  { serial_number: 'APT-120D-0031', name: 'Aputure NOVA P120c RGBWW Panel',       category: 'Lighting',       brand: 'Aputure',           model_number: 'NOVA P120c',  rental_rate_per_day: 3500.00,  replacement_value: 100000.00, status: 'RESERVED'      },
  { serial_number: 'DJI-M3E-0018',  name: 'DJI Mavic 3 Enterprise Drone Kit',     category: 'Drone / Aerial', brand: 'DJI',               model_number: 'Mavic 3E',    rental_rate_per_day: 10000.00, replacement_value: 500000.00, status: 'AVAILABLE'     },
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('[seed] Beginning seed transaction...');
    await client.query('BEGIN');
    
    // (Truncate removed so this script is safe to run on every startup)

    // ── Equipment ────────────────────────────────────────────────────────────
    const equipmentIds = {};
    for (const eq of EQUIPMENT) {
      const res = await client.query(
        `INSERT INTO equipment (serial_number, name, category, brand, model_number, rental_rate_per_day, replacement_value, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (serial_number) DO UPDATE SET name=EXCLUDED.name, status=EXCLUDED.status
         RETURNING id, name`,
        [eq.serial_number, eq.name, eq.category, eq.brand, eq.model_number, eq.rental_rate_per_day, eq.replacement_value, eq.status]
      );
      equipmentIds[eq.name] = res.rows[0].id;
      console.log(`[seed]   equipment: ${eq.name} → ${res.rows[0].id}`);
    }

    // ── Auth Users ─────────────────────────────────────────────────────────────
    const adminEmail = process.env.MAIN_ADMIN_EMAIL || 'admin@sddigitals.com';
    const adminPassword = process.env.MAIN_ADMIN_PASSWORD || 'Admin@1234';
    const adminHash = await bcrypt.hash(adminPassword, 12);
    
    await client.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, 'ADMIN')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [adminEmail.toLowerCase().trim(), adminHash, 'Main Admin']
    );
    console.log(`[seed]   user: ${adminEmail} (ADMIN)`);

    await client.query('COMMIT');
    console.log('[seed] ✅ Production-safe seed data committed successfully.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed] ❌ Seed failed, rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
