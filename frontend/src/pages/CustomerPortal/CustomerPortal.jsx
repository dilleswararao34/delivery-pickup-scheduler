import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import NavBar from '../../components/shared/NavBar.jsx';
import StatusBadge from '../../components/LiveLogisticsGrid/StatusBadge.jsx';
import DeepViewFlyout from '../../components/DeepViewFlyout/DeepViewFlyout.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { pageTransition, cardEntrance, staggerContainer, buttonTap } from '../../utils/motionVariants.js';
import apiClient from '../../services/apiClient.js';
import { formatDate, getDurationDays, formatCurrency } from '../../utils/dateFormat.js';
import './CustomerPortal.css';

const EQUIPMENT_ICONS = {
  'Cinema Camera': '🎥',
  'Stabilizer':    '🎬',
  'Lighting':      '💡',
  'Audio':         '🎙',
  'Lens':          '🔭',
  'Drone':         '🚁',
  'Accessories':   '🎒',
};

const TABS = [
  { id: 'bookings', label: '📋 My Bookings'    },
  { id: 'browse',   label: '🎬 Browse Gear'    },
  { id: 'quote',    label: '💬 Request Quote'  },
  { id: 'returns',  label: '↩ Return Log'     },
  { id: 'profile',  label: '👤 Profile'        },
];

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

  const [bookings,   setBookings]   = useState([]);
  const [equipment,  setEquipment]  = useState([]);
  const [loadingB,   setLoadingB]   = useState(true);
  const [loadingE,   setLoadingE]   = useState(true);

  // Quote Form State
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteEquip, setQuoteEquip] = useState([]);
  const [quoteDelivery, setQuoteDelivery] = useState('');
  const [quoteReturn, setQuoteReturn] = useState('');
  const [quoteAddress, setQuoteAddress] = useState('');
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
    setQuoteEquip([eqId]);
    setShowQuoteForm(true);
    navigate('/customer/quote');
  };

  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    if (quoteEquip.length === 0) {
      window.alert('Please select at least one equipment item.');
      return;
    }
    setQuoteSubmitting(true);
    try {
      const payload = {
        customer: {
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          company: user.company || 'Self'
        },
        creator: {
          operator_name: user.name,
          operator_email: user.email
        },
        equipment_ids: quoteEquip,
        location: {
          delivery_address: quoteAddress,
          site_contact_name: user.name,
          site_contact_phone: user.phone || ''
        },
        scheduled_delivery_date: new Date(quoteDelivery).toISOString(),
        scheduled_return_date: new Date(quoteReturn).toISOString(),
        notes: quoteNotes
      };
      
      const res = await apiClient.createBooking(payload);
      const bookingId = res.data.booking_id;
      
      // Transition to QUOTATION_REQUESTED
      await apiClient.updateBookingStatus(bookingId, {
        new_status: 'QUOTATION_REQUESTED',
        changed_by: user.name,
        reason: 'Customer submitted quote request via portal'
      });
      
      setQuoteSuccess(true);
      setShowQuoteForm(false);
      
      // Clear form
      setQuoteEquip([]);
      setQuoteDelivery('');
      setQuoteReturn('');
      setQuoteAddress('');
      setQuoteNotes('');
      
      // Refresh customer bookings
      const updated = await apiClient.getBookings();
      setBookings(updated.data || []);
    } catch (err) {
      if (err.fields && Array.isArray(err.fields)) {
        const details = err.fields.map((f) => `${f.field}: ${f.issue}`).join('\n');
        window.alert(`Request validation failed:\n\n${details}`);
      } else {
        window.alert(err.message || 'Failed to submit quotation request');
      }
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
      const updated = await apiClient.getBookings();
      setBookings(updated.data || []);
    } catch (err) {
      window.alert(err.message || 'Failed to submit return log');
    } finally {
      setReturnSubmitting(false);
    }
  };

  useEffect(() => {
    apiClient.getBookings().then((res) => {
      setBookings(res.data || []);
    }).catch(() => setBookings([])).finally(() => setLoadingB(false));
  }, []);

  useEffect(() => {
    apiClient.getEquipment().then((res) => {
      setEquipment(res.data || []);
    }).catch(() => setEquipment([])).finally(() => setLoadingE(false));
  }, []);

  useEffect(() => {
    if (!isEquipDropdownOpen) return;
    const handleOutsideClick = () => setIsEquipDropdownOpen(false);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isEquipDropdownOpen]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <NavBar />

      <motion.div
        className="customer-portal"
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <div className="customer-portal__hero">
          <h1 className="customer-portal__greeting">
            Welcome back, <span>{user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="customer-portal__sub">
            Manage your equipment rentals, browse available gear, and request quotations.
          </p>
        </div>

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
                    <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Loading your bookings…</p>
                  ) : bookings.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-tertiary)' }}>
                      <div style={{ fontSize: 48, marginBottom: 'var(--space-3)' }}>📋</div>
                      <p>No bookings yet. Request a quote to get started.</p>
                    </div>
                  ) : (
                    bookings.map((b) => (
                      <motion.div
                        key={b.booking_id}
                        className="cp-booking-card"
                        variants={cardEntrance}
                        onClick={() => setSelectedFlyoutId(b.booking_id)}
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
                          <StatusBadge status={b.status} size="sm" />
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
                    <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Loading equipment…</p>
                  ) : (
                    equipment.map((eq) => (
                      <motion.div
                        key={eq.equipment_id}
                        className="cp-equipment-card"
                        variants={cardEntrance}
                        {...buttonTap}
                        onClick={() => handleSelectEquipmentForQuote(eq.equipment_id || eq.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="cp-equipment-card__image">
                          {EQUIPMENT_ICONS[eq.category] || '📦'}
                        </div>
                        <div className="cp-equipment-card__body">
                          <div className="cp-equipment-card__name">{eq.name}</div>
                          <div className="cp-equipment-card__category">{eq.category} · {eq.brand}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="cp-equipment-card__rate">{formatCurrency(eq.rental_rate_per_day)}/day</span>
                            <span className={`cp-equipment-card__status cp-equipment-card__status--${eq.status === 'AVAILABLE' ? 'available' : 'unavailable'}`}>
                              {eq.status === 'AVAILABLE' ? '✓ Available' : eq.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              </motion.div>
            )}

            {/* ── Request Quote ────────────────────────────────────────── */}
            {activeTab === 'quote' && (
              <motion.div key="quote" variants={pageTransition} initial="initial" animate="animate" exit="exit">
                <div style={{ maxWidth: 540, margin: '0 auto', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)' }}>
                  {quoteSuccess ? (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 48, marginBottom: 'var(--space-3)' }}>✓</div>
                      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--green)', marginBottom: 'var(--space-3)' }}>Quote Submitted Successfully</h2>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
                        Your quotation request has been logged. An operator will review it shortly.
                      </p>
                      <button className="btn btn-ghost" onClick={() => setQuoteSuccess(false)}>
                        Request Another Quote
                      </button>
                    </div>
                  ) : showQuoteForm ? (
                    <form onSubmit={handleQuoteSubmit} style={{ textAlign: 'left' }}>
                      <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>New Quotation Request</h3>
                      
                      <div className="form-group" style={{ position: 'relative' }}>
                        <label>Select Equipment *</label>
                        <div
                          className="custom-select-trigger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsEquipDropdownOpen(!isEquipDropdownOpen);
                          }}
                          style={{
                            padding: '10px 14px',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            background: 'var(--bg-tertiary)',
                            color: quoteEquip.length > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            userSelect: 'none',
                          }}
                        >
                          <span>
                            {quoteEquip.length > 0
                              ? `${quoteEquip.length} item(s) selected`
                              : 'Choose equipment...'}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{isEquipDropdownOpen ? '▲' : '▼'}</span>
                        </div>

                        {isEquipDropdownOpen && (
                          <div
                            className="custom-select-dropdown"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              zIndex: 10,
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-lg)',
                              boxShadow: 'var(--shadow-lg)',
                              maxHeight: '200px',
                              overflowY: 'auto',
                              marginTop: 'var(--space-1)',
                              padding: 'var(--space-2)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 'var(--space-1)',
                            }}
                          >
                            {equipment.map((eq) => {
                              const isChecked = quoteEquip.includes(eq.equipment_id || eq.id);
                              return (
                                <label
                                  key={eq.equipment_id || eq.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-3)',
                                    padding: 'var(--space-2) var(--space-3)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    background: isChecked ? 'var(--bg-elevated)' : 'transparent',
                                    transition: 'background 0.1s',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const id = eq.equipment_id || eq.id;
                                      if (e.target.checked) {
                                        setQuoteEquip((prev) => [...prev, id]);
                                      } else {
                                        setQuoteEquip((prev) => prev.filter((item) => item !== id));
                                      }
                                    }}
                                    style={{
                                      accentColor: 'var(--accent)',
                                      width: '16px',
                                      height: '16px',
                                      cursor: 'pointer',
                                    }}
                                  />
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 'var(--text-sm)', textAlign: 'left' }}>{eq.name}</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'left' }}>
                                      {formatCurrency(eq.rental_rate_per_day)}/day · {eq.status.replace(/_/g, ' ')}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>Delivery Date *</label>
                          <input
                            type="datetime-local"
                            required
                            value={quoteDelivery}
                            onChange={(e) => setQuoteDelivery(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Return Date *</label>
                          <input
                            type="datetime-local"
                            required
                            value={quoteReturn}
                            onChange={(e) => setQuoteReturn(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Delivery Address *</label>
                        <input
                          type="text"
                          required
                          placeholder="Full delivery address"
                          value={quoteAddress}
                          onChange={(e) => setQuoteAddress(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>Special Instructions / Notes</label>
                        <textarea
                          placeholder="Any special handling request, site contacts etc."
                          value={quoteNotes}
                          onChange={(e) => setQuoteNotes(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
                        <button type="button" className="btn btn-ghost" onClick={() => setShowQuoteForm(false)}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={quoteSubmitting} style={{ flex: 1 }}>
                          {quoteSubmitting ? 'Submitting...' : 'Submit Request'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 48, marginBottom: 'var(--space-3)' }}>💬</div>
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
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 48, marginBottom: 'var(--space-3)' }}>✓</div>
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
        }}>
          {toast.type === 'error' ? '⚠️ ' : '✅ '} {toast.text}
        </div>
      )}
    </div>
  );
}
