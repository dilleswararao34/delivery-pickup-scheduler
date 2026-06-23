'use strict';

const { z } = require('zod');

// ─── Shared primitives ────────────────────────────────────────────────────────

const isoDatetime = z
  .string()
  .refine((v) => !isNaN(Date.parse(v)), { message: 'Must be a valid ISO-8601 datetime string' });

const uuidString = z
  .string()
  .uuid({ message: 'Must be a valid UUID' });

const e164Phone = z
  .string()
  .min(7)
  .max(20)
  .refine((v) => /^\+?[\d\s\-().]{7,20}$/.test(v), {
    message: 'Must be a valid phone number',
  });

// ─── POST /api/v1/bookings ────────────────────────────────────────────────────

const createBookingSchema = z.object({
  customer: z.object({
    name:    z.string().min(1).max(120),
    email:   z.string().email(),
    phone:   e164Phone,
    company: z.string().max(100).optional(),
  }),
  creator: z.object({
    operator_name:  z.string().min(1).max(120),
    operator_email: z.string().email(),
  }),
  equipment_ids: z.array(uuidString).min(1, { message: 'At least one equipment item is required' }),
  location: z.object({
    delivery_address:   z.string().min(1).max(300),
    delivery_lat:       z.number().min(-90).max(90).optional(),
    delivery_lng:       z.number().min(-180).max(180).optional(),
    site_contact_name:  z.string().max(120).optional(),
    site_contact_phone: z.string().max(20).optional(),
  }),
  scheduled_delivery_date: isoDatetime,
  scheduled_return_date:   isoDatetime,
  notes: z.string().max(1000).optional(),
});

// ─── PUT /api/v1/bookings/:id/status ─────────────────────────────────────────

const VALID_STATUSES = [
  'DRAFT',
  'QUOTATION_REQUESTED',
  'CONFIRMED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'AWAITING_PICKUP',
  'PICKED_UP_AND_RETURNED',
  'ARCHIVED',
  'CANCELLATION_REQUESTED',
];

const updateStatusSchema = z.object({
  new_status: z.enum(VALID_STATUSES, {
    errorMap: () => ({ message: `new_status must be one of: ${VALID_STATUSES.join(', ')}` }),
  }),
  changed_by: z.string().min(1).max(255).optional(),
  reason:     z.string().max(500).optional(),
  operations_update: z.object({
    driver_assigned:       z.string().max(120).optional(),
    driver_phone:          z.string().max(20).optional(),
    vehicle_id:            z.string().max(50).optional(),
    scheduled_pickup_time: isoDatetime.optional(),
    scheduled_return_time: isoDatetime.optional(),
    dispatch_notes:        z.string().max(1000).optional(),
  }).optional(),
});

// ─── GET /api/v1/bookings (query params) ─────────────────────────────────────

const listBookingsQuerySchema = z.object({
  status:        z.string().optional(),
  date_from:     z.string().optional(),
  date_to:       z.string().optional(),
  owner:         z.string().optional(),
  customer_name: z.string().optional(),
  equipment_id:  z.string().optional(),
  page:          z.coerce.number().int().positive().default(1),
  limit:         z.coerce.number().int().positive().max(100).default(25),
  sort:          z.enum(['created_at', 'scheduled_delivery_date', 'status']).default('created_at'),
  order:         z.enum(['asc', 'desc']).default('desc'),
});

module.exports = {
  createBookingSchema,
  updateStatusSchema,
  listBookingsQuerySchema,
  VALID_STATUSES,
};
