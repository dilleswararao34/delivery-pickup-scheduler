'use strict';

require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'sd_digitals_scheduler',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

const DDL = `
-- ── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enum Types ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM (
    'DRAFT','QUOTATION_REQUESTED','CONFIRMED','OUT_FOR_DELIVERY',
    'DELIVERED','AWAITING_PICKUP','PICKED_UP_AND_RETURNED','ARCHIVED','CANCELLATION_REQUESTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE equipment_status AS ENUM (
    'AVAILABLE','RESERVED','OUT_ON_HIRE','IN_MAINTENANCE','RETIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_priority AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_source AS ENUM ('SYSTEM','OPERATOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_priority AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_source AS ENUM ('WEBSITE','PHONE','WALK_IN','PORTAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE operational_status AS ENUM (
    'PENDING_DISPATCH','DRIVER_ASSIGNED','EN_ROUTE_DELIVERY',
    'EQUIPMENT_DELIVERED','AWAITING_COLLECTION','EN_ROUTE_RETURN',
    'RETURNED_TO_DEPOT','COMPLETED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Customers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  phone           VARCHAR(20)  NOT NULL,
  company         VARCHAR(100),
  billing_address TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers (email);

-- ── Equipment ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment (
  id                  UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number       VARCHAR(100)     NOT NULL UNIQUE,
  name                VARCHAR(200)     NOT NULL,
  category            VARCHAR(100)     NOT NULL,
  brand               VARCHAR(100),
  model_number        VARCHAR(100),
  description         TEXT,
  status              equipment_status NOT NULL DEFAULT 'AVAILABLE',
  rental_rate_per_day NUMERIC(10,2)    NOT NULL DEFAULT 0 CHECK (rental_rate_per_day >= 0),
  replacement_value   NUMERIC(12,2),
  image_url           TEXT,
  acquired_at         DATE,
  last_serviced_at    DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_equipment_status   ON equipment (status);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment (category);

-- ── Sequence for booking refs ─────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS booking_ref_seq START 1;

-- ── Bookings ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id                      UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref             VARCHAR(20)      NOT NULL UNIQUE,
  customer_id             UUID             NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  creator_details         JSONB            NOT NULL,
  location                JSONB            NOT NULL,
  status                  booking_status   NOT NULL DEFAULT 'DRAFT',
  priority                booking_priority NOT NULL DEFAULT 'MEDIUM',
  source                  booking_source   NOT NULL DEFAULT 'PORTAL',
  assigned_owner          VARCHAR(120),
  scheduled_delivery_date TIMESTAMPTZ      NOT NULL,
  scheduled_return_date   TIMESTAMPTZ      NOT NULL,
  notes                   TEXT,
  is_deleted              BOOLEAN          NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT bookings_date_range CHECK (scheduled_return_date > scheduled_delivery_date)
);
CREATE INDEX IF NOT EXISTS idx_bookings_status        ON bookings (status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_bookings_customer      ON bookings (customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_delivery_date ON bookings (scheduled_delivery_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at    ON bookings (created_at DESC);

-- Alter bookings table to add new columns if they do not exist
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS priority booking_priority NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source booking_source NOT NULL DEFAULT 'PORTAL';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_owner VARCHAR(120);
ALTER TABLE bookings ALTER COLUMN assigned_owner DROP DEFAULT;

-- ── Booking-Equipment junction ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_equipment (
  booking_id   UUID NOT NULL REFERENCES bookings(id)   ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES equipment(id)  ON DELETE RESTRICT,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (booking_id, equipment_id)
);
CREATE INDEX IF NOT EXISTS idx_booking_equipment_eq ON booking_equipment (equipment_id);

-- ── Operations Logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operations_logs (
  id                    UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            UUID               NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  driver_assigned       VARCHAR(120),
  driver_phone          VARCHAR(20),
  vehicle_id            VARCHAR(50),
  scheduled_pickup_time TIMESTAMPTZ,
  scheduled_return_time TIMESTAMPTZ,
  actual_delivery_time  TIMESTAMPTZ,
  actual_return_time    TIMESTAMPTZ,
  operational_status    operational_status NOT NULL DEFAULT 'PENDING_DISPATCH',
  dispatch_notes        TEXT,
  created_at            TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  CONSTRAINT ops_one_per_booking UNIQUE (booking_id)
);
CREATE INDEX IF NOT EXISTS idx_ops_logs_booking ON operations_logs (booking_id);

-- ── Booking Status History ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_status_history (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID           NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  from_status booking_status,
  to_status   booking_status NOT NULL,
  changed_by  VARCHAR(255)   NOT NULL,
  reason      TEXT,
  changed_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_status_history_booking ON booking_status_history (booking_id, changed_at DESC);

-- ── System Alerts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_alerts (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  related_entity    VARCHAR(100)   NOT NULL,
  trigger_type      VARCHAR(100)   NOT NULL,
  priority          alert_priority NOT NULL DEFAULT 'MEDIUM',
  message           TEXT           NOT NULL,
  payload           JSONB,
  dispatched_status BOOLEAN        NOT NULL DEFAULT FALSE,
  resolved_at       TIMESTAMPTZ,
  resolved_by       VARCHAR(255),
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_dispatched ON system_alerts (dispatched_status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_entity     ON system_alerts (related_entity);

-- ── Invoices ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id           UUID          NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  invoice_ref          VARCHAR(50)   NOT NULL UNIQUE,
  amount_due           NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount_due >= 0),
  amount_paid          NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status               VARCHAR(30)   NOT NULL DEFAULT 'UNPAID',
  issued_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  due_at               TIMESTAMPTZ   NOT NULL,
  razorpay_order_id    VARCHAR(100),
  razorpay_payment_id  VARCHAR(100),
  razorpay_signature   VARCHAR(255),
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_booking ON invoices (booking_id);

-- ── Deposits ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deposits (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          UUID          NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount              NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status              VARCHAR(30)   NOT NULL DEFAULT 'PENDING',
  payment_method      VARCHAR(50),
  razorpay_order_id   VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  razorpay_refund_id  VARCHAR(100),
  held_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  released_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deposits_booking ON deposits (booking_id);

-- ── Damage Reports ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS damage_reports (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     UUID          NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  equipment_id   UUID          NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  reported_by    VARCHAR(255)  NOT NULL,
  description    TEXT          NOT NULL,
  estimated_cost NUMERIC(10,2) CHECK (estimated_cost >= 0),
  status         VARCHAR(30)   NOT NULL DEFAULT 'PENDING_REVIEW',
  reported_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_damage_reports_booking ON damage_reports (booking_id);
CREATE INDEX IF NOT EXISTS idx_damage_reports_equip   ON damage_reports (equipment_id);

-- ── Shared updated_at trigger ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bookings_updated_at  ON bookings;
DROP TRIGGER IF EXISTS trg_equipment_updated_at ON equipment;
DROP TRIGGER IF EXISTS trg_ops_logs_updated_at  ON operations_logs;
DROP TRIGGER IF EXISTS trg_invoices_updated_at  ON invoices;
DROP TRIGGER IF EXISTS trg_deposits_updated_at  ON deposits;
DROP TRIGGER IF EXISTS trg_damage_reports_updated_at ON damage_reports;

CREATE TRIGGER trg_bookings_updated_at  BEFORE UPDATE ON bookings        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_equipment_updated_at BEFORE UPDATE ON equipment       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_ops_logs_updated_at  BEFORE UPDATE ON operations_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_invoices_updated_at  BEFORE UPDATE ON invoices        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_deposits_updated_at  BEFORE UPDATE ON deposits        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_damage_reports_updated_at BEFORE UPDATE ON damage_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── User Role Enum ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('CUSTOMER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Users Table (Auth) ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  user_id       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  role          user_role    NOT NULL DEFAULT 'CUSTOMER',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Employee Activity/Audit Logs Table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_activity_logs (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  user_name   VARCHAR(120) NOT NULL,
  user_email  VARCHAR(255) NOT NULL,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id   VARCHAR(100),
  details     TEXT,
  timestamp   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON employee_activity_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON employee_activity_logs (timestamp DESC);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('[migrate] Starting database migration...');
    
    // Ensure user_role enum exists
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('CUSTOMER', 'ADMIN');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Ensure EMPLOYEE value is in user_role
    const enumCheck = await client.query(`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = 'user_role'::regtype AND enumlabel = 'EMPLOYEE'
    `);
    if (enumCheck.rows.length === 0) {
      console.log('[migrate] Adding EMPLOYEE to user_role enum...');
      await client.query("ALTER TYPE user_role ADD VALUE 'EMPLOYEE'");
    }

    // Ensure CANCELLATION_REQUESTED value is in booking_status
    const bookingStatusCheck = await client.query(`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = 'booking_status'::regtype AND enumlabel = 'CANCELLATION_REQUESTED'
    `);
    if (bookingStatusCheck.rows.length === 0) {
      console.log('[migrate] Adding CANCELLATION_REQUESTED to booking_status enum...');
      await client.query("ALTER TYPE booking_status ADD VALUE 'CANCELLATION_REQUESTED'");
    }

    await client.query(DDL);
    
    // Schema alterations for Razorpay columns on existing tables
    console.log('[migrate] Applying Razorpay database migrations...');
    await client.query(`
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100);
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100);
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR(255);
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'RAZORPAY';
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS razorpay_refund_id VARCHAR(100);

      ALTER TABLE deposits ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100);
      ALTER TABLE deposits ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100);
      ALTER TABLE deposits ADD COLUMN IF NOT EXISTS razorpay_refund_id VARCHAR(100);
      ALTER TABLE deposits ALTER COLUMN status SET DEFAULT 'PENDING';
    `);

    console.log('[migrate] ✅ All tables and indexes created/migrated successfully.');

    // Seed main admin if not present
    const adminCheck = await client.query("SELECT * FROM users WHERE role = 'ADMIN'");
    if (adminCheck.rows.length === 0) {
      const isProd = process.env.NODE_ENV === 'production';
      let email = process.env.MAIN_ADMIN_EMAIL;
      let password = process.env.MAIN_ADMIN_PASSWORD;

      if (!email || !password) {
        if (isProd) {
          throw new Error('MAIN_ADMIN_EMAIL and MAIN_ADMIN_PASSWORD environment variables are required to seed the main admin user, but they are not set.');
        } else {
          email = 'admin@sddigitals.com';
          password = 'Admin@1234';
        }
      }

      const name = 'Main Admin';
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash(password, 12);
      await client.query(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES ($1, $2, $3, 'ADMIN')`,
        [email.toLowerCase().trim(), hash, name]
      );
      console.log(`[migrate] Seeded main admin: ${email}`);
    }
  } catch (err) {
    console.error('[migrate] ❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();

