import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, Package, Sparkles, CreditCard, ShieldCheck, 
  RotateCcw, Clock, Download, DollarSign, Check, AlertTriangle,
  X, ChevronRight, ArrowRight, Loader2
} from 'lucide-react';
import StatusBadge from '../LiveLogisticsGrid/StatusBadge.jsx';
import { OperationsChronology } from './OperationsChronology.jsx';
import { SkeletonFlyout } from '../shared/SkeletonLoader.jsx';
import DeliveryTracker from '../DeliveryTracker/DeliveryTracker.jsx';
import { useBookingDetail } from '../../hooks/useBookings.js';
import { useStateMachine } from '../../hooks/useStateMachine.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatDate, formatDateTime, getDurationDays, formatCurrency } from '../../utils/dateFormat.js';
import { flyoutSlide, backdropFade, buttonTap } from '../../utils/motionVariants.js';
import apiClient from '../../services/apiClient.js';
import { useNavigate } from 'react-router-dom';
import './DeepViewFlyout.css';

export default function DeepViewFlyout({ bookingId, onClose, onStatusUpdate }) {
  const { booking, loading, error, refresh } = useBookingDetail(bookingId);
  const { getAllowedNext, getTransitionLabel } = useStateMachine();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const navigate = useNavigate();

  const [transitioning, setTransitioning] = useState(false);

  // Damage Report Form State
  const [showDamageForm, setShowDamageForm] = useState(false);
  const [damageEquipId, setDamageEquipId] = useState('');
  const [damageDesc, setDamageDesc] = useState('');
  const [damageCost, setDamageCost] = useState('');
  const [damageSubmitting, setDamageSubmitting] = useState(false);

  // Razorpay Payment & Refund States/Handlers
  const [payingId, setPayingId] = useState(null);
  const [refundingId, setRefundingId] = useState(null);

  // Quotation states & handlers
  const [quotation, setQuotation] = useState(null);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchQuotation = useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await apiClient.getQuotations();
      const q = res.data?.find(item => item.booking_id === bookingId);
      setQuotation(q || null);
    } catch (err) {
      console.error('Failed to fetch quotation for flyout:', err);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchQuotation();
  }, [fetchQuotation]);

  const handleAcceptQuote = async () => {
    if (!quotation) return;
    const latestVersion = quotation.versions?.[quotation.versions.length - 1];
    if (!latestVersion) return;

    const confirm = window.confirm("Are you sure you want to accept this quote? This will convert it into a confirmed booking invoice.");
    if (!confirm) return;

    setActionLoading(true);
    try {
      await apiClient.acceptQuote(quotation.id, latestVersion.id);
      alert("Quote accepted! A formal invoice has been generated.");
      await refresh();
      await fetchQuotation();
      if (onStatusUpdate) await onStatusUpdate();
    } catch (err) {
      alert(err.message || "Failed to accept quote.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!quotation) return;
    if (!revisionNotes.trim()) {
      alert("Please provide notes for the revision request.");
      return;
    }

    setActionLoading(true);
    try {
      await apiClient.requestRevision(quotation.id, revisionNotes);
      alert("Revision requested successfully. Our team will review and get back to you.");
      setRevisionNotes('');
      await refresh();
      await fetchQuotation();
      if (onStatusUpdate) await onStatusUpdate();
    } catch (err) {
      alert(err.message || "Failed to request revision.");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePay = async (type, item) => {
    setPayingId(item.id);
    try {
      const orderRes = await apiClient.createRazorpayOrder(type, item.id);
      const { order_id, amount, currency, key_id } = orderRes.data;

      const options = {
        key: key_id,
        amount: amount,
        currency: currency,
        name: 'SD Digitals',
        description: type === 'invoice' ? `Rental Payment ${item.invoice_ref}` : `Security Deposit Hold`,
        order_id: order_id,
        handler: async function (response) {
          try {
            await apiClient.verifyRazorpayPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              type: type,
              item_id: item.id
            });

            if (!isAdmin) {
              navigate('/customer/payment-success', { 
                state: { 
                  bookingRef: booking.reference_id, 
                  amountPaid: amount / 100, 
                  paymentMethod: 'RAZORPAY' 
                } 
              });
            } else {
              alert('Payment verified & processed successfully!');
              await refresh();
              if (onStatusUpdate) {
                await onStatusUpdate();
              }
            }
          } catch (err) {
            console.error(err);
            alert(`Payment verification failed: ${err.response?.data?.error?.message || err.message}`);
          }
        },
        prefill: {
          name: booking?.customer?.name || '',
          email: booking?.customer?.email || '',
          contact: booking?.customer?.phone || '',
        },
        theme: {
          color: '#0d1117',
        },
        modal: {
          ondismiss: function() {
            setPayingId(null);
          }
        }
      };

      if (!window.Razorpay) {
        alert('Razorpay Checkout SDK failed to load. Please check your network connection.');
        return;
      }

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      alert(`Payment initialization failed: ${err.message}`);
    } finally {
      setPayingId(null);
    }
  };

  const handleRefund = async (depositId) => {
    const confirmRefund = window.confirm('Are you sure you want to refund this security deposit?');
    if (!confirmRefund) return;
    setRefundingId(depositId);
    try {
      await apiClient.refundDeposit(depositId, 'Undamaged returned equipment release');
      alert('Security deposit refunded successfully!');
      await refresh();
      if (onStatusUpdate) {
        await onStatusUpdate();
      }
    } catch (err) {
      alert(`Refund failed: ${err.message}`);
    } finally {
      setRefundingId(null);
    }
  };

  const handleMarkInvoicePaid = async (invoiceId) => {
    const confirm = window.confirm('Manually mark this invoice as PAID?');
    if (!confirm) return;
    try {
      await apiClient.markInvoicePaid(invoiceId);
      alert('Invoice marked as paid.');
      await refresh();
      if (onStatusUpdate) await onStatusUpdate();
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.response?.data?.error || err.message;
      alert(`Failed: ${errorMsg}`);
    }
  };

  const handleMarkDepositHeld = async (depositId) => {
    const confirm = window.confirm('Manually mark this deposit as HELD?');
    if (!confirm) return;
    try {
      await apiClient.markDepositHeld(depositId);
      alert('Deposit marked as held.');
      await refresh();
      if (onStatusUpdate) await onStatusUpdate();
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.response?.data?.error || err.message;
      alert(`Failed: ${errorMsg}`);
    }
  };

  const handleSelectCOD = async (invoiceId) => {
    try {
      await apiClient.selectCODPayment(invoiceId);
      alert('Payment method set to Cash on Delivery (COD).');
      await refresh();
      if (onStatusUpdate) {
        await onStatusUpdate();
      }
    } catch (err) {
      alert(`Failed to select COD: ${err.message}`);
    }
  };

  const handleMarkCODPaid = async (invoiceId) => {
    const confirmPaid = window.confirm('Mark this COD invoice as PAID?');
    if (!confirmPaid) return;
    try {
      await apiClient.markCODInvoicePaid(invoiceId);
      alert('COD Invoice marked as paid successfully!');
      await refresh();
      if (onStatusUpdate) {
        await onStatusUpdate();
      }
    } catch (err) {
      alert(`Failed to mark paid: ${err.message}`);
    }
  };

  // ESC key to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleTransition = useCallback(async (toStatus) => {
    if (toStatus === 'CONFIRMED') {
      const hasUnpaidInvoice = booking?.invoices?.some(inv => inv.status !== 'PAID' && inv.payment_method !== 'COD');
      const hasPendingDeposit = booking?.deposits?.some(dep => dep.status !== 'HELD');
      if (hasUnpaidInvoice || hasPendingDeposit) {
        let reasons = [];
        if (hasUnpaidInvoice) reasons.push('• The rent invoice has not been paid.');
        if (hasPendingDeposit) reasons.push('• The security deposit is still pending (must be HELD).');
        alert(`Cannot Confirm Booking:\n\n${reasons.join('\n')}\n\nPlease mark the invoice as PAID (or set to COD) and mark the deposit as HELD in the Financial Ledger above.`);
        return;
      }
    }
    setTransitioning(true);
    try {
      await onStatusUpdate(bookingId, {
        new_status: toStatus,
        changed_by: user?.name || 'System Operator',
        reason: getTransitionLabel(toStatus),
      });
      await refresh();
    } catch (err) {
      alert(`Transition failed: ${err.message}`);
    } finally {
      setTransitioning(false);
    }
  }, [bookingId, getTransitionLabel, onStatusUpdate, refresh, user, booking]);

  const [downloadingInvoice, setDownloadingInvoice] = useState({});

  const handleDownloadInvoice = async (bookingId, invoiceRef) => {
    setDownloadingInvoice(prev => ({ ...prev, [bookingId]: true }));
    try {
      const blob = await apiClient.downloadInvoicePDF(bookingId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoiceRef || 'invoice'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to download invoice PDF: ' + err.message);
    } finally {
      setDownloadingInvoice(prev => ({ ...prev, [bookingId]: false }));
    }
  };

  const handleDamageSubmit = async (e) => {
    e.preventDefault();
    if (!damageEquipId || !damageDesc) {
      alert('Please select an equipment and provide a description.');
      return;
    }
    setDamageSubmitting(true);
    try {
      await apiClient.logDamageReport({
        booking_id: bookingId,
        equipment_id: damageEquipId,
        reported_by: user?.name || 'Logistics Operator',
        description: damageDesc,
        estimated_cost: parseFloat(damageCost || 0)
      });
      alert('Damage report logged successfully. Equipment status set to IN MAINTENANCE.');
      setShowDamageForm(false);
      setDamageEquipId('');
      setDamageDesc('');
      setDamageCost('');
      await refresh();
    } catch (err) {
      alert(`Failed to log damage: ${err.message}`);
    } finally {
      setDamageSubmitting(false);
    }
  };

  const allowedNext = booking ? getAllowedNext(booking.status) : [];
  const hireDays = booking ? getDurationDays(booking.scheduled_delivery_date, booking.scheduled_return_date) : null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="flyout-backdrop"
        onClick={onClose}
        aria-hidden="true"
        variants={backdropFade}
        initial="initial"
        animate="animate"
        exit="exit"
      />

      {/* Panel */}
      <motion.aside
        id="deep-view-flyout"
        className="flyout"
        role="dialog"
        aria-modal="true"
        aria-label={booking ? `Booking ${booking.booking_ref} details` : 'Loading booking details'}
        variants={flyoutSlide}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {loading ? (
          <SkeletonFlyout />
        ) : error ? (
          <div style={{ padding: 'var(--space-6)', color: 'var(--red)' }}>
            <p>Failed to load booking: {error}</p>
            <button className="btn btn-ghost" onClick={onClose} style={{ marginTop: 'var(--space-4)' }}>Close</button>
          </div>
        ) : booking ? (
          <>
            {/* Header */}
            <div className="flyout__header">
              <div className="flyout__header-left">
                <span className="flyout__ref">{booking.booking_ref}</span>
                <h2 className="flyout__customer-name">{booking.customer?.name}</h2>
                {booking.customer?.company && (
                  <span className="flyout__company">{booking.customer.company}</span>
                )}
                <div className="flyout-badge-container">
                  <StatusBadge status={booking.status} size="sm" />
                  <span className={`priority-badge priority-badge--${booking.priority?.toLowerCase() || 'medium'}`}>
                    <Zap size={10} style={{ marginRight: '2px', display: 'inline-block', verticalAlign: 'middle' }} /> {booking.priority || 'MEDIUM'}
                  </span>
                  <span className="source-badge">
                    <Package size={10} style={{ marginRight: '2px', display: 'inline-block', verticalAlign: 'middle' }} /> {booking.source || 'PORTAL'}
                  </span>
                </div>
              </div>
              <div className="flyout__header-actions">
                <button
                  id="flyout-close-btn"
                  className="flyout__close-btn"
                  onClick={onClose}
                  aria-label="Close booking detail panel"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flyout__body">
              {/* Customer contact */}
              <div className="flyout-section">
                <div className="flyout-section__title">Customer Contact & Owner</div>
                <div className="flyout-info-grid">
                  <div className="flyout-info-item">
                    <div className="flyout-info-label">Email</div>
                    <div className="flyout-info-value">
                      <a href={`mailto:${booking.customer?.email}`} style={{ color: 'var(--blue)', textDecoration: 'none' }}>
                        {booking.customer?.email}
                      </a>
                    </div>
                  </div>
                  <div className="flyout-info-item">
                    <div className="flyout-info-label">Phone</div>
                    <div className="flyout-info-value">
                      <a href={`tel:${booking.customer?.phone}`} style={{ color: 'var(--cyan)', textDecoration: 'none' }}>
                        {booking.customer?.phone}
                      </a>
                    </div>
                  </div>
                  <div className="flyout-info-item">
                    <div className="flyout-info-label">Owner Assignment</div>
                    <div className="flyout-info-value" style={{ color: 'var(--purple)', fontWeight: 600 }}>{booking.assigned_owner || 'Dilleswara Rao'}</div>
                  </div>
                  <div className="flyout-info-item">
                    <div className="flyout-info-label">Hire Duration</div>
                    <div className="flyout-info-value" style={{ color: 'var(--amber)' }}>
                      {hireDays} day{hireDays !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="flyout-info-item">
                    <div className="flyout-info-label">Created Date</div>
                    <div className="flyout-info-value" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {formatDateTime(booking.created_at)}
                    </div>
                  </div>
                  <div className="flyout-info-item">
                    <div className="flyout-info-label">Last Updated</div>
                    <div className="flyout-info-value" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {formatDateTime(booking.updated_at)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rule Engine generated card */}
              <div className="flyout-section">
                <div className="flyout-section__title">Automated Analysis & Rules</div>
                <div className="rule-card">
                  <div className="rule-card__summary">
                    <Sparkles size={14} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle', color: 'var(--color-brass)' }} /> <strong>Summary:</strong> {booking.generated_summary}
                  </div>
                  {booking.recommendations && booking.recommendations.length > 0 && (
                    <div style={{ marginBottom: 'var(--space-3)' }}>
                      <div className="flyout-info-label" style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>Recommendations:</div>
                      <ul className="rule-card__list">
                        {booking.recommendations.map((rec, i) => (
                          <li key={i} className="rule-card__item">
                            <span className="rule-card__icon" style={{ color: 'var(--cyan)', display: 'inline-flex', verticalAlign: 'middle' }}><ChevronRight size={12} /></span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {booking.next_actions && booking.next_actions.length > 0 && (
                    <div>
                      <div className="flyout-info-label" style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>Suggested Next Actions:</div>
                      <ul className="rule-card__list">
                        {booking.next_actions.map((act, i) => (
                          <li key={i} className="rule-card__item">
                            <span className="rule-card__icon" style={{ color: 'var(--green)', display: 'inline-flex', verticalAlign: 'middle' }}><Check size={12} /></span>
                            <span style={{ fontWeight: 500 }}>{act}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Alerts details */}
              {(booking.active_alerts && booking.active_alerts.length > 0) && (
                <div className="flyout-section" style={{ background: 'var(--red-soft, rgba(239,68,68,0.05))' }}>
                  <div className="flyout-section__title" style={{ color: 'var(--red)' }}>Active System Alerts ({booking.active_alerts.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {booking.active_alerts.map((al, idx) => (
                      <div key={idx} style={{
                        padding: '8px 12px',
                        background: 'var(--bg-secondary)',
                        borderLeft: '4px solid var(--red)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-primary)',
                        fontWeight: 500
                      }}>
                        {al.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quotation Negotiation Section */}
              {booking.status === 'QUOTATION_REQUESTED' && (
                <div className="flyout-section" style={{ borderLeft: '4px solid var(--accent)', paddingLeft: 'var(--space-3)' }}>
                  <div className="flyout-section__title" style={{ color: 'var(--accent)' }}>Quotation & Price Negotiation</div>
                  
                  {!quotation ? (
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                      Loading quotation details...
                    </div>
                  ) : (
                    <div>
                      <div className="rule-card" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>QUOTE STATUS</span>
                          <span className={`status-badge status-badge--${quotation.status.toLowerCase()}`} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}>
                            {quotation.status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {quotation.versions && quotation.versions.length > 0 && (() => {
                          const latest = quotation.versions[quotation.versions.length - 1];
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Current Price Offer:</div>
                                  <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {formatCurrency(latest.quote_amount)}
                                  </div>
                                </div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                  Version {latest.version_number} · {new Date(latest.created_at).toLocaleDateString()}
                                </div>
                              </div>

                              {latest.discount_reason && (
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--green)', fontWeight: 600 }}>
                                  Discount Applied: {latest.discount_reason}
                                </div>
                              )}

                              {latest.notes_from_admin && (
                                <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', borderLeft: '2px solid var(--border-active)' }}>
                                  <strong>Admin Message:</strong> "{latest.notes_from_admin}"
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Customer Actions */}
                      {user?.role === 'CUSTOMER' && quotation.status === 'QUOTE_PROVIDED' && (
                        <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                          <button
                            className="btn btn-primary"
                            onClick={handleAcceptQuote}
                            disabled={actionLoading}
                            style={{ width: '100%', padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}
                          >
                            {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            Accept Quote & Proceed to Invoice
                          </button>

                          <div style={{ borderTop: '1px solid var(--border)', marginTop: 'var(--space-2)', paddingTop: 'var(--space-3)' }}>
                            <div className="flyout-info-label" style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>Request another counter-offer/revision:</div>
                            <textarea
                              placeholder="Type your message or discount request here..."
                              value={revisionNotes}
                              onChange={(e) => setRevisionNotes(e.target.value)}
                              rows="3"
                              style={{ width: '100%', padding: '8px', fontSize: 'var(--text-xs)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', resize: 'vertical', color: 'var(--text-primary)' }}
                            />
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={handleRequestRevision}
                              disabled={actionLoading || !revisionNotes.trim()}
                              style={{ marginTop: 'var(--space-2)', width: '100%', fontSize: 'var(--text-xs)' }}
                            >
                              Submit Revision Request
                            </button>
                          </div>
                        </div>
                      )}

                      {user?.role === 'CUSTOMER' && quotation.status === 'PENDING_QUOTE' && (
                        <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Clock size={16} style={{ color: 'var(--amber)' }} />
                          <span>Waiting for SD Digitals Admin to review and provide revised pricing. You will receive an email once updated.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Schedule & Location */}
              <div className="flyout-section">
                <div className="flyout-section__title">Schedule & Location</div>
                <div className="flyout-info-grid">
                  <div className="flyout-info-item">
                    <div className="flyout-info-label">Delivery</div>
                    <div className="flyout-info-value">{formatDate(booking.scheduled_delivery_date)}</div>
                  </div>
                  <div className="flyout-info-item">
                    <div className="flyout-info-label">Return</div>
                    <div className="flyout-info-value">{formatDate(booking.scheduled_return_date)}</div>
                  </div>
                </div>
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <div className="flyout-info-label">Delivery Address</div>
                  <div className="flyout-info-value" style={{ fontSize: 'var(--text-sm)' }}>
                    {booking.location?.delivery_address}
                  </div>
                  {booking.location?.site_contact_name && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>
                      Site contact: {booking.location.site_contact_name} · {booking.location.site_contact_phone}
                    </div>
                  )}
                </div>
              </div>

              {/* Equipment */}
              {booking.equipment && booking.equipment.length > 0 && (
                <div className="flyout-section">
                  <div className="flyout-section__title">Equipment ({booking.equipment.length} item{booking.equipment.length !== 1 ? 's' : ''})</div>
                  <div className="flyout-equipment-list">
                    {booking.equipment.map((eq) => (
                      <div key={eq.id} className="flyout-equipment-item">
                        <div>
                          <div className="flyout-equipment-item__name">{eq.name}</div>
                          <div className="flyout-equipment-item__meta">{eq.serial_number} · {eq.category}</div>
                        </div>
                        <div className="flyout-equipment-item__rate">{formatCurrency(eq.rental_rate_per_day)}/day</div>
                      </div>
                    ))}
                  </div>
                  {hireDays && booking.equipment.length > 0 && (
                    <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'var(--amber-soft)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--amber)', fontWeight: 600 }}>Estimated Total</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-md)', color: 'var(--amber)', fontWeight: 700 }}>
                        {formatCurrency(booking.equipment.reduce((sum, e) => sum + (e.rental_rate_per_day || 0), 0) * hireDays)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Operations Log */}
              {booking.operations_log && (
                <div className="flyout-section">
                  <div className="flyout-section__title">Operations Log (Logistics)</div>
                  <div className="flyout-ops-grid">
                    <div className="flyout-info-item">
                      <div className="flyout-info-label">Driver</div>
                      <div className="flyout-info-value">
                        {booking.operations_log.driver_assigned || <span style={{ color: 'var(--text-tertiary)' }}>Unassigned</span>}
                      </div>
                    </div>
                    <div className="flyout-info-item">
                      <div className="flyout-info-label">Vehicle</div>
                      <div className="flyout-info-value">
                        {booking.operations_log.vehicle_id || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </div>
                    </div>
                    <div className="flyout-info-item">
                      <div className="flyout-info-label">Pickup Time</div>
                      <div className="flyout-info-value">{formatDateTime(booking.operations_log.scheduled_pickup_time)}</div>
                    </div>
                    <div className="flyout-info-item">
                      <div className="flyout-info-label">Return Time</div>
                      <div className="flyout-info-value">{formatDateTime(booking.operations_log.scheduled_return_time)}</div>
                    </div>
                    {booking.operations_log.dispatch_notes && (
                      <div className="flyout-info-item" style={{ gridColumn: '1 / -1' }}>
                        <div className="flyout-info-label">Dispatch Notes</div>
                        <div className="flyout-info-value" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          "{booking.operations_log.dispatch_notes}"
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Financial Ledger Section (Invoices & Deposits) */}
              {((booking.invoices && booking.invoices.length > 0) || (booking.deposits && booking.deposits.length > 0)) && (
                <div className="flyout-section">
                  <div className="flyout-section__title">Financial Ledger (Quotations & Receipts)</div>
                  {booking.invoices && booking.invoices.length > 0 && (
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                      <div className="flyout-info-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Invoices:</div>
                      <table className="finance-table">
                        <thead>
                          <tr>
                            <th>Ref</th>
                            <th>Due</th>
                            <th>Paid</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {booking.invoices.map((inv) => (
                            <tr key={inv.id}>
                              <td>
                                <div>{inv.invoice_ref}</div>
                                <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                                  Method: {inv.payment_method || 'RAZORPAY'}
                                </div>
                                {inv.razorpay_order_id && (
                                  <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                                    Order: {inv.razorpay_order_id}
                                    {inv.razorpay_payment_id && ` | Pay: ${inv.razorpay_payment_id}`}
                                  </div>
                                )}
                              </td>
                              <td style={{ fontWeight: 600 }}>{formatCurrency(inv.amount_due)}</td>
                              <td>{formatCurrency(inv.amount_paid)}</td>
                              <td>
                                <span className={`finance-badge finance-badge--${inv.status.toLowerCase()}`}>
                                  {inv.status}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                  {inv.status === 'UNPAID' && user?.role === 'CUSTOMER' && (
                                    <>
                                      <button
                                        className="btn btn-xs btn-primary animate-pulse"
                                        onClick={() => handlePay('invoice', inv)}
                                        disabled={payingId === inv.id}
                                        style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--green)', borderColor: 'var(--green)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                      >
                                        {payingId === inv.id ? <Clock size={10} className="animate-spin" /> : <><CreditCard size={10} /> Pay Rental</>}
                                      </button>
                                      {inv.payment_method !== 'COD' && (
                                        <button
                                          className="btn btn-xs btn-ghost"
                                          onClick={() => handleSelectCOD(inv.id)}
                                          style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--accent)', borderColor: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                          <DollarSign size={10} /> Pay COD
                                        </button>
                                      )}
                                    </>
                                  )}
                                  {inv.status === 'UNPAID' && (user?.role === 'ADMIN' || user?.role === 'EMPLOYEE') && (
                                    <button
                                      className="btn btn-xs btn-primary"
                                      onClick={() => handleMarkInvoicePaid(inv.id)}
                                      style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--green)', borderColor: 'var(--green)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Check size={10} /> Mark Paid
                                    </button>
                                  )}
                                  <button
                                    className="btn btn-xs btn-primary"
                                    disabled={!!downloadingInvoice[booking.booking_id]}
                                    onClick={() => handleDownloadInvoice(booking.booking_id, inv.invoice_ref)}
                                    style={{ padding: '4px 8px', fontSize: '11px', minWidth: '70px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    {downloadingInvoice[booking.booking_id] ? '...' : <><Download size={10} /> PDF</>}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {booking.deposits && booking.deposits.length > 0 && (
                    <div>
                      <div className="flyout-info-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Security Deposits:</div>
                      <table className="finance-table">
                        <thead>
                          <tr>
                            <th>Held</th>
                            <th>Method</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {booking.deposits.map((dep) => (
                            <tr key={dep.id}>
                              <td style={{ fontWeight: 600 }}>{formatCurrency(dep.amount)}</td>
                              <td>
                                <div>{dep.payment_method || 'PENDING'}</div>
                                {dep.razorpay_order_id && (
                                  <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                                    Order: {dep.razorpay_order_id}
                                    {dep.razorpay_payment_id && ` | Pay: ${dep.razorpay_payment_id}`}
                                    {dep.razorpay_refund_id && ` | Ref: ${dep.razorpay_refund_id}`}
                                  </div>
                                )}
                              </td>
                              <td>
                                <span className={`finance-badge finance-badge--${dep.status.toLowerCase()}`}>
                                  {dep.status}
                                </span>
                              </td>
                              <td>
                                {dep.status === 'PENDING' && user?.role === 'CUSTOMER' && (
                                  <button
                                    className="btn btn-xs btn-primary animate-pulse"
                                    onClick={() => handlePay('deposit', dep)}
                                    disabled={payingId === dep.id}
                                    style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--blue)', borderColor: 'var(--blue)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    {payingId === dep.id ? <Clock size={10} className="animate-spin" /> : <><ShieldCheck size={10} /> Pay Deposit</>}
                                  </button>
                                )}
                                {dep.status === 'PENDING' && (user?.role === 'ADMIN' || user?.role === 'EMPLOYEE') && (
                                  <button
                                    className="btn btn-xs btn-primary"
                                    onClick={() => handleMarkDepositHeld(dep.id)}
                                    style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--green)', borderColor: 'var(--green)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <Check size={10} /> Mark Held
                                  </button>
                                )}
                                {dep.status === 'HELD' && (user?.role === 'ADMIN' || user?.role === 'EMPLOYEE') && (
                                  <button
                                    className="btn btn-xs btn-ghost"
                                    onClick={() => handleRefund(dep.id)}
                                    disabled={refundingId === dep.id}
                                    style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--amber)', borderColor: 'var(--amber)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    {refundingId === dep.id ? <Clock size={10} className="animate-spin" /> : <><RotateCcw size={10} /> Refund</>}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Damage Reports Section */}
              {((booking.damage_reports && booking.damage_reports.length > 0) || (isAdmin && booking.status === 'PICKED_UP_AND_RETURNED')) && (
                <div className="flyout-section">
                  <div className="flyout-section__title">Damage & Conditions Registry</div>
                  
                  {booking.damage_reports && booking.damage_reports.map((rep) => (
                    <div key={rep.id} className="damage-report-item">
                      <div className="damage-report-item__header">
                        <span>Reported by {rep.reported_by}</span>
                        <span style={{ fontWeight: 700 }}>Est: {formatCurrency(rep.estimated_cost)}</span>
                      </div>
                      <div style={{ fontSize: 'var(--text-xxs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                        Gear: <strong>{rep.equipment_name || 'Camera Equipment'}</strong> · Status: {rep.status}
                      </div>
                      <div className="damage-report-item__desc">
                        "{rep.description}"
                      </div>
                    </div>
                  ))}

                  {/* Log Damage Report button and form for Admins */}
                  {isAdmin && booking.status === 'PICKED_UP_AND_RETURNED' && (
                    <div>
                      {!showDamageForm ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ width: '100%', borderColor: 'var(--red)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                          onClick={() => setShowDamageForm(true)}
                        >
                          <AlertTriangle size={12} /> File New Damage Report
                        </button>
                      ) : (
                        <form onSubmit={handleDamageSubmit} className="damage-logger-form">
                          <h4>File Damage Incident</h4>
                          
                          <select
                            required
                            value={damageEquipId}
                            onChange={(e) => setDamageEquipId(e.target.value)}
                          >
                            <option value="">-- Select Damaged Gear --</option>
                            {booking.equipment?.map((eq) => (
                              <option key={eq.id} value={eq.id}>
                                {eq.name} ({eq.serial_number})
                              </option>
                            ))}
                          </select>

                          <input
                            type="number"
                            placeholder="Estimated Repair Cost (₹)"
                            value={damageCost}
                            onChange={(e) => setDamageCost(e.target.value)}
                            min="0"
                          />

                          <textarea
                            required
                            placeholder="Describe the damage, scratches, missing components in detail..."
                            value={damageDesc}
                            onChange={(e) => setDamageDesc(e.target.value)}
                            rows={3}
                          />

                          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setShowDamageForm(false)}
                              style={{ flex: 1 }}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="btn btn-primary btn-sm"
                              disabled={damageSubmitting}
                              style={{ flex: 1, background: 'var(--red)', borderColor: 'var(--red)' }}
                            >
                              {damageSubmitting ? 'Filing...' : 'Submit Report'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {booking.notes && (
                <div className="flyout-section">
                  <div className="flyout-section__title">Booking Notes</div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{booking.notes}</p>
                </div>
              )}

              {/* Delivery Tracking Timeline */}
              <div className="flyout-section">
                <div className="flyout-section__title">Track Delivery</div>
                <DeliveryTracker booking={booking} />
              </div>

              {/* Status History */}
              {booking.status_history && booking.status_history.length > 0 && (
                <div className="flyout-section">
                  <div className="flyout-section__title">Status Chronology</div>
                  <OperationsChronology history={booking.status_history} />
                </div>
              )}
            </div>

            {/* Footer — transitions (Admins only) */}
            {isAdmin && allowedNext.length > 0 && (
              <div className="flyout__footer">
                <div className="flyout__footer-label">Advance Workflow</div>
                <div className="flyout__transition-btns">
                  {allowedNext.map((status) => {
                    let isDisabled = transitioning;
                    let title = '';
                    
                    if (status === 'CONFIRMED') {
                      const hasUnpaidInvoice = booking.invoices?.some(inv => inv.status !== 'PAID' && inv.payment_method !== 'COD');
                      const hasPendingDeposit = booking.deposits?.some(dep => dep.status !== 'HELD');
                      if (hasUnpaidInvoice || hasPendingDeposit) {
                        title = 'Awaiting Payment / Deposit';
                      }
                    }
                    
                    return (
                      <button
                        key={status}
                        id={`transition-btn-${status}`}
                        className="transition-btn"
                        onClick={() => handleTransition(status)}
                        disabled={isDisabled}
                        title={title}
                      >
                        {transitioning && status === 'CONFIRMED'
                          ? <Loader2 size={12} className="animate-spin" style={{ display: 'inline', verticalAlign: 'middle' }} />
                          : <ArrowRight size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />}
                        {' '}{getTransitionLabel(status)}
                        {title && !transitioning ? ` (${title})` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : null}
      </motion.aside>
    </>
  );
}
