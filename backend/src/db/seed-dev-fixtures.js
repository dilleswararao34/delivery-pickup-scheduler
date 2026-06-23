'use strict';

require('dotenv').config();

const { Pool }  = require('pg');
const bcrypt    = require('bcryptjs');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'sd_digitals_scheduler',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function seedDevFixtures() {
  const client = await pool.connect();
  try {
    console.log('[seed-dev-fixtures] Beginning development fixtures seed...');
    await client.query('BEGIN');

    // Retrieve equipment mapping
    const eqRes = await client.query('SELECT id, name FROM equipment');
    const equipmentIds = {};
    for (const r of eqRes.rows) {
      equipmentIds[r.name] = r.id;
    }

    if (eqRes.rows.length === 0) {
      console.warn('[seed-dev-fixtures] Warning: No equipment found in the database. Please run npm run seed first.');
    }

    // ── Customers ────────────────────────────────────────────────────────────
    const customers = [
      { name: 'Priya Mehta',  email: 'priya@luminaryfilms.in', phone: '+919876543210', company: 'Luminary Films Pvt Ltd' },
      { name: 'Arjun Reddy',  email: 'arjun@redframe.io',       phone: '+919123456789', company: 'RedFrame Studios'       },
      { name: 'Sneha Nair',   email: 'sneha@cloudninemedia.in', phone: '+918845671234', company: 'CloudNine Media'        },
      { name: 'Vikram Iyer',  email: 'vikram@indieshoot.co',    phone: '+919967123456', company: 'IndieShoot Collective'  },
    ];
    const customerIds = {};
    for (const c of customers) {
      const existing = await client.query('SELECT id FROM customers WHERE email=$1', [c.email]);
      if (existing.rows.length > 0) {
        customerIds[c.name] = existing.rows[0].id;
      } else {
        const res = await client.query(
          `INSERT INTO customers (name, email, phone, company)
           VALUES ($1,$2,$3,$4)
           RETURNING id`,
          [c.name, c.email, c.phone, c.company]
        );
        customerIds[c.name] = res.rows[0].id;
      }
      console.log(`[seed-dev-fixtures]   customer: ${c.name} → ${customerIds[c.name]}`);
    }

    const now = new Date();
    const d = (offset) => new Date(now.getTime() + offset * 86400000).toISOString();

    // ── Bookings ─────────────────────────────────────────────────────────────
    const bookings = [
      {
        customer: 'Priya Mehta', status: 'OUT_FOR_DELIVERY',
        creator: { operator_name: 'Dilleswara Rao', operator_email: 'ops@sddigitals.in' },
        location: { delivery_address: '14, Banjara Hills, Film Nagar, Hyderabad, Telangana 500034', delivery_lat: 17.4123, delivery_lng: 78.4531, site_contact_name: 'Priya Mehta', site_contact_phone: '+919876543210' },
        delivery: d(0), return: d(3),
        equipment: ['Sony FX3 Cinema Rig', 'DJI Ronin RS3 Pro Gimbal', 'Rode NTG5 Shotgun Microphone Kit'],
        notes: 'Feature film shoot. Handle with extreme care. Fragile Zeiss lenses in transit.',
        driver: { driver_assigned: 'Ravi Kumar', driver_phone: '+919988776655', vehicle_id: 'TS09EA1234', scheduled_pickup_time: d(0), operational_status: 'EN_ROUTE_DELIVERY' },
      },
      {
        customer: 'Arjun Reddy', status: 'CONFIRMED',
        creator: { operator_name: 'Dilleswara Rao', operator_email: 'ops@sddigitals.in' },
        location: { delivery_address: '88B, Jubilee Hills Check Post, Hyderabad 500033', delivery_lat: 17.4291, delivery_lng: 78.4050 },
        delivery: d(2), return: d(5),
        equipment: ['Blackmagic Pocket Cinema Camera 6K G2', 'Aputure NOVA P120c RGBWW Panel'],
        notes: 'Corporate brand video shoot. Client requires full kit check before dispatch.',
        driver: null,
      },
      {
        customer: 'Sneha Nair', status: 'AWAITING_PICKUP',
        creator: { operator_name: 'Kavitha Sharma', operator_email: 'kavitha@sddigitals.in' },
        location: { delivery_address: 'Plot 7, HITEC City, Madhapur, Hyderabad 500081', delivery_lat: 17.4474, delivery_lng: 78.3762 },
        delivery: d(-3), return: d(0),
        equipment: ['Aputure 600d Light Storm', 'DJI Mavic 3 Enterprise Drone Kit'],
        notes: 'Aerial & lighting package for real estate promotional shoot.',
        driver: { driver_assigned: 'Suresh Babu', driver_phone: '+919977665544', vehicle_id: 'TS07EC5678', scheduled_return_time: d(0), operational_status: 'AWAITING_COLLECTION' },
      },
      {
        customer: 'Vikram Iyer', status: 'DRAFT',
        creator: { operator_name: 'Kavitha Sharma', operator_email: 'kavitha@sddigitals.in' },
        location: { delivery_address: '22, Banjara Hills Road No. 12, Hyderabad 500034' },
        delivery: d(7), return: d(10),
        equipment: ['Sony FX3 Cinema Rig'],
        notes: 'Short film project. Awaiting director confirmation before proceeding to quotation.',
        driver: null,
      },
    ];

    let refCounter = 1;
    for (const b of bookings) {
      const bookingRef = `SD-${now.getFullYear()}-${String(refCounter++).padStart(5, '0')}`;
      
      // Prevent inserting duplicate booking ref if script is run again
      const existingBooking = await client.query('SELECT id FROM bookings WHERE booking_ref = $1', [bookingRef]);
      let bookingId;
      if (existingBooking.rows.length > 0) {
        bookingId = existingBooking.rows[0].id;
      } else {
        const res = await client.query(
          `INSERT INTO bookings (booking_ref, customer_id, creator_details, location, status, scheduled_delivery_date, scheduled_return_date, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING id`,
          [bookingRef, customerIds[b.customer], JSON.stringify(b.creator), JSON.stringify(b.location), b.status, b.delivery, b.return, b.notes]
        );
        bookingId = res.rows[0].id;
      }

      // Link equipment
      for (const eqName of b.equipment) {
        if (equipmentIds[eqName]) {
          await client.query(
            'INSERT INTO booking_equipment (booking_id, equipment_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [bookingId, equipmentIds[eqName]]
          );
        }
      }

      // Operations log
      const opsData = b.driver || {};
      await client.query(
        `INSERT INTO operations_logs (booking_id, driver_assigned, driver_phone, vehicle_id, scheduled_pickup_time, scheduled_return_time, operational_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (booking_id) DO NOTHING`,
        [bookingId, opsData.driver_assigned || null, opsData.driver_phone || null, opsData.vehicle_id || null, opsData.scheduled_pickup_time || null, opsData.scheduled_return_time || null, opsData.operational_status || 'PENDING_DISPATCH']
      );

      // Initial status history
      const historyCheck = await client.query('SELECT id FROM booking_status_history WHERE booking_id = $1', [bookingId]);
      if (historyCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO booking_status_history (booking_id, from_status, to_status, changed_by, reason)
           VALUES ($1, NULL, $2, $3, $4)`,
          [bookingId, b.status, b.creator.operator_name, 'Initial booking creation']
        );
      }

      console.log(`[seed-dev-fixtures]   booking: ${bookingRef} (${b.status}) → ${bookingId}`);
    }

    // ── Sync booking_ref_seq so real bookings don't collide with fixtures ──────
    // nextval('booking_ref_seq') starts at 1 by default. After inserting fixtures
    // with hardcoded refs like SD-2026-00004, the sequence is still at 1, so the
    // very first real booking would generate SD-YYYY-00001 and hit a UNIQUE error.
    // This advances the sequence to match the highest suffix already in the table.
    await client.query(`
      SELECT setval(
        'booking_ref_seq',
        GREATEST(
          (SELECT COALESCE(MAX(CAST(SUBSTRING(booking_ref FROM '[0-9]+$') AS INTEGER)), 0)
           FROM bookings),
          1
        )
      )
    `);
    console.log('[seed-dev-fixtures]   booking_ref_seq synced to max existing suffix.');

    // ── System Alerts ─────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO system_alerts (related_entity, trigger_type, priority, message, payload)
       VALUES
         ('booking:SD-2026-00003', 'OVERDUE_RETURN',    'CRITICAL', 'Equipment overdue: Aputure 600d Light Storm and DJI Mavic 3E have exceeded return window. Contact Sneha Nair immediately.', '{"hours_overdue": 4}'::jsonb),
         ('booking:SD-2026-00002', 'DRIVER_UNASSIGNED', 'HIGH',     'Booking SD-2026-00002 (Arjun Reddy) is CONFIRMED but no driver has been assigned. Delivery in 2 days.', '{}'::jsonb),
         ('equipment:BMD-PCC6K-009', 'MAINTENANCE_FLAG','MEDIUM',   'Blackmagic Pocket Cinema Camera 6K G2 (BMD-PCC6K-009) has a pending maintenance flag. Clear before next allocation.', '{"last_serviced": null}'::jsonb)
       ON CONFLICT DO NOTHING`
    );

    // ── Demo Customer Account ──────────────────────────────────────────────────
    // Create a demo customer user for test portal access (priya@luminaryfilms.in)
    const priyaCheck = await client.query("SELECT * FROM users WHERE email = 'priya@luminaryfilms.in'");
    if (priyaCheck.rows.length === 0) {
      const customerHash = await bcrypt.hash('Customer@1234', 12);
      await client.query(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES ($1, $2, $3, 'CUSTOMER')`,
        ['priya@luminaryfilms.in', customerHash, 'Priya Mehta']
      );
      console.log('[seed-dev-fixtures]   demo customer user seeded: priya@luminaryfilms.in');
    }

    await client.query('COMMIT');
    console.log('[seed-dev-fixtures] ✅ Development fixtures seeded successfully.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed-dev-fixtures] ❌ Seed dev fixtures failed, rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDevFixtures();
