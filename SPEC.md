# SD Digitals — Delivery & Pickup Scheduler
## Architectural Specification & Blueprint (SPEC.md)

> **Classification:** Internal Engineering Reference · Phase 1 Output  
> **Version:** 1.0.0  
> **Date:** 2026-06-15  
> **Authors:** Platform Engineering · SD Digitals  
> **Status:** PENDING ARCHITECTURAL REVIEW  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architectural Topology](#2-architectural-topology)
3. [RESTful API Contracts](#3-restful-api-contracts)
4. [Relational Data Architecture (PostgreSQL DDL)](#4-relational-data-architecture-postgresql-ddl)
5. [Workflow State Machine](#5-workflow-state-machine)
6. [Error Handling Contracts](#6-error-handling-contracts)
7. [Security & Headers](#7-security--headers)
8. [Frontend Component Topology](#8-frontend-component-topology)
9. [Seed Data Manifest](#9-seed-data-manifest)
10. [Phase 2 Execution Checklist](#10-phase-2-execution-checklist)

---

## 1. System Overview

SD Digitals operates a professional cinema equipment rental business. This scheduler manages the full operational lifecycle of hardware bookings — from initial intake and quotation through confirmed delivery, field tracking, and final pickup/return processing.

### Core Capabilities

| Domain | Scope |
|---|---|
| **Equipment Registry** | Catalog management, category taxonomy, rental rate computation |
| **Booking Lifecycle** | Multi-stage intake, operator assignments, customer communication |
| **Logistics Ops** | Driver dispatch, delivery/pickup scheduling, GPS location linking |
| **System Alerts Engine** | Rule-based notification dispatch, operational constraint surfacing |
| **Audit & Chronology** | Immutable operations log, status change history with actor attribution |

### Technology Selection

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18 + Vite | Fast HMR, tree-shaking, modular component architecture |
| Styling | Vanilla CSS (custom properties) | Zero-dependency, full design system control |
| Backend | Node.js 20 + Express 4 | Mature ecosystem, explicit middleware chain |
| Database | PostgreSQL 16 | ACID compliance, row-level security readiness, JSONB for payloads |
| ORM / Query | `pg` (node-postgres) with raw parameterized SQL | Avoids ORM abstraction leaks, production-safe |
| Validation | `zod` (backend schema) | TypeScript-first, composable, runtime-safe |
| Auth (future) | JWT via `jsonwebtoken` | Stateless, operator-identity ready |

---

## 2. Architectural Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SD Digitals Platform                        │
│                                                                     │
│   ┌─────────────────────────────┐    ┌──────────────────────────┐  │
│   │       FRONTEND (Vite/React) │    │    BACKEND (Express API)  │  │
│   │  /frontend                  │    │    /backend               │  │
│   │                             │    │                           │  │
│   │  ┌──────────────────────┐   │    │  ┌─────────────────────┐  │  │
│   │  │  Dashboard View      │   │◄──►│  │  Routes Layer       │  │  │
│   │  │  ├─ LiveLogisticsGrid│   │    │  │  /api/v1/...        │  │  │
│   │  │  ├─ IntakeCommand    │   │    │  └────────┬────────────┘  │  │
│   │  │  ├─ OpsAssistant     │   │    │           │               │  │
│   │  │  └─ DeepViewFlyout   │   │    │  ┌────────▼────────────┐  │  │
│   │  └──────────────────────┘   │    │  │  Controllers Layer  │  │  │
│   │                             │    │  │  (request parsing,  │  │  │
│   │  ┌──────────────────────┐   │    │  │   validation, auth) │  │  │
│   │  │  hooks/              │   │    │  └────────┬────────────┘  │  │
│   │  │  ├─ useBookings      │   │    │           │               │  │
│   │  │  ├─ useEquipment     │   │    │  ┌────────▼────────────┐  │  │
│   │  │  ├─ useAlerts        │   │    │  │  Services Layer     │  │  │
│   │  │  └─ useStateMachine  │   │    │  │  (business logic,   │  │  │
│   │  └──────────────────────┘   │    │  │   state machine)    │  │  │
│   │                             │    │  └────────┬────────────┘  │  │
│   │  ┌──────────────────────┐   │    │           │               │  │
│   │  │  services/apiClient  │   │    │  ┌────────▼────────────┐  │  │
│   │  └──────────────────────┘   │    │  │  Repository Layer   │  │  │
│   └─────────────────────────────┘    │  │  (SQL, pg pool)     │  │  │
│                                      │  └────────┬────────────┘  │  │
│                                      └───────────┼───────────────┘  │
│                                                  │                   │
│                                      ┌───────────▼───────────────┐  │
│                                      │  PostgreSQL 16 Database    │  │
│                                      │  ├─ equipment             │  │
│                                      │  ├─ customers             │  │
│                                      │  ├─ bookings              │  │
│                                      │  ├─ operations_logs       │  │
│                                      │  └─ system_alerts         │  │
│                                      └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Directory Tree Projection

```
sd-digitals-scheduler/
├── SPEC.md                          ← This document
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css                ← Design system tokens & global styles
│       ├── components/
│       │   ├── Dashboard/
│       │   │   ├── Dashboard.jsx
│       │   │   └── Dashboard.css
│       │   ├── LiveLogisticsGrid/
│       │   │   ├── LiveLogisticsGrid.jsx
│       │   │   ├── BookingRow.jsx
│       │   │   ├── StatusBadge.jsx
│       │   │   └── LiveLogisticsGrid.css
│       │   ├── IntakeCommand/
│       │   │   ├── IntakeCommand.jsx
│       │   │   ├── BookingForm.jsx
│       │   │   ├── QuotationForm.jsx
│       │   │   ├── DamageLogForm.jsx
│       │   │   └── IntakeCommand.css
│       │   ├── OpsAssistant/
│       │   │   ├── OpsAssistant.jsx
│       │   │   ├── AlertCard.jsx
│       │   │   └── OpsAssistant.css
│       │   ├── DeepViewFlyout/
│       │   │   ├── DeepViewFlyout.jsx
│       │   │   ├── OperationsChronology.jsx
│       │   │   ├── CustomerPanel.jsx
│       │   │   └── DeepViewFlyout.css
│       │   └── shared/
│       │       ├── SkeletonLoader.jsx
│       │       ├── EmptyState.jsx
│       │       ├── Topbar.jsx
│       │       └── shared.css
│       ├── hooks/
│       │   ├── useBookings.js
│       │   ├── useEquipment.js
│       │   ├── useAlerts.js
│       │   └── useStateMachine.js
│       ├── services/
│       │   └── apiClient.js
│       └── utils/
│           ├── statusColors.js
│           └── dateFormat.js
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── server.js                    ← Express bootstrap
│   └── src/
│       ├── config/
│       │   └── db.js                ← pg Pool configuration
│       ├── routes/
│       │   ├── bookings.routes.js
│       │   └── equipment.routes.js
│       ├── controllers/
│       │   ├── bookings.controller.js
│       │   └── equipment.controller.js
│       ├── services/
│       │   ├── bookings.service.js
│       │   ├── stateMachine.service.js
│       │   └── alerts.service.js
│       ├── repositories/
│       │   ├── bookings.repository.js
│       │   ├── equipment.repository.js
│       │   └── operationsLog.repository.js
│       ├── middleware/
│       │   ├── validate.js          ← Zod schema middleware
│       │   └── errorHandler.js
│       ├── schemas/
│       │   └── bookings.schema.js   ← Zod definitions
│       └── db/
│           ├── migrate.js           ← DDL runner
│           └── seed.js              ← Seed data script
```

---

## 3. RESTful API Contracts

### Global Request Headers

```
Content-Type: application/json
Accept: application/json
X-Request-ID: <uuid-v4>              (optional, echoed back in response)
Authorization: Bearer <token>        (reserved, currently open for prototype)
```

### Global Response Envelope

All endpoints return responses wrapped in a consistent envelope:

```json
{
  "success": true | false,
  "data": { ... } | [ ... ] | null,
  "meta": {
    "requestId": "string | null",
    "timestamp": "ISO-8601 string",
    "pagination": { ... } | null
  },
  "error": null | {
    "code": "ERROR_CODE_ENUM",
    "message": "Human-readable description",
    "fields": [ { "field": "string", "issue": "string" } ] | null
  }
}
```

---

### 3.1 POST `/api/v1/bookings`

**Purpose:** Create a new booking record. Triggers initial state assignment (`DRAFT`), creates an associated `operations_log` stub, and fires a system alert if equipment is already in a conflicting booking window.

#### Request Payload

```json
{
  "customer": {
    "name": "string (required, max 120)",
    "email": "string (required, valid email)",
    "phone": "string (required, E.164 format)",
    "company": "string (optional, max 100)"
  },
  "creator": {
    "operator_name": "string (required)",
    "operator_email": "string (required, valid email)"
  },
  "equipment_ids": ["uuid", "uuid"],
  "location": {
    "delivery_address": "string (required, max 300)",
    "delivery_lat": "number (optional, decimal degrees)",
    "delivery_lng": "number (optional, decimal degrees)",
    "site_contact_name": "string (optional)",
    "site_contact_phone": "string (optional)"
  },
  "scheduled_delivery_date": "ISO-8601 datetime (required)",
  "scheduled_return_date": "ISO-8601 datetime (required, must be > scheduled_delivery_date)",
  "notes": "string (optional, max 1000)"
}
```

#### Response — 201 Created

```json
{
  "success": true,
  "data": {
    "booking_id": "uuid",
    "booking_ref": "SD-2026-00042",
    "status": "DRAFT",
    "customer": { ... },
    "equipment": [ { "id": "uuid", "name": "string", "serial_number": "string" } ],
    "location": { ... },
    "scheduled_delivery_date": "ISO-8601",
    "scheduled_return_date": "ISO-8601",
    "created_at": "ISO-8601",
    "updated_at": "ISO-8601"
  },
  "meta": { "requestId": "...", "timestamp": "..." },
  "error": null
}
```

#### Error Codes

| HTTP Status | Error Code | Trigger Condition |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing required fields, malformed email/phone/datetime |
| 409 | `EQUIPMENT_CONFLICT` | One or more equipment IDs have overlapping active bookings |
| 422 | `INVALID_DATE_RANGE` | `scheduled_return_date` ≤ `scheduled_delivery_date` |
| 500 | `DATABASE_ERROR` | Unhandled persistence failure |

---

### 3.2 GET `/api/v1/bookings`

**Purpose:** Return a paginated, filterable list of all bookings with joined equipment summary and latest status.

#### Query Parameters

| Parameter | Type | Description |
|---|---|---|
| `status` | `string (enum)` | Filter by booking status (pipe-delimited: `DRAFT\|CONFIRMED`) |
| `date_from` | `ISO-8601 date` | Filter bookings with delivery date ≥ this value |
| `date_to` | `ISO-8601 date` | Filter bookings with delivery date ≤ this value |
| `owner` | `string` | Filter by `creator.operator_email` (exact match) |
| `customer_name` | `string` | Partial ILIKE match against customer name |
| `equipment_id` | `uuid` | Filter bookings containing a specific equipment item |
| `page` | `integer (default: 1)` | Pagination page index |
| `limit` | `integer (default: 25, max: 100)` | Items per page |
| `sort` | `string (default: created_at)` | Sort field: `created_at`, `scheduled_delivery_date`, `status` |
| `order` | `asc \| desc (default: desc)` | Sort direction |

#### Response — 200 OK

```json
{
  "success": true,
  "data": [
    {
      "booking_id": "uuid",
      "booking_ref": "SD-2026-00042",
      "status": "CONFIRMED",
      "customer_name": "string",
      "customer_email": "string",
      "equipment_count": 3,
      "equipment_preview": ["Sony FX3 Cinema Rig", "DJI Ronin RS3 Pro"],
      "delivery_address_short": "string",
      "scheduled_delivery_date": "ISO-8601",
      "scheduled_return_date": "ISO-8601",
      "driver_assigned": "string | null",
      "created_at": "ISO-8601"
    }
  ],
  "meta": {
    "requestId": "...",
    "timestamp": "...",
    "pagination": {
      "page": 1,
      "limit": 25,
      "total_records": 142,
      "total_pages": 6
    }
  },
  "error": null
}
```

---

### 3.3 GET `/api/v1/bookings/:id`

**Purpose:** Full entity resolution. Returns the complete booking object joined with all equipment details, full operations log chronology, customer contact, and active system alerts.

#### Path Parameters

| Parameter | Type | Required |
|---|---|---|
| `id` | `uuid` | Yes |

#### Response — 200 OK

```json
{
  "success": true,
  "data": {
    "booking_id": "uuid",
    "booking_ref": "SD-2026-00042",
    "status": "OUT_FOR_DELIVERY",
    "customer": {
      "name": "string",
      "email": "string",
      "phone": "string",
      "company": "string | null"
    },
    "creator": {
      "operator_name": "string",
      "operator_email": "string"
    },
    "equipment": [
      {
        "id": "uuid",
        "serial_number": "string",
        "name": "string",
        "category": "string",
        "rental_rate_per_day": "number",
        "status": "string"
      }
    ],
    "location": {
      "delivery_address": "string",
      "delivery_lat": "number | null",
      "delivery_lng": "number | null",
      "site_contact_name": "string | null",
      "site_contact_phone": "string | null"
    },
    "scheduled_delivery_date": "ISO-8601",
    "scheduled_return_date": "ISO-8601",
    "notes": "string | null",
    "operations_log": {
      "log_id": "uuid",
      "driver_assigned": "string | null",
      "driver_phone": "string | null",
      "vehicle_id": "string | null",
      "scheduled_pickup_time": "ISO-8601 | null",
      "scheduled_return_time": "ISO-8601 | null",
      "actual_delivery_time": "ISO-8601 | null",
      "actual_return_time": "ISO-8601 | null",
      "operational_status": "string",
      "dispatch_notes": "string | null"
    },
    "status_history": [
      {
        "from_status": "DRAFT",
        "to_status": "QUOTATION_REQUESTED",
        "changed_by": "string",
        "changed_at": "ISO-8601",
        "reason": "string | null"
      }
    ],
    "active_alerts": [
      {
        "alert_id": "uuid",
        "trigger_type": "string",
        "priority": "LOW | MEDIUM | HIGH | CRITICAL",
        "message": "string",
        "created_at": "ISO-8601"
      }
    ],
    "created_at": "ISO-8601",
    "updated_at": "ISO-8601"
  },
  "meta": { "requestId": "...", "timestamp": "..." },
  "error": null
}
```

#### Error Codes

| HTTP Status | Error Code | Trigger Condition |
|---|---|---|
| 400 | `INVALID_ID_FORMAT` | `:id` is not a valid UUID |
| 404 | `BOOKING_NOT_FOUND` | No record found for given UUID |
| 500 | `DATABASE_ERROR` | Unhandled persistence failure |

---

### 3.4 PUT `/api/v1/bookings/:id/status`

**Purpose:** Execute a validated state machine transition. Records the change in `status_history`, updates `operations_log`, and optionally triggers a system alert.

#### Request Payload

```json
{
  "new_status": "CONFIRMED",
  "changed_by": "string (required — operator name or email)",
  "reason": "string (optional, max 500)",
  "operations_update": {
    "driver_assigned": "string (optional)",
    "driver_phone": "string (optional)",
    "vehicle_id": "string (optional)",
    "scheduled_pickup_time": "ISO-8601 (optional)",
    "scheduled_return_time": "ISO-8601 (optional)",
    "dispatch_notes": "string (optional)"
  }
}
```

#### Response — 200 OK

```json
{
  "success": true,
  "data": {
    "booking_id": "uuid",
    "booking_ref": "string",
    "previous_status": "QUOTATION_REQUESTED",
    "current_status": "CONFIRMED",
    "changed_by": "string",
    "changed_at": "ISO-8601",
    "operations_log": { ... }
  },
  "meta": { "requestId": "...", "timestamp": "..." },
  "error": null
}
```

#### Error Codes

| HTTP Status | Error Code | Trigger Condition |
|---|---|---|
| 400 | `INVALID_TRANSITION` | Attempted status jump violates state machine rules |
| 400 | `VALIDATION_ERROR` | `new_status` not a valid enum value |
| 404 | `BOOKING_NOT_FOUND` | Booking ID does not exist |
| 422 | `MISSING_REQUIRED_FOR_TRANSITION` | E.g., transitioning to `OUT_FOR_DELIVERY` without a driver assigned |
| 500 | `DATABASE_ERROR` | Unhandled persistence failure |

---

## 4. Relational Data Architecture (PostgreSQL DDL)

### Design Principles

- **UUIDs** as primary keys (`gen_random_uuid()` — native PostgreSQL 13+).
- **`TIMESTAMPTZ`** for all datetime columns to enforce UTC-awareness.
- **Partial indexes** on high-cardinality filter columns (`status`, `created_at`).
- **`JSONB`** for semi-structured payload columns (alert payloads, creator details) to avoid schema rigidity while maintaining queryability.
- **Enum types** declared at the DB level to enforce categorical integrity.
- **Cascade rules** defined deliberately — logs are retained if bookings are soft-deleted.

---

### 4.1 Enum Type Definitions

```sql
-- Booking lifecycle states
CREATE TYPE booking_status AS ENUM (
  'DRAFT',
  'QUOTATION_REQUESTED',
  'CONFIRMED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'AWAITING_PICKUP',
  'PICKED_UP_AND_RETURNED',
  'ARCHIVED'
);

-- Equipment availability states
CREATE TYPE equipment_status AS ENUM (
  'AVAILABLE',
  'RESERVED',
  'OUT_ON_HIRE',
  'IN_MAINTENANCE',
  'RETIRED'
);

-- Alert priority tiers
CREATE TYPE alert_priority AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

-- Operations status granularity
CREATE TYPE operational_status AS ENUM (
  'PENDING_DISPATCH',
  'DRIVER_ASSIGNED',
  'EN_ROUTE_DELIVERY',
  'EQUIPMENT_DELIVERED',
  'AWAITING_COLLECTION',
  'EN_ROUTE_RETURN',
  'RETURNED_TO_DEPOT',
  'COMPLETED'
);
```

---

### 4.2 Customers Table

```sql
CREATE TABLE customers (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(120)  NOT NULL,
  email             VARCHAR(255)  NOT NULL,
  phone             VARCHAR(20)   NOT NULL,
  company           VARCHAR(100),
  billing_address   TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT customers_email_format CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$')
);

CREATE INDEX idx_customers_email ON customers (email);
CREATE INDEX idx_customers_name_search ON customers USING gin(to_tsvector('english', name));
```

---

### 4.3 Equipment Table

```sql
CREATE TABLE equipment (
  id                 UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number      VARCHAR(100)      NOT NULL UNIQUE,
  name               VARCHAR(200)      NOT NULL,
  category           VARCHAR(100)      NOT NULL,
  brand              VARCHAR(100),
  model_number       VARCHAR(100),
  description        TEXT,
  status             equipment_status  NOT NULL DEFAULT 'AVAILABLE',
  rental_rate_per_day NUMERIC(10, 2)   NOT NULL CHECK (rental_rate_per_day >= 0),
  replacement_value  NUMERIC(12, 2),
  image_url          TEXT,
  acquired_at        DATE,
  last_serviced_at   DATE,
  notes              TEXT,
  created_at         TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_equipment_status ON equipment (status);
CREATE INDEX idx_equipment_category ON equipment (category);
CREATE INDEX idx_equipment_serial ON equipment (serial_number);
CREATE INDEX idx_equipment_name_search ON equipment USING gin(to_tsvector('english', name));
```

---

### 4.4 Bookings Table

```sql
CREATE TABLE bookings (
  id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref             VARCHAR(20)     NOT NULL UNIQUE,
  customer_id             UUID            NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  creator_details         JSONB           NOT NULL,
  -- creator_details shape: { operator_name, operator_email }
  location                JSONB           NOT NULL,
  -- location shape: { delivery_address, delivery_lat, delivery_lng,
  --                   site_contact_name, site_contact_phone }
  status                  booking_status  NOT NULL DEFAULT 'DRAFT',
  scheduled_delivery_date TIMESTAMPTZ     NOT NULL,
  scheduled_return_date   TIMESTAMPTZ     NOT NULL,
  notes                   TEXT,
  is_deleted              BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT bookings_date_range CHECK (scheduled_return_date > scheduled_delivery_date)
);

-- Junction table: bookings x equipment (many-to-many)
CREATE TABLE booking_equipment (
  booking_id   UUID  NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  equipment_id UUID  NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (booking_id, equipment_id)
);

CREATE INDEX idx_bookings_status ON bookings (status) WHERE is_deleted = FALSE;
CREATE INDEX idx_bookings_customer ON bookings (customer_id);
CREATE INDEX idx_bookings_delivery_date ON bookings (scheduled_delivery_date);
CREATE INDEX idx_bookings_created_at ON bookings (created_at DESC);
CREATE INDEX idx_booking_equipment_equipment ON booking_equipment (equipment_id);

-- Auto-generate booking reference
CREATE SEQUENCE booking_ref_seq START 1;

CREATE OR REPLACE FUNCTION generate_booking_ref()
RETURNS TRIGGER AS $$
BEGIN
  NEW.booking_ref := 'SD-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('booking_ref_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_booking_ref
BEFORE INSERT ON bookings
FOR EACH ROW
WHEN (NEW.booking_ref IS NULL OR NEW.booking_ref = '')
EXECUTE FUNCTION generate_booking_ref();
```

---

### 4.5 Operations Logs Table

```sql
CREATE TABLE operations_logs (
  id                     UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id             UUID               NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  driver_assigned        VARCHAR(120),
  driver_phone           VARCHAR(20),
  vehicle_id             VARCHAR(50),
  scheduled_pickup_time  TIMESTAMPTZ,
  scheduled_return_time  TIMESTAMPTZ,
  actual_delivery_time   TIMESTAMPTZ,
  actual_return_time     TIMESTAMPTZ,
  operational_status     operational_status NOT NULL DEFAULT 'PENDING_DISPATCH',
  dispatch_notes         TEXT,
  created_at             TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

  CONSTRAINT ops_one_per_booking UNIQUE (booking_id)
);

-- Status change history (immutable append-only)
CREATE TABLE booking_status_history (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID          NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  from_status booking_status,
  to_status   booking_status NOT NULL,
  changed_by  VARCHAR(255)  NOT NULL,
  reason      TEXT,
  changed_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ops_logs_booking ON operations_logs (booking_id);
CREATE INDEX idx_status_history_booking ON booking_status_history (booking_id, changed_at DESC);
```

---

### 4.6 System Alerts Table

```sql
CREATE TABLE system_alerts (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  related_entity    VARCHAR(100)  NOT NULL,
  -- e.g., 'booking:uuid', 'equipment:uuid', 'driver:name'
  trigger_type      VARCHAR(100)  NOT NULL,
  -- e.g., 'EQUIPMENT_CONFLICT', 'OVERDUE_RETURN', 'DRIVER_UNASSIGNED'
  priority          alert_priority NOT NULL DEFAULT 'MEDIUM',
  message           TEXT          NOT NULL,
  payload           JSONB,
  -- Arbitrary structured context for the alert
  dispatched_status BOOLEAN       NOT NULL DEFAULT FALSE,
  resolved_at       TIMESTAMPTZ,
  resolved_by       VARCHAR(255),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_dispatched ON system_alerts (dispatched_status, priority, created_at DESC);
CREATE INDEX idx_alerts_entity ON system_alerts (related_entity);
CREATE INDEX idx_alerts_trigger ON system_alerts (trigger_type);
```

---

### 4.7 Updated-At Trigger (Shared)

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bookings_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_equipment_updated_at
BEFORE UPDATE ON equipment
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_ops_logs_updated_at
BEFORE UPDATE ON operations_logs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## 5. Workflow State Machine

### Booking Lifecycle States

```
 ┌──────────────────────────────────────────────────────────────────────┐
 │                    SD DIGITALS — BOOKING STATE MACHINE               │
 │                                                                      │
 │   INITIAL                                                            │
 │     │                                                                │
 │     ▼                                                                │
 │  [DRAFT] ──────────────────────────────────────────────┐            │
 │     │                                                  │            │
 │     │ Customer confirms intent / operator accepts      │            │
 │     ▼                                                  │ (cancel)   │
 │  [QUOTATION_REQUESTED]                                 │            │
 │     │                                                  │            │
 │     │ Pricing agreed, deposit received                 │            │
 │     ▼                                                  │            │
 │  [CONFIRMED]                                           │            │
 │     │                                                  │            │
 │     │ Driver assigned, equipment loaded, departed      │            │
 │     ▼                                                  │            │
 │  [OUT_FOR_DELIVERY]                                    │            │
 │     │                                                  │            │
 │     │ Delivery confirmed on-site                       │            │
 │     ▼                                                  │            │
 │  [DELIVERED]                                           │            │
 │     │                                                  │            │
 │     │ Hire period complete, ready to collect           │            │
 │     ▼                                                  │            │
 │  [AWAITING_PICKUP]                                     │            │
 │     │                                                  │            │
 │     │ Equipment retrieved, returned to depot           │            │
 │     ▼                                                  │            │
 │  [PICKED_UP_AND_RETURNED]                              │            │
 │     │                                                  │            │
 │     │ Invoice settled, records closed                  │            │
 │     ▼                                                  │            │
 │  [ARCHIVED] ◄──────────────────────────────────────────┘            │
 │                                                                      │
 └──────────────────────────────────────────────────────────────────────┘
```

### 5.1 Allowed Transition Matrix

| From Status | Allowed Next Status(es) | Forbidden Jumps (examples) |
|---|---|---|
| `DRAFT` | `QUOTATION_REQUESTED`, `ARCHIVED` | → `CONFIRMED`, `DELIVERED` |
| `QUOTATION_REQUESTED` | `CONFIRMED`, `DRAFT`, `ARCHIVED` | → `OUT_FOR_DELIVERY` |
| `CONFIRMED` | `OUT_FOR_DELIVERY`, `ARCHIVED` | → `DELIVERED`, `AWAITING_PICKUP` |
| `OUT_FOR_DELIVERY` | `DELIVERED` | → `AWAITING_PICKUP`, `ARCHIVED` |
| `DELIVERED` | `AWAITING_PICKUP` | → `PICKED_UP_AND_RETURNED` |
| `AWAITING_PICKUP` | `PICKED_UP_AND_RETURNED` | → `ARCHIVED` directly |
| `PICKED_UP_AND_RETURNED` | `ARCHIVED` | → Any backward state |
| `ARCHIVED` | *(terminal — no transitions)* | All |

### 5.2 Transition Guard Rules (Business Logic)

```javascript
// Enforced in stateMachine.service.js

const TRANSITION_GUARDS = {
  OUT_FOR_DELIVERY: (booking, opsLog) => {
    if (!opsLog.driver_assigned) {
      throw new Error('MISSING_REQUIRED_FOR_TRANSITION: Driver must be assigned before dispatch.');
    }
    if (!opsLog.scheduled_pickup_time) {
      throw new Error('MISSING_REQUIRED_FOR_TRANSITION: Pickup time must be scheduled.');
    }
  },
  DELIVERED: (booking, opsLog) => {
    // Auto-stamp actual delivery time if not already set
    if (!opsLog.actual_delivery_time) {
      opsLog.actual_delivery_time = new Date().toISOString();
    }
  },
  PICKED_UP_AND_RETURNED: (booking, opsLog) => {
    if (!opsLog.actual_return_time) {
      opsLog.actual_return_time = new Date().toISOString();
    }
    // Side effect: mark all associated equipment back to AVAILABLE
    // Side effect: trigger RETURN_COMPLETED alert for damage assessment queue
  }
};
```

### 5.3 Illegal Transition Response

```json
HTTP 400 Bad Request

{
  "success": false,
  "data": null,
  "meta": { "timestamp": "ISO-8601" },
  "error": {
    "code": "INVALID_TRANSITION",
    "message": "Cannot transition booking SD-2026-00042 from 'DELIVERED' to 'CONFIRMED'. This transition is not permitted by the workflow state machine.",
    "fields": null
  }
}
```

---

## 6. Error Handling Contracts

### HTTP Status Code Reference

| Code | Semantic | Usage |
|---|---|---|
| `200` | OK | Successful GET / PUT |
| `201` | Created | Successful POST |
| `400` | Bad Request | Validation failure, illegal state transition |
| `404` | Not Found | Entity does not exist |
| `409` | Conflict | Duplicate resource, equipment scheduling conflict |
| `422` | Unprocessable Entity | Semantically invalid request (date range, missing guards) |
| `500` | Internal Server Error | Unhandled exceptions, DB connection failure |

### Standard Error Code Enum

```
VALIDATION_ERROR
INVALID_ID_FORMAT
BOOKING_NOT_FOUND
EQUIPMENT_NOT_FOUND
EQUIPMENT_CONFLICT
INVALID_DATE_RANGE
INVALID_TRANSITION
MISSING_REQUIRED_FOR_TRANSITION
DATABASE_ERROR
INTERNAL_SERVER_ERROR
```

### Global Error Handler Middleware

```javascript
// middleware/errorHandler.js
// Catches all thrown errors, formats envelope, logs structured output
module.exports = (err, req, res, next) => {
  const status = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  console.error(JSON.stringify({
    level: 'error',
    code,
    message: err.message,
    requestId: req.headers['x-request-id'],
    path: req.path,
    timestamp: new Date().toISOString()
  }));

  res.status(status).json({
    success: false,
    data: null,
    meta: {
      requestId: req.headers['x-request-id'] || null,
      timestamp: new Date().toISOString(),
      pagination: null
    },
    error: {
      code,
      message: err.message,
      fields: err.fields || null
    }
  });
};
```

---

## 7. Security & Headers

### CORS Configuration

```javascript
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  credentials: true
};
```

### Helmet Security Headers

```javascript
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
```

### Request Size Limits

```javascript
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
```

---

## 8. Frontend Component Topology

### Design System Token Reference

```css
/* Core Design System Tokens — index.css */
:root {
  --color-bg-primary:      #0d1117;   /* Deep charcoal canvas */
  --color-bg-secondary:    #161b22;   /* Elevated surface */
  --color-bg-tertiary:     #1c2128;   /* Card / panel background */
  --color-border:          #30363d;   /* Subtle divider */
  --color-border-active:   #58a6ff;   /* Focus ring / active state */

  --color-accent-amber:    #f0a500;   /* Operational / warning accent */
  --color-accent-cyan:     #00d2c6;   /* Active / success accent */
  --color-accent-red:      #f85149;   /* Error / critical alert */
  --color-accent-purple:   #8b5cf6;   /* AI / assistant accent */
  --color-accent-blue:     #58a6ff;   /* Confirmed / active */
  --color-accent-green:    #3fb950;   /* Delivered / returned */

  --color-text-primary:    #e6edf3;   /* Main body copy */
  --color-text-secondary:  #8b949e;   /* Muted / metadata */
  --color-text-tertiary:   #484f58;   /* Disabled / placeholder */

  --font-primary:          'Inter', system-ui, sans-serif;
  --font-mono:             'JetBrains Mono', 'Fira Code', monospace;

  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;

  --shadow-card: 0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2);
  --transition:  all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Status Badge Color Map

| Status | Background | Text | Border |
|---|---|---|---|
| `DRAFT` | `rgba(139,148,158,0.12)` | `#8b949e` | `#30363d` |
| `QUOTATION_REQUESTED` | `rgba(240,165,0,0.12)` | `#f0a500` | `#f0a500` |
| `CONFIRMED` | `rgba(88,166,255,0.12)` | `#58a6ff` | `#58a6ff` |
| `OUT_FOR_DELIVERY` | `rgba(0,210,198,0.12)` | `#00d2c6` | `#00d2c6` |
| `DELIVERED` | `rgba(63,185,80,0.12)` | `#3fb950` | `#3fb950` |
| `AWAITING_PICKUP` | `rgba(240,165,0,0.15)` | `#f0a500` | `#f0a500` |
| `PICKED_UP_AND_RETURNED` | `rgba(63,185,80,0.15)` | `#3fb950` | `#3fb950` |
| `ARCHIVED` | `rgba(72,79,88,0.12)` | `#484f58` | `#484f58` |

### Dashboard Layout Grid

```
┌─────────────────────────────────────────────────────────────────────┐
│  TOPBAR: SD Digitals Ops — Logo | Date | Operator | Alert Bell     │
├─────────────────────────────────┬───────────────────────────────────┤
│                                 │                                   │
│   LIVE LOGISTICS GRID           │   OPS ASSISTANT SIDEBAR           │
│   (filterable table)            │   (alerts + constraints)          │
│                                 │                                   │
│   Columns:                      │   ┌─────────────────────────┐    │
│   - Ref # | Customer | Status   │   │ CRITICAL: Overdue return │    │
│   - Equipment | Driver | ETA    │   │ from Priya Mehta (FX3)   │    │
│   - Delivery Date | Actions     │   └─────────────────────────┘    │
│                                 │                                   │
│   [skeleton on load]            │   ┌─────────────────────────┐    │
│   [empty state if no data]      │   │ HIGH: Driver unassigned  │    │
│                                 │   │ for SD-2026-00038        │    │
├─────────────────────────────────┤   └─────────────────────────┘    │
│                                 │                                   │
│   INTAKE COMMAND PANEL          │   Workflow Optimization Tips     │
│   Mode: [Booking][Quote][Damage]│                                   │
│                                 │                                   │
│   Context-aware multi-mode form │                                   │
│                                 │                                   │
└─────────────────────────────────┴───────────────────────────────────┘

DEEP VIEW FLYOUT: slides in from right edge on row click (z-index overlay)
Contains: Entity header | Equipment list | Ops log | Status history timeline
```

---

## 9. Seed Data Manifest

### Equipment Seed Records (8 items)

| Name | Category | Serial | Rate/Day | Status |
|---|---|---|---|---|
| Sony FX3 Cinema Rig | Cinema Camera | SNY-FX3-0041 | £185.00 | AVAILABLE |
| DJI Ronin RS3 Pro Gimbal | Stabilizer | DJI-RS3P-0087 | £65.00 | AVAILABLE |
| Aputure 600d Light Storm | Lighting | APT-600D-0023 | £120.00 | OUT_ON_HIRE |
| Zhiyun WEEBILL-3S Gimbal | Stabilizer | ZEN-V3-0012 | £45.00 | AVAILABLE |
| Blackmagic Pocket Cinema 6K G2 | Cinema Camera | BMD-PCC6K-0009 | £145.00 | IN_MAINTENANCE |
| Rode NTG5 Shotgun Mic Kit | Audio | RDE-NTG5-0055 | £35.00 | AVAILABLE |
| Aputure NOVA P120c RGBWW Panel | Lighting | APT-120D-0031 | £95.00 | RESERVED |
| DJI Mavic 3 Enterprise Drone Kit | Drone / Aerial | DJI-M3E-0018 | £250.00 | AVAILABLE |

### Sample Booking Seed Records (4 items across lifecycle stages)

| Customer | Company | Status | Equipment | Driver |
|---|---|---|---|---|
| Priya Mehta | Luminary Films Pvt Ltd | OUT_FOR_DELIVERY | FX3, Ronin RS3, Rode NTG5 | Ravi Kumar |
| Arjun Reddy | RedFrame Studios | CONFIRMED | BMPCC6K, Nova P120c | (unassigned) |
| Sneha Nair | CloudNine Media | AWAITING_PICKUP | 600d, Mavic 3E | Suresh Babu |
| Vikram Iyer | IndieShoot Collective | DRAFT | FX3 | (unassigned) |

---

## 10. Phase 2 Execution Checklist

### Backend
- [ ] Express server bootstrap with CORS, Helmet, JSON parser
- [ ] pg Pool configuration with `.env` binding
- [ ] DDL migration runner (creates all tables and enum types)
- [ ] Seed script (populates equipment and sample bookings)
- [ ] Zod validation schemas for all request bodies
- [ ] Bookings repository (all CRUD queries)
- [ ] Equipment repository (list, get, status update)
- [ ] Operations Log repository (upsert, join)
- [ ] State machine service (transition matrix enforcement)
- [ ] Alerts service (conflict detection, overdue detection)
- [ ] Bookings controller (POST, GET list, GET id, PUT status)
- [ ] Error handler middleware
- [ ] Route registration

### Frontend
- [ ] Vite + React project scaffold
- [ ] Design system CSS (`index.css` with all tokens)
- [ ] `apiClient.js` service layer
- [ ] `useBookings` hook (fetch, create, update status)
- [ ] `useEquipment` hook
- [ ] `useAlerts` hook
- [ ] `useStateMachine` hook (allowed transitions)
- [ ] Topbar component
- [ ] StatusBadge component (all 8 states)
- [ ] SkeletonLoader component
- [ ] EmptyState component
- [ ] LiveLogisticsGrid view
- [ ] IntakeCommand panel (3 modes: booking, quotation, damage)
- [ ] OpsAssistant sidebar
- [ ] DeepViewFlyout slide panel
- [ ] Dashboard layout assembly
- [ ] Responsive breakpoints

---

> **PHASE 1 COMPLETE** — SPEC.md is ready for architectural inspection.  
> Proceed to Phase 2 only after explicit sign-off on this document.

*End of original SPEC.md — SD Digitals Platform Engineering*

---

## 11. Role-Based Authentication Matrix (Add-On v1.1)

### 11.1 User Role Taxonomy

| Role | Portal | Access Scope |
|---|---|---|
| `ADMIN` | `/admin` — Internal Logistics Dashboard | Full booking CRUD, state machine transitions, driver dispatch, alert management, equipment registry, business rule configurations |
| `CUSTOMER` | `/customer` — External Rental Portal | Own booking history, equipment catalog browsing, quotation requests, damage/return logging |

### 11.2 Users Table DDL

```sql
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'ADMIN');

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
```

### 11.3 JWT Token Schema

```json
{
  "userId": "uuid",
  "email":  "string",
  "name":   "string",
  "role":   "ADMIN | CUSTOMER",
  "iat":    1234567890,
  "exp":    1234567890
}
```

- **Algorithm:** HS256
- **Expiry:** 8 hours (`8h`)
- **Storage:** `localStorage` (prototype) — upgrade to `httpOnly` cookie for production
- **Secret:** `JWT_SECRET` environment variable

### 11.4 Auth API Contracts

| Method | Endpoint | Auth | Role | Purpose |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/login` | None | Any | Validate credentials, return JWT |
| `POST` | `/api/v1/auth/logout` | None | Any | Client-side token disposal |
| `GET` | `/api/v1/auth/me` | Bearer JWT | Any | Return current user from token |
| `GET` | `/api/v1/bookings` | Bearer JWT | ADMIN / CUSTOMER | List bookings (CUSTOMER-scoped in future) |
| `POST` | `/api/v1/bookings` | Bearer JWT | ADMIN | Create booking |
| `PUT` | `/api/v1/bookings/:id/status` | Bearer JWT | ADMIN | State machine transition |
| `GET` | `/api/v1/equipment` | Bearer JWT | ADMIN / CUSTOMER | Equipment catalog |

### 11.5 Middleware Chain

```
Request
  │
  ├─ CORS + Helmet (global)
  ├─ requestId injection (global)
  ├─ /api/v1/auth/* → authRouter (NO auth middleware)
  │
  └─ /api/v1/bookings/*  → authMiddleware → requireRole('ADMIN','CUSTOMER') → bookingsRouter
     /api/v1/equipment/* → authMiddleware → equipmentRouter
```

**`authMiddleware`** (`src/middleware/auth.middleware.js`):
- Extracts `Authorization: Bearer <token>`
- Verifies with `jsonwebtoken.verify(token, JWT_SECRET)`
- Attaches `req.user = { userId, role, email, name }`
- Returns `401 UNAUTHORIZED` on missing/expired/invalid token

**`requireRole()`** (`src/middleware/requireRole.js`):
- Factory function: `requireRole('ADMIN')` or `requireRole('ADMIN', 'CUSTOMER')`
- Returns `403 FORBIDDEN` if `req.user.role` not in allowed set

### 11.6 Frontend Auth Architecture

```
AuthProvider (context/AuthContext.jsx)
  │  { token, user, login(), logout(), isAdmin, isCustomer, isAuth }
  │  └─ Persists to localStorage (TOKEN_KEY + USER_KEY)
  │
  ├─ /login → <LoginPage>
  │     Unified gateway with two role tabs:
  │     ┌───────────────────┐  ┌──────────────────┐
  │     │  🎬 Customer Portal │  │  ⚡ Admin Dashboard │
  │     └───────────────────┘  └──────────────────┘
  │     POST /api/v1/auth/login → on success:
  │       ADMIN    → navigate('/admin')
  │       CUSTOMER → navigate('/customer')
  │
  ├─ /admin/* → <ProtectedRoute role="ADMIN"> → <Dashboard>
  │     Role mismatch (CUSTOMER) → redirect to /customer
  │
  └─ /customer/* → <ProtectedRoute role="CUSTOMER"> → <CustomerPortal>
        Role mismatch (ADMIN) → redirect to /admin
```

### 11.7 Demo Credentials (Seeded)

| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@sddigitals.com` | `Admin@1234` |
| CUSTOMER | `customer@demo.com` | `Demo@1234` |

---

## 12. SPA Routing Architecture (Add-On v1.1)

### 12.1 Technology

| Concern | Library | Version |
|---|---|---|
| Client-side routing | `react-router-dom` | `^6.23` |
| Page transitions | `framer-motion` — `AnimatePresence` | `^11` |
| HTTP client | `axios` with interceptors | `^1.7` |

### 12.2 Route Tree

```
BrowserRouter
  └─ AnimatePresence (mode="wait")
      ├─ /login             → <LoginPage>              (Public)
      ├─ /admin/*           → <ProtectedRoute role="ADMIN">
      │                         └─ <Dashboard>         (Admin only)
      │     /admin/equipment    → Equipment registry panel
      │     /admin/alerts       → Alert management panel
      ├─ /customer/*        → <ProtectedRoute role="CUSTOMER">
      │                         └─ <CustomerPortal>    (Customer only)
      │     /customer/browse    → Equipment catalog
      │     /customer/quote     → Quotation request form
      ├─ /                  → Auto-redirect based on auth state
      └─ *                  → Fallback → /
```

### 12.3 Navigation Component

`NavBar.jsx` renders role-aware navigation links:

- **ADMIN links:** Dashboard · Equipment · Alerts
- **CUSTOMER links:** My Bookings · Browse Gear · Request Quote

NavLink `active` state uses CSS `border-bottom: 2px solid var(--cyan)` indicator.

Mobile collapse: hamburger at `<768px` → slide-down drawer with all links.

### 12.4 Axios Client Configuration

```javascript
const http = axios.create({ baseURL: '/api/v1', timeout: 15000 });

// Request interceptor: inject JWT
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('sd_digitals_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Response interceptor: handle auth failures
http.interceptors.response.use(
  (res) => res.data,                         // Unwrap envelope
  (error) => {
    if (error.response?.status === 401) {    // Auto-logout on token expiry
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

**Mock mode:** `USE_MOCK = true` in `apiClient.js` bypasses Axios and returns in-memory mock data. Switch to `false` when PostgreSQL is running.

---

## 13. Animation & Integration Guidelines (Add-On v1.1)

### 13.1 Framer Motion Variant Library

All shared variants are defined in `src/utils/motionVariants.js`:

| Variant | Applied To | Effect |
|---|---|---|
| `pageTransition` | Every page (`/login`, `/admin`, `/customer`) | Fade + 14px upward slide on enter; fade + -10px on exit |
| `staggerContainer` | `<motion.tbody>`, Stats Bar | Staggers children by 60ms |
| `cardEntrance` | `<BookingRow>`, `<CustomerPortal>` cards | Fade up from 16px below |
| `statChipPop` | Stat chips in Dashboard | Scale from 0.85 + fade |
| `alertEntrance` | `<AlertCard>` | Fade in from 20px right |
| `flyoutSlide` | `<DeepViewFlyout>` | Slide from `x: 100%` to `x: 0` |
| `backdropFade` | Flyout backdrop | Opacity 0 → 1 |
| `loginCardEntrance` | Login card | Scale 0.97 + y:40 bounce in |
| `shakeError` | Login form errors | Horizontal shake (8-frame) |
| `navItemHover` | NavBar links | y: -1 on hover |
| `buttonTap` | All primary buttons | scale: 0.96 on tap |

### 13.2 Animation Principles

1. **Page transitions:** Always wrapped in `<AnimatePresence mode="wait">` in `App.jsx`.
2. **Stagger lists:** Parent uses `staggerContainer`, children use `cardEntrance`.
3. **Exit animations:** The `AnimatePresence` must wrap the conditional render, not just the animated element.
4. **Duration budget:** Enter ≤ 300ms · Exit ≤ 220ms · Micro-interactions ≤ 150ms.
5. **Easing:** `[0.22, 1, 0.36, 1]` (custom ease-out) for enters; `easeIn` for exits.

### 13.3 Responsive Breakpoint System

| Breakpoint | Width | Layout |
|---|---|---|
| Desktop | `>1200px` | 3-zone flexbox: left (grid + intake) + right (ops assistant) |
| Tablet | `768–1200px` | 2-zone: right panel narrows to 280px |
| Mobile | `<768px` | Single column: panels stack vertically; NavBar collapses to hamburger |
| XS | `<480px` | Stat chips go 2-per-row; flyout becomes full-screen modal |

All breakpoints are defined in `src/index.css` using `@media (max-width: Xpx)` blocks targeting existing BEM class names — no inline styles required.

### 13.4 Data-Driven State Guidelines

Every state-changing user action follows this pattern:

```
User Interaction
  → optimistic UI update (optional)
  → apiClient.createBooking(payload)   // Axios POST to backend
  → await response
  → update local state (useBookings hook)
  → display success toast / error alert
```

API error handling chain:
1. `axios` response interceptor catches 401 → auto-logout
2. `apiClient` rejects with structured `{ message, code, status }`
3. Component `catch` block sets error state → renders inline error or shake animation

---

> **SPEC v1.1 — Add-On Requirements Incorporated**  
> Authentication Matrix · SPA Routing · Animation System · Responsive Breakpoints  
> *SD Digitals Platform Engineering · 2026-06-15*

