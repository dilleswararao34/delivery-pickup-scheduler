import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Sliders, Lightbulb, Mic, ZoomIn, Navigation, Briefcase,
  ClipboardList, MessageSquare, RotateCcw, AlertTriangle, CheckCircle2, Package, X,
  Aperture
} from 'lucide-react';
import NavBar from '../../components/shared/NavBar.jsx';
import StatusBadge from '../../components/LiveLogisticsGrid/StatusBadge.jsx';
import DeepViewFlyout from '../../components/DeepViewFlyout/DeepViewFlyout.jsx';
import ChatWidget from '../../components/ChatWidget/ChatWidget.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { pageTransition, cardEntrance, staggerContainer, buttonTap } from '../../utils/motionVariants.js';
import apiClient from '../../services/apiClient.js';
import { formatDate, getDurationDays, formatCurrency } from '../../utils/dateFormat.js';
import ProgressiveQuoteForm from './ProgressiveQuoteForm.jsx';
import QuotationReviewModal from './QuotationReviewModal.jsx';
import './CustomerPortal.css';

const EQUIPMENT_ICONS = {
  'Cinema Camera': Camera,
  'Stabilizer': Sliders,
  'Lighting': Lightbulb,
  'Audio': Mic,
  'Lens': ZoomIn,
  'Drone': Navigation,
  'Accessories': Briefcase,
};

const WELCOME_KEY = 'sd_welcome_shown';

export default function CustomerPortal() {
  const { user, updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const getTabFromPath = (path) => {
    if (path.endsWith('/browse')) return 'browse';
    if (path.endsWith('/quote')) return 'quote';
    if (path.endsWith('/returns')) return 'returns';
    if (path.endsWith('/profile')) return 'profile';
    return 'bookings';
  };

  const activeTab = getTabFromPath(location.pathname);

  const setActiveTab = (tabId) => {
    if (tabId === 'bookings') navigate('/customer');
    else navigate(`/customer/${tabId}`);
  };

  const [bookings, setBookings] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loadingB, setLoadingB] = useState(true);
  const [loadingQ, setLoadingQ] = useState(true);
  const [loadingE, setLoadingE] = useState(true);

  // One-time welcome banner
  const [showWelcome, setShowWelcome] = useState(false);

  // Quote Review Modal
  const [selectedQuotation, setSelectedQuotation] = useState(null);

  useEffect(() => {
    if (!sessionStorage.getItem(WELCOME_KEY)) {
      sessionStorage.setItem(WELCOME_KEY, '1');
      setShowWelcome(true);
      // Auto-dismiss after 4 seconds
      const t = setTimeout(() => setShowWelcome(false), 4000);
      return () => clearTimeout(t);
    }
  }, []);

  // Quote Form State
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteEquip, setQuoteEquip] = useState([]);
  const [quoteDelivery, setQuoteDelivery] = useState('');
  const [quoteReturn, setQuoteReturn] = useState('');
  const [quoteAddress, setQuoteAddress] = useState(() => (user?.billing_address || ''));
  const [quoteNotes, setQuoteNotes] = useState('');
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteSuccess, setQuoteSuccess] = useState(false);
  const [isEquipDropdownOpen, setIsEquipDropdownOpen] = useState(false);

  // Return Form State
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnBookingId, setReturnBookingId] = useState('');
  const [returnIssues, setReturnIssues] = useState('none');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnSuccess, setReturnSuccess] = useState(false);
  const [selectedFlyoutId, setSelectedFlyoutId] = useState(null);

  // Profile editing state
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileCompany, setProfileCompany] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [toast, setToast] = useState(null);

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfilePhone(user.phone || '');
      setProfileCompany(user.company || '');
      setProfileAddress(user.billing_address || '');
      if (user.billing_address && !quoteAddress) {
        setQuoteAddress(user.billing_address);
      }
    }
  }, [user]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.updateProfile({
        name: profileName,
        phone: profilePhone,
        company: profileCompany,
        billing_address: profileAddress
      });
      updateUser({
        name: profileName,
        phone: profilePhone,
        company: profileCompany,
        billing_address: profileAddress
      });
      showToast('Profile updated successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to update profile', 'error');
    }
  };

  const handlePwdSubmit = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }
    try {
      await apiClient.changePassword(pwdForm.oldPassword, pwdForm.newPassword);
      showToast('Password updated successfully!');
      setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast(err.message || 'Failed to change password', 'error');
    }
  };

  const handleSelectEquipmentForQuote = (eqId) => {
    const eq = equipment.find(e => (e.equipment_id || e.id) === eqId);
    if (eq && eq.status === 'AVAILABLE') {
      setQuoteEquip([eqId]);
    } else {
    setShowQuoteForm(true);
    navigate('/customer/quote');
  };

  const handleQuoteSubmit = async (formData) => {
    try {
      setQuoteSubmitting(true);
      const payload = {
        equipment_ids: formData.equipment_ids,
        scheduled_delivery_date: formData.delivery_date,
        scheduled_return_date: formData.return_date,
        location: { delivery_address: formData.address },
        notes: formData.notes,
        status: 'QUOTATION_REQUESTED',
        customer: {
          name: user.name,
          email: user.email,
          phone: user.phone || '9999999999',
          company: user.company,
        },
        creator: { operator_name: user.name, operator_email: user.email },
      };
      await apiClient.createBooking(payload);
      setQuoteSuccess(true);
      setShowQuoteForm(false);
      fetchCustomerData(); // refresh bookings
    } catch (err) {
      console.error(err);
      showToast('Failed to submit quote request', 'error');
    } finally {
      setQuoteSubmitting(false);
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!returnBookingId) {
      window.alert('Please select a booking.');
      return;
    }
    setReturnSubmitting(true);
    try {
      await apiClient.updateBookingStatus(returnBookingId, {
        new_status: 'PICKED_UP_AND_RETURNED',
        changed_by: user.name,
        reason: `Customer logged return. Condition: ${returnIssues}. Details: ${returnNotes}`,
        operations_update: {
          actual_return_time: new Date().toISOString()
        }
      });

      setReturnSuccess(true);
      setShowReturnForm(false);
      setReturnBookingId('');
      setReturnIssues('none');
      setReturnNotes('');

      // Refresh customer bookings
      fetchCustomerData();
    } catch (err) {
      window.alert(err.message || 'Failed to submit return log');
    } finally {
      setReturnSubmitting(false);
    }
  };

  useEffect(() => {
   const fetchCustomerData = async () => {
    try {
      const bRes = await apiClient.getBookings();
      setBookings(bRes.data || []);
      const qRes = await apiClient.getQuotations();
      setQuotations(qRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };    fetchCustomerData().finally(() => {
      setLoadingB(false);
      setLoadingQ(false);
    });
  }, []);

  useEffect(() => {
    apiClient.getEquipment().then((res) => {
      setEquipment(res.data || []);
    }).catch(() => setEquipment([])).finally(() => setLoadingE(false));
  }, []);

  const handleAcceptQuote = async (quotationId, versionId) => {
    try {
      await apiClient.acceptQuote(quotationId, versionId);
      setSelectedQuotation(null);
      fetchCustomerData();
      showToast('Quotation accepted! Booking confirmed.');
    } catch (error) {
      showToast('Failed to accept quotation', 'error');
    }
  };

  const handleRejectQuote = async (quotationId) => {
    try {
      await apiClient.rejectQuote(quotationId);
      setSelectedQuotation(null);
      fetchCustomerData();
      showToast('Quotation rejected.');
    } catch (error) {
      showToast('Failed to reject quotation', 'error');
    }
  };

  const handleReviseQuote = async (quotationId, reason) => {
    try {
      await apiClient.reviseQuote(quotationId, reason);
      setSelectedQuotation(null);
      fetchCustomerData();
      showToast('Revision request sent.');
    } catch (error) {
      showToast('Failed to send revision request', 'error');
    }
  };

  const handleBookingClick = (b) => {
    if (['QUOTATION_REQUESTED', 'PENDING_QUOTE', 'QUOTE_PROVIDED', 'NEGOTIATING', 'ACCEPTED', 'REJECTED'].includes(b.status)) {
      const quote = quotations.find(q => q.booking_id === b.booking_id || q.booking_ref === b.booking_ref);
      if (quote) {
        setSelectedQuotation(quote);
        return;
      }
    }
    setSelectedFlyoutId(b.booking_id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <NavBar />

      {/* ── One-time Welcome Banner ─────────────────────────────────────── */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              top: '68px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-active)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-3) var(--space-5)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              minWidth: '280px',
              maxWidth: '400px',
            }}
          >
            <CheckCircle2 size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>
              Welcome back, <strong>{user?.name?.split(' ')[0]}</strong>!
            </span>
            <button
              onClick={() => setShowWelcome(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex' }}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="customer-portal"
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {/* Content */}
        <div className="customer-portal__content">
          <AnimatePresence mode="wait">

            {/* ── My Bookings ──────────────────────────────────────────── */}
            {activeTab === 'bookings' && (
              <motion.div key="bookings" variants={pageTransition} initial="initial" animate="animate" exit="exit">
                <motion.div
                  className="cp-bookings__grid"
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                >
                  {loadingB ? (
                    <div className="cp-loading">
                      <Aperture size={28} className="cp-spinner" />
                      <span>Loading your bookings…</span>
                    </div>
                  ) : bookings.length === 0 ? (
                    <div className="cp-empty">
                      <ClipboardList size={44} className="cp-empty__icon" />
                      <div className="cp-empty__title">No bookings yet</div>
                      <div className="cp-empty__sub">Request a quote to get started.</div>
                    </div>
                  ) : (
                    bookings.map((b) => (
                      <motion.div
                        key={b.booking_id}
                        className="cp-booking-card"
                        variants={cardEntrance}
                        onClick={() => handleBookingClick(b)}
                        style={{ cursor: 'pointer' }}
                        whileHover={{ scale: 1.01 }}
                      >
                        <div>
                          <div className="cp-booking-card__ref">{b.booking_ref}</div>
                          <div className="cp-booking-card__title">
                            {Array.isArray(b.equipment_preview) ? b.equipment_preview.slice(0, 2).join(', ') : 'Equipment Rental'}
                          </div>
                          <div className="cp-booking-card__meta">
                            Delivery: {formatDate(b.scheduled_delivery_date)}
                            {' · '}
                            Return: {formatDate(b.scheduled_return_date)}
                            {' · '}
                            {getDurationDays(b.scheduled_delivery_date, b.scheduled_return_date)} days
                          </div>
                        </div>
                      <div className="cp-booking-card__right">
                          <span className={`cp-status-badge cp-status-badge--${b.status?.toLowerCase()}`}>
                            {b.status?.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              </motion.div>
            )}

            {/* ── Browse Equipment ─────────────────────────────────────── */}
            {activeTab === 'browse' && (
              <motion.div key="browse" variants={pageTransition} initial="initial" animate="animate" exit="exit">
                <motion.div
                  className="cp-equipment__grid"
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                >
                  {loadingE ? (
                    <div className="cp-loading" style={{ gridColumn: '1/-1' }}>
                      <Aperture size={28} className="cp-spinner" />
                      <span>Loading equipment…</span>
                    </div>
                  ) : (
                    equipment.map((eq) => {
                      const isAvailable = eq.status === 'AVAILABLE';
                      return (
                        <motion.div
                          key={eq.equipment_id}
                          className="cp-equipment-card"
                          variants={cardEntrance}
                          {...(isAvailable ? buttonTap : {})}
                          onClick={isAvailable ? () => handleSelectEquipmentForQuote(eq.equipment_id || eq.id) : undefined}
                          style={{
                            cursor: isAvailable ? 'pointer' : 'default',
                            opacity: isAvailable ? 1 : 0.55,
                            filter: isAvailable ? 'none' : 'grayscale(40%)',
                          }}
                        >
                          <div className="cp-equipment-card__image">
                            {(() => {
                              const Icon = EQUIPMENT_ICONS[eq.category] || Package;
                              return <Icon size={36} />;
                            })()}
                            <span className={`cp-equipment-card__status-badge cp-equipment-card__status-badge--${isAvailable ? 'available' : 'unavailable'}`}>
                              {isAvailable ? '● Available' : '● Unavailable'}
                            </span>
                          </div>
                          <div className="cp-equipment-card__body">
                            <div className="cp-equipment-card__name">{eq.name}</div>
                            <div className="cp-equipment-card__category">{eq.category} · {eq.brand}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="cp-equipment-card__rate">{formatCurrency(eq.rental_rate_per_day)}/day</span>
                              <span className={`cp-equipment-card__status cp-equipment-card__status--${isAvailable ? 'available' : 'unavailable'}`}>
                                {isAvailable ? 'Available' : eq.status.replace(/_/g, ' ')}
                              </span>
                            </div>
                            {isAvailable && (
                              <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                Click to request quote →
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </motion.div>
              </motion.div>
            )}

            {/* ── Request Quote ────────────────────────────────────────── */}
            {activeTab === 'quote' && (
              <motion.div key="quote" variants={pageTransition} initial="initial" animate="animate" exit="exit">
                <div style={{ maxWidth: 540, margin: '0 auto', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)' }}>
                  {quoteSuccess ? (
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <CheckCircle2 size={48} style={{ color: 'var(--green)', marginBottom: 'var(--space-3)' }} />
                      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--green)', marginBottom: 'var(--space-3)' }}>Quote Submitted Successfully</h2>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
                        Your quotation request has been logged. An operator will review it shortly.
                      </p>
                      <button className="btn btn-ghost" onClick={() => setQuoteSuccess(false)}>
                        Request Another Quote
                      </button>
                    </div>
                  ) : !showQuoteForm ? (
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <MessageSquare size={48} style={{ marginBottom: 'var(--space-3)', color: 'var(--brass)' }} />
                      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>Request a Quotation</h2>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-5)', lineHeight: 1.6 }}>
                        Select your required equipment and rental dates. An SD Digitals operator will respond within 2 business hours with a formal quote.
                      </p>
                      <motion.button
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setShowQuoteForm(true)}
                      >
                        + Start Quotation Request
                      </motion.button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Return Log ───────────────────────────────────────────── */}
            {activeTab === 'returns' && (
              <motion.div key="returns" variants={pageTransition} initial="initial" animate="animate" exit="exit">
                <div style={{ maxWidth: 540, margin: '0 auto', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)' }}>
                  {returnSuccess ? (
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <CheckCircle2 size={48} style={{ marginBottom: 'var(--space-3)', color: 'var(--green)' }} />
                      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--green)', marginBottom: 'var(--space-3)' }}>Return Logged Successfully</h2>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
                        The equipment return has been logged. The operations status has updated to Returned.
                      </p>
                      <button className="btn btn-ghost" onClick={() => setReturnSuccess(false)}>
                        Log Another Return
                      </button>
                    </div>
                  ) : showReturnForm ? (
                    <form onSubmit={handleReturnSubmit} style={{ textAlign: 'left' }}>
                      <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>Log Equipment Return</h3>

                      <div className="form-group">
                        <label>Select Booking to Return *</label>
                        <select
                          required
                          value={returnBookingId}
                          onChange={(e) => setReturnBookingId(e.target.value)}
                        >
                          <option value="">-- Select Booking --</option>
                          {bookings.filter(b => b.status === 'DELIVERED' || b.status === 'AWAITING_PICKUP' || b.status === 'OUT_FOR_DELIVERY').map(b => (
                            <option key={b.booking_id} value={b.booking_id}>
                              {b.booking_ref} - {b.equipment_preview?.join(', ')} ({b.status})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Condition of Equipment *</label>
                        <select
                          value={returnIssues}
                          onChange={(e) => setReturnIssues(e.target.value)}
                        >
                          <option value="none">Perfect Condition (No issues)</option>
                          <option value="damaged">Damaged / Malfunctioning</option>
                          <option value="missing">Missing parts or accessories</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Issues / Damage Details *</label>
                        <textarea
                          required={returnIssues !== 'none'}
                          placeholder={returnIssues === 'none' ? "Any general notes regarding the return (optional)" : "Please describe the damage or missing items in detail *"}
                          value={returnNotes}
                          onChange={(e) => setReturnNotes(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
                        <button type="button" className="btn btn-ghost" onClick={() => setShowReturnForm(false)}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={returnSubmitting} style={{ flex: 1 }}>
                          {returnSubmitting ? 'Logging...' : 'Submit Return Log'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 48, marginBottom: 'var(--space-3)' }}>↩</div>
                      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>Equipment Return Log</h2>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-5)', lineHeight: 1.6 }}>
                        Log damage or issues discovered when returning equipment. Submit the return details for review.
                      </p>
                      <motion.button
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setShowReturnForm(true)}
                      >
                        + Log Equipment Return
                      </motion.button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Customer Profile ────────────────────────────────────────── */}
            {activeTab === 'profile' && (
              <motion.div key="profile" variants={pageTransition} initial="initial" animate="animate" exit="exit">
                <div className="card animate-in" style={{ padding: 'var(--space-6)', background: 'var(--bg-secondary)', width: '100%' }}>
                  <div style={{ marginBottom: 'var(--space-6)' }}>
                    <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>My Profile & Settings</h2>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Manage your personal details and account password</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-8)' }}>
                    {/* Personal Info */}
                    <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-2)' }}>Personal Details</h3>

                      <div className="form-group">
                        <label htmlFor="cust-email-input">Email Address (Read-only)</label>
                        <input
                          id="cust-email-input"
                          type="email"
                          value={user?.email || ''}
                          disabled
                          style={{ background: 'var(--bg-tertiary)', cursor: 'not-allowed' }}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="cust-name-input">Full Name *</label>
                        <input
                          id="cust-name-input"
                          type="text"
                          required
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="cust-phone-input">Phone Number</label>
                        <input
                          id="cust-phone-input"
                          type="text"
                          placeholder="e.g. +91 98765 43210"
                          value={profilePhone}
                          onChange={(e) => setProfilePhone(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="cust-company-input">Company / Organisation</label>
                        <input
                          id="cust-company-input"
                          type="text"
                          placeholder="e.g. Self / Freelance / Studio Name"
                          value={profileCompany}
                          onChange={(e) => setProfileCompany(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="cust-address-input">Billing / Delivery Address</label>
                        <textarea
                          id="cust-address-input"
                          placeholder="Enter your registered billing or default delivery address..."
                          value={profileAddress}
                          onChange={(e) => setProfileAddress(e.target.value)}
                        />
                      </div>

                      <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                        Save Details
                      </button>
                    </form>

                    {/* Security */}
                    <form onSubmit={handlePwdSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-2)' }}>Security Settings</h3>

                      <div className="form-group">
                        <label htmlFor="cust-old-pwd-input">Current Password</label>
                        <input
                          id="cust-old-pwd-input"
                          type="password"
                          required
                          value={pwdForm.oldPassword}
                          onChange={(e) => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="cust-new-pwd-input">New Password</label>
                        <input
                          id="cust-new-pwd-input"
                          type="password"
                          required
                          value={pwdForm.newPassword}
                          onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="cust-confirm-pwd-input">Confirm New Password</label>
                        <input
                          id="cust-confirm-pwd-input"
                          type="password"
                          required
                          value={pwdForm.confirmPassword}
                          onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                        />
                      </div>

                      <button type="submit" className="btn btn-amber" style={{ alignSelf: 'flex-start' }}>
                        Change Password
                      </button>
                    </form>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Deep View Flyout for Customer ──────────────────────────────────── */}
      <AnimatePresence>
        {selectedFlyoutId && (
          <DeepViewFlyout
            bookingId={selectedFlyoutId}
            onClose={() => setSelectedFlyoutId(null)}
            onStatusUpdate={async () => {
              const res = await apiClient.getBookings();
              setBookings(res.data || []);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Toast Alert Component ─────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: 'var(--space-4)',
          right: 'var(--space-4)',
          padding: 'var(--space-3) var(--space-5)',
          background: toast.type === 'error' ? 'var(--red)' : 'var(--green)',
          color: '#fff',
          fontWeight: 600,
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          zIndex: 9999,
          animation: 'slide-in-right 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* ── AI Chat Widget ─────────────────────────────────────────────────── */}
      <ChatWidget />
      {selectedQuotation && (
        <QuotationReviewModal 
          quotation={selectedQuotation} 
          onClose={() => setSelectedQuotation(null)}
          onAccept={handleAcceptQuote}
          onReject={handleRejectQuote}
          onRevise={handleReviseQuote}
        />
      )}
    </div>
  );
}
