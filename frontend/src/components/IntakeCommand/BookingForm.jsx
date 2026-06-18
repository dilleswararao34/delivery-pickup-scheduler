import React, { useState, useCallback } from 'react';
import { EQUIPMENT_STATUS_CONFIG } from '../../utils/statusColors.js';
import { formatCurrency } from '../../utils/dateFormat.js';
import './IntakeCommand.css';

const INITIAL_FORM = {
  customer_name:           '',
  customer_email:          '',
  customer_phone:          '',
  customer_company:        '',
  operator_name:           'Dilleswara Rao',
  operator_email:          'ops@sddigitals.in',
  delivery_address:        '',
  site_contact_name:       '',
  site_contact_phone:      '',
  scheduled_delivery_date: '',
  scheduled_return_date:   '',
  notes:                   '',
};

export default function BookingForm({ equipment, onSubmit, mode = 'booking' }) {
  const [form, setForm]               = useState(INITIAL_FORM);
  const [selectedEquipment, setSelEq] = useState([]);
  const [errors, setErrors]           = useState({});
  const [submitting, setSubmitting]   = useState(false);
  const [success, setSuccess]         = useState(null);

  const update = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  }, []);

  const toggleEquipment = useCallback((eq) => {
    if (eq.status !== 'AVAILABLE') return;
    setSelEq((prev) =>
      prev.some((e) => e.id === eq.id)
        ? prev.filter((e) => e.id !== eq.id)
        : [...prev, eq]
    );
  }, []);

  const validate = useCallback(() => {
    const errs = {};
    if (!form.customer_name.trim())           errs.customer_name           = 'Customer name is required';
    if (!form.customer_email.trim())           errs.customer_email          = 'Email is required';
    if (!form.customer_phone.trim())           errs.customer_phone          = 'Phone is required';
    if (!form.delivery_address.trim())         errs.delivery_address        = 'Delivery address is required';
    if (!form.scheduled_delivery_date)         errs.scheduled_delivery_date = 'Delivery date is required';
    if (!form.scheduled_return_date)           errs.scheduled_return_date   = 'Return date is required';
    if (selectedEquipment.length === 0)        errs.equipment               = 'Select at least one equipment item';
    if (form.scheduled_return_date && form.scheduled_delivery_date &&
        new Date(form.scheduled_return_date) <= new Date(form.scheduled_delivery_date)) {
      errs.scheduled_return_date = 'Return date must be after delivery date';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, selectedEquipment]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        customer: {
          name:    form.customer_name,
          email:   form.customer_email,
          phone:   form.customer_phone,
          company: form.customer_company || undefined,
        },
        creator: {
          operator_name:  form.operator_name,
          operator_email: form.operator_email,
        },
        equipment_ids: selectedEquipment.map((e) => e.id),
        location: {
          delivery_address:   form.delivery_address,
          site_contact_name:  form.site_contact_name  || undefined,
          site_contact_phone: form.site_contact_phone || undefined,
        },
        scheduled_delivery_date: new Date(form.scheduled_delivery_date).toISOString(),
        scheduled_return_date:   new Date(form.scheduled_return_date).toISOString(),
        notes: form.notes || undefined,
      };

      const result = await onSubmit(payload);
      setSuccess(result);
    } catch (err) {
      setErrors({ form: err.message || 'Submission failed. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }, [form, selectedEquipment, validate, onSubmit]);

  const handleReset = useCallback(() => {
    setForm(INITIAL_FORM);
    setSelEq([]);
    setErrors({});
    setSuccess(null);
  }, []);

  // ── Success state ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="intake__success">
        <div className="intake__success-icon">✅</div>
        <h3 className="intake__success-title">Booking Created</h3>
        <p className="intake__success-ref">{success.booking_ref}</p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
          Status set to <strong>DRAFT</strong>. The booking is ready for quotation.
        </p>
        <button id="intake-new-booking-btn" className="btn btn-primary" onClick={handleReset}>
          + New Booking
        </button>
      </div>
    );
  }

  return (
    <form id="booking-intake-form" onSubmit={handleSubmit} noValidate>
      {errors.form && <div className="form-error" role="alert">⚠ {errors.form}</div>}

      {/* Customer Details */}
      <div className="form-section">
        <div className="form-section-label">Customer Details</div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="customer_name">Full Name *</label>
            <input id="customer_name" type="text" value={form.customer_name}
              onChange={(e) => update('customer_name', e.target.value)}
              placeholder="Priya Mehta" aria-required="true"
              style={errors.customer_name ? { borderColor: 'var(--red)' } : {}} />
            {errors.customer_name && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--red)', marginTop: 2, display: 'block' }}>{errors.customer_name}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="customer_company">Company</label>
            <input id="customer_company" type="text" value={form.customer_company}
              onChange={(e) => update('customer_company', e.target.value)}
              placeholder="Luminary Films Pvt Ltd" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="customer_email">Email *</label>
            <input id="customer_email" type="email" value={form.customer_email}
              onChange={(e) => update('customer_email', e.target.value)}
              placeholder="priya@luminaryfilms.in" aria-required="true"
              style={errors.customer_email ? { borderColor: 'var(--red)' } : {}} />
            {errors.customer_email && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--red)', marginTop: 2, display: 'block' }}>{errors.customer_email}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="customer_phone">Phone *</label>
            <input id="customer_phone" type="tel" value={form.customer_phone}
              onChange={(e) => update('customer_phone', e.target.value)}
              placeholder="+91 98765 43210" aria-required="true"
              style={errors.customer_phone ? { borderColor: 'var(--red)' } : {}} />
            {errors.customer_phone && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--red)', marginTop: 2, display: 'block' }}>{errors.customer_phone}</span>}
          </div>
        </div>
      </div>

      {/* Delivery Location */}
      <div className="form-section">
        <div className="form-section-label">Delivery Location</div>
        <div className="form-group">
          <label htmlFor="delivery_address">Delivery Address *</label>
          <textarea id="delivery_address" value={form.delivery_address}
            onChange={(e) => update('delivery_address', e.target.value)}
            placeholder="14, Banjara Hills, Film Nagar, Hyderabad, Telangana 500034"
            style={{ minHeight: 60, ...(errors.delivery_address ? { borderColor: 'var(--red)' } : {}) }}
            aria-required="true" />
          {errors.delivery_address && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--red)', marginTop: 2, display: 'block' }}>{errors.delivery_address}</span>}
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="site_contact_name">Site Contact Name</label>
            <input id="site_contact_name" type="text" value={form.site_contact_name}
              onChange={(e) => update('site_contact_name', e.target.value)}
              placeholder="On-site representative" />
          </div>
          <div className="form-group">
            <label htmlFor="site_contact_phone">Site Contact Phone</label>
            <input id="site_contact_phone" type="tel" value={form.site_contact_phone}
              onChange={(e) => update('site_contact_phone', e.target.value)}
              placeholder="+91 …" />
          </div>
        </div>
      </div>

      {/* Schedule */}
      <div className="form-section">
        <div className="form-section-label">Hire Schedule</div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="scheduled_delivery_date">Delivery Date & Time *</label>
            <input id="scheduled_delivery_date" type="datetime-local" value={form.scheduled_delivery_date}
              onChange={(e) => update('scheduled_delivery_date', e.target.value)}
              aria-required="true"
              style={errors.scheduled_delivery_date ? { borderColor: 'var(--red)' } : {}} />
            {errors.scheduled_delivery_date && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--red)', marginTop: 2, display: 'block' }}>{errors.scheduled_delivery_date}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="scheduled_return_date">Return Date & Time *</label>
            <input id="scheduled_return_date" type="datetime-local" value={form.scheduled_return_date}
              onChange={(e) => update('scheduled_return_date', e.target.value)}
              aria-required="true"
              style={errors.scheduled_return_date ? { borderColor: 'var(--red)' } : {}} />
            {errors.scheduled_return_date && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--red)', marginTop: 2, display: 'block' }}>{errors.scheduled_return_date}</span>}
          </div>
        </div>
      </div>

      {/* Equipment selection */}
      <div className="form-section">
        <div className="form-section-label">Equipment Selection *</div>
        {errors.equipment && (
          <div className="form-error" style={{ marginBottom: 'var(--space-3)', padding: '8px 12px' }}>⚠ {errors.equipment}</div>
        )}
        <div className="equipment-picker" role="listbox" aria-label="Select equipment items" aria-multiselectable="true">
          {(equipment || []).map((eq) => {
            const selected = selectedEquipment.some((s) => s.id === eq.id);
            const cfg = EQUIPMENT_STATUS_CONFIG[eq.status];
            const unavailable = eq.status !== 'AVAILABLE';
            return (
              <div
                key={eq.id}
                className={`equipment-picker-item${selected ? ' equipment-picker-item--selected' : ''}${unavailable ? ' equipment-picker-item--disabled' : ''}`}
                role="option"
                aria-selected={selected}
                onClick={() => toggleEquipment(eq)}
              >
                <input type="checkbox" checked={selected} readOnly tabIndex={-1} />
                <span className="equipment-picker__name">{eq.name}</span>
                <span className="equipment-picker__meta">{formatCurrency(eq.rental_rate_per_day)}/day</span>
                <span className="equipment-picker__status" style={{ background: cfg?.bg, color: cfg?.color }}>
                  {cfg?.label || eq.status}
                </span>
              </div>
            );
          })}
        </div>
        {selectedEquipment.length > 0 && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--cyan)', marginTop: 'var(--space-2)' }}>
            {selectedEquipment.length} item{selectedEquipment.length > 1 ? 's' : ''} selected
          </p>
        )}
      </div>

      {/* Notes */}
      <div className="form-section">
        <div className="form-section-label">Operational Notes</div>
        <div className="form-group">
          <label htmlFor="booking_notes">Notes (optional)</label>
          <textarea id="booking_notes" value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Fragile equipment, special handling instructions, client access codes…"
            style={{ minHeight: 70 }} />
        </div>
      </div>
    </form>
  );
}
