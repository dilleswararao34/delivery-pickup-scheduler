import React from 'react';
import {
  CheckCircle2, Circle, Clock, Truck, Package, MapPin, PhoneCall, User
} from 'lucide-react';
import './DeliveryTracker.css';

// ─── Lifecycle stages definition ──────────────────────────────────────────────
// Maps booking statuses to ordered delivery lifecycle steps.
// Not every booking will pass through all stages (e.g. DRAFT never appears here).
const TRACKING_STAGES = [
  {
    key: 'QUOTATION_REQUESTED',
    label: 'Quote Requested',
    description: 'Your rental request has been received and is under review.',
    icon: Package,
  },
  {
    key: 'CONFIRMED',
    label: 'Confirmed',
    description: 'Booking confirmed. Security deposit collected. Gear being prepared.',
    icon: CheckCircle2,
  },
  {
    key: 'OUT_FOR_DELIVERY',
    label: 'Out for Delivery',
    description: 'Your equipment is on its way to the delivery address.',
    icon: Truck,
  },
  {
    key: 'DELIVERED',
    label: 'Delivered',
    description: 'Equipment delivered. Your rental period has started.',
    icon: MapPin,
  },
  {
    key: 'AWAITING_PICKUP',
    label: 'Awaiting Pickup',
    description: 'Rental period complete. Our driver is collecting the gear.',
    icon: Clock,
  },
  {
    key: 'PICKED_UP_AND_RETURNED',
    label: 'Returned',
    description: 'Equipment returned to depot. Deposit will be refunded within 24–48 hrs.',
    icon: CheckCircle2,
  },
];

// Statuses that should not appear in tracking (pre-tracking states)
const PRE_TRACKING_STATUSES = new Set(['DRAFT']);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTimestamp(ts) {
  if (!ts) return null;
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(ts));
  } catch {
    return null;
  }
}

function formatDate(ts) {
  if (!ts) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(ts));
  } catch {
    return '—';
  }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DeliveryTracker({ booking }) {
  if (!booking) return null;

  const currentStatus = booking.status;

  // Don't render tracker for pre-tracking statuses
  if (PRE_TRACKING_STATUSES.has(currentStatus)) {
    return (
      <div className="tracker-pending">
        <Package size={24} className="tracker-pending__icon" />
        <div>
          <div className="tracker-pending__title">Awaiting Confirmation</div>
          <div className="tracker-pending__sub">
            Your quotation request is being reviewed by the SD Digitals team.
            Tracking will appear once your booking is confirmed.
          </div>
        </div>
      </div>
    );
  }

  // Build a map of status → timestamp from status_history
  const statusTimestamps = {};
  if (booking.status_history && Array.isArray(booking.status_history)) {
    for (const entry of booking.status_history) {
      if (entry.to_status && entry.changed_at) {
        // Keep the earliest timestamp for each status (first time it was set)
        if (!statusTimestamps[entry.to_status]) {
          statusTimestamps[entry.to_status] = entry.changed_at;
        }
      }
    }
  }

  // Determine which stage index is current
  const currentStageIndex = TRACKING_STAGES.findIndex((s) => s.key === currentStatus);
  // If status is not in our tracking stages (e.g. CANCELLATION_REQUESTED, ARCHIVED),
  // show a special state
  const isSpecialStatus = currentStageIndex === -1;

  const ops = booking.operations_log;
  const hasDriverInfo = ops && ops.driver_assigned;
  const showDriverCard =
    hasDriverInfo &&
    ['CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'AWAITING_PICKUP', 'PICKED_UP_AND_RETURNED'].includes(currentStatus);

  return (
    <div className="delivery-tracker">
      {/* ── Scheduled window ─────────────────────────────────────────────── */}
      <div className="tracker-schedule">
        <div className="tracker-schedule__item">
          <Truck size={14} className="tracker-schedule__icon tracker-schedule__icon--delivery" />
          <div>
            <div className="tracker-schedule__label">Scheduled Delivery</div>
            <div className="tracker-schedule__value">{formatDate(booking.scheduled_delivery_date)}</div>
          </div>
        </div>
        <div className="tracker-schedule__divider" />
        <div className="tracker-schedule__item">
          <Package size={14} className="tracker-schedule__icon tracker-schedule__icon--return" />
          <div>
            <div className="tracker-schedule__label">Scheduled Return</div>
            <div className="tracker-schedule__value">{formatDate(booking.scheduled_return_date)}</div>
          </div>
        </div>
      </div>

      {/* ── Special status (cancelled / archived) ────────────────────────── */}
      {isSpecialStatus && (
        <div className={`tracker-special tracker-special--${currentStatus.toLowerCase().replace(/_/g, '-')}`}>
          <Circle size={16} />
          <span>Booking status: <strong>{currentStatus.replace(/_/g, ' ')}</strong></span>
        </div>
      )}

      {/* ── Stage stepper ─────────────────────────────────────────────────── */}
      {!isSpecialStatus && (
        <div className="tracker-stepper" role="list" aria-label="Delivery tracking stages">
          {TRACKING_STAGES.map((stage, idx) => {
            const isCompleted = currentStageIndex > idx;
            const isCurrent   = currentStageIndex === idx;
            const isPending   = currentStageIndex < idx;
            const timestamp   = statusTimestamps[stage.key];
            const Icon        = stage.icon;

            let stateClass = 'tracker-step--pending';
            if (isCompleted) stateClass = 'tracker-step--completed';
            if (isCurrent)   stateClass = 'tracker-step--current';

            return (
              <div
                key={stage.key}
                className={`tracker-step ${stateClass}`}
                role="listitem"
                aria-current={isCurrent ? 'step' : undefined}
              >
                {/* Connector line (not on first item) */}
                {idx > 0 && (
                  <div className={`tracker-connector ${isCompleted || isCurrent ? 'tracker-connector--done' : ''}`} />
                )}

                {/* Icon node */}
                <div className="tracker-step__node">
                  {isCompleted ? (
                    <CheckCircle2 size={18} className="tracker-step__check" />
                  ) : isCurrent ? (
                    <div className="tracker-step__current-dot">
                      <Icon size={14} />
                    </div>
                  ) : (
                    <div className="tracker-step__pending-dot" />
                  )}
                </div>

                {/* Label + timestamp */}
                <div className="tracker-step__content">
                  <div className="tracker-step__label">{stage.label}</div>
                  {isCurrent && (
                    <div className="tracker-step__desc">{stage.description}</div>
                  )}
                  {(isCompleted || isCurrent) && timestamp && (
                    <div className="tracker-step__time">{formatTimestamp(timestamp)}</div>
                  )}
                  {isPending && (
                    <div className="tracker-step__time tracker-step__time--pending">Pending</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Driver card (shown once a driver is assigned) ────────────────── */}
      {showDriverCard && (
        <div className="tracker-driver-card">
          <div className="tracker-driver-card__header">
            <User size={14} className="tracker-driver-card__icon" />
            <span>Your Delivery Driver</span>
          </div>
          <div className="tracker-driver-card__body">
            <div className="tracker-driver-card__name">{ops.driver_assigned}</div>
            {ops.driver_phone && (
              <a
                href={`tel:${ops.driver_phone}`}
                className="tracker-driver-card__phone"
                aria-label={`Call driver ${ops.driver_assigned}`}
              >
                <PhoneCall size={12} />
                {ops.driver_phone}
              </a>
            )}
            {ops.vehicle_id && (
              <div className="tracker-driver-card__vehicle">
                Vehicle: <strong>{ops.vehicle_id}</strong>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
