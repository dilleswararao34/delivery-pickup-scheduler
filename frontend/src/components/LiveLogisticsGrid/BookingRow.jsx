import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, Truck } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import { formatDate, formatDateTime, isOverdue, isDueSoon } from '../../utils/dateFormat.js';
import { cardEntrance } from '../../utils/motionVariants.js';

export default function BookingRow({ booking, onClick, isSelected }) {
  const overdue  = booking.status === 'AWAITING_PICKUP' && isOverdue(booking.scheduled_return_date);
  const dueSoon  = booking.status === 'CONFIRMED' && isDueSoon(booking.scheduled_delivery_date);

  return (
    <motion.tr
      id={`booking-row-${booking.booking_id}`}
      className={`grid-row${isSelected ? ' grid-row--selected' : ''}${overdue ? ' grid-row--overdue' : ''}`}
      onClick={() => onClick(booking)}
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick(booking)}
      role="button"
      aria-label={`View booking ${booking.booking_ref} for ${booking.customer_name}`}
      style={{ cursor: 'pointer' }}
      variants={cardEntrance}
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)', transition: { duration: 0.1 } }}
      whileTap={{ scale: 0.995 }}
    >
      {/* Reference */}
      <td className="grid-cell grid-cell--ref">
        <div className="grid-ref">
          <span className="grid-ref__code">{booking.booking_ref}</span>
          {overdue  && <span className="grid-ref__flag grid-ref__flag--overdue"  title="Overdue return"><AlertTriangle size={12} /></span>}
          {dueSoon  && <span className="grid-ref__flag grid-ref__flag--due-soon" title="Due for delivery soon"><Clock size={12} /></span>}
        </div>
      </td>

      {/* Customer */}
      <td className="grid-cell">
        <div className="grid-customer">
          <div className="grid-customer__avatar" aria-hidden="true">
            {booking.customer_name.charAt(0).toUpperCase()}
          </div>
          <div className="grid-customer__info">
            <span className="grid-customer__name">{booking.customer_name}</span>
            {booking.customer_company && (
              <span className="grid-customer__company">{booking.customer_company}</span>
            )}
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="grid-cell">
        <StatusBadge status={booking.status} />
      </td>

      {/* Priority */}
      <td className="grid-cell">
        <span className={`priority-badge priority-badge--${booking.priority?.toLowerCase() || 'medium'}`} style={{ fontSize: '11px', fontWeight: 600 }}>
          {booking.priority || 'MEDIUM'}
        </span>
      </td>

      {/* Source */}
      <td className="grid-cell">
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          {booking.source || 'PORTAL'}
        </span>
      </td>

      {/* Owner */}
      <td className="grid-cell">
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
          {booking.assigned_owner || 'Dilleswara Rao'}
        </span>
      </td>

      {/* Equipment */}
      <td className="grid-cell grid-cell--equipment">
        <div className="grid-equipment">
          {(booking.equipment_preview || []).slice(0, 2).map((eq, i) => (
            <span key={i} className="grid-equipment__tag">{eq}</span>
          ))}
          {booking.equipment_count > 2 && (
            <span className="grid-equipment__more">+{booking.equipment_count - 2}</span>
          )}
        </div>
      </td>

      {/* Driver */}
      <td className="grid-cell">
        {booking.driver_assigned ? (
          <div className="grid-driver">
            <span className="grid-driver__icon" aria-hidden="true"><Truck size={14} /></span>
            <span className="grid-driver__name">{booking.driver_assigned}</span>
          </div>
        ) : (
          <span className="grid-unassigned">— Unassigned</span>
        )}
      </td>

      {/* Delivery Date */}
      <td className="grid-cell grid-cell--date">
        <div className="grid-date">
          <span className="grid-date__value">{formatDate(booking.scheduled_delivery_date)}</span>
          <span className="grid-date__label">→ {formatDate(booking.scheduled_return_date)}</span>
        </div>
      </td>

      {/* Action */}
      <td className="grid-cell grid-cell--action">
        <span className="grid-view-btn" aria-hidden="true">→</span>
      </td>
    </motion.tr>
  );
}
