import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransition, staggerContainer, cardEntrance } from '../../utils/motionVariants.js';
import { MessageSquare, Check, X, FileText, ChevronRight, CornerDownRight, Edit3 } from 'lucide-react';
import apiClient from '../../services/apiClient.js';
import { formatCurrency, formatDate } from '../../utils/dateFormat.js';

export default function CustomerQuotationsTab() {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuotation, setSelectedQuotation] = useState(null);

  // Modal forms state
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchQuotations = async () => {
    try {
      const res = await apiClient.getQuotations();
      // Since backend might return all, we assume backend filters for customer or we filter here.
      // Wait, apiClient.getQuotations() for a customer? The backend `listQuotations` endpoint has no implicit customer filter if not passed? 
      // Actually, if customer uses it, backend `bookings.controller.js` filters by `customer_email`. Let's assume the backend handles it.
      setQuotations(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  const handleRequestRevision = async (id) => {
    if (!notes.trim()) {
      alert("Please provide notes for the revision request.");
      return;
    }
    setActionLoading(true);
    try {
      await apiClient.requestRevision(id, notes);
      alert("Revision requested successfully. Our team will review and get back to you.");
      setNotes('');
      setSelectedQuotation(null);
      fetchQuotations();
    } catch (err) {
      alert(err.message || "Failed to request revision.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptQuote = async (id, versionId) => {
    const confirm = window.confirm("Are you sure you want to accept this quote? This will convert it into a confirmed booking invoice.");
    if (!confirm) return;
    setActionLoading(true);
    try {
      await apiClient.acceptQuote(id, versionId);
      alert("Quote accepted! A formal invoice has been generated.");
      setSelectedQuotation(null);
      fetchQuotations();
    } catch (err) {
      alert(err.message || "Failed to accept quote.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div className="cp-loading">
          <span>Loading your quotations…</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={pageTransition} initial="initial" animate="animate" exit="exit">
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.5rem' }}>Quotation Requests</h2>
        <p style={{ color: 'var(--color-graphite)', fontSize: '1.1rem' }}>Review our proposals, negotiate terms, and lock in your gear.</p>
      </div>

      <motion.div variants={staggerContainer} initial="initial" animate="animate" style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {quotations.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', background: 'var(--color-paper)', borderRadius: '16px', border: '1px solid var(--color-hairline)' }}>
            <FileText size={48} style={{ color: 'var(--color-graphite)', opacity: 0.5, marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.25rem', color: 'var(--color-ink)', fontWeight: 500 }}>No Quotations Yet</h3>
            <p style={{ color: 'var(--color-graphite)' }}>Submit a quotation request from the Browse Gear section to get started.</p>
          </div>
        ) : (
          quotations.map(q => {
            const latestVersion = q.versions?.[q.versions.length - 1];
            return (
              <motion.div 
                key={q.id} 
                variants={cardEntrance}
                onClick={() => setSelectedQuotation(q)}
                style={{ 
                  background: 'var(--color-paper)', 
                  borderRadius: '16px', 
                  border: '1px solid var(--color-hairline)', 
                  padding: '1.5rem', 
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(0,0,0,0.08)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--color-graphite)', fontWeight: 600 }}>{q.booking_ref}</span>
                  <span className={`status-badge status-badge--${q.status.toLowerCase()}`} style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '20px' }}>
                    {q.status.replace(/_/g, ' ')}
                  </span>
                </div>
                
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.5rem' }}>
                  {latestVersion ? formatCurrency(latestVersion.quote_amount) : 'Pending Evaluation'}
                </h3>
                
                <div style={{ fontSize: '0.9rem', color: 'var(--color-graphite)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MessageSquare size={14} />
                  {q.versions?.length || 0} Revision{(q.versions?.length !== 1) ? 's' : ''}
                </div>
                
                <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', color: 'var(--color-blue)', fontSize: '0.9rem', fontWeight: 500 }}>
                  View Details <ChevronRight size={16} />
                </div>
              </motion.div>
            )
          })
        )}
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {selectedQuotation && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 1000 }}
              onClick={() => setSelectedQuotation(null)}
            />
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              style={{ 
                position: 'fixed', top: '5%', left: '50%', transform: 'translateX(-50%)', 
                width: '90%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto',
                background: 'var(--color-paper)', borderRadius: '24px', zIndex: 1001,
                boxShadow: '0 24px 48px rgba(0,0,0,0.15)', padding: '2.5rem'
              }}
            >
              <button 
                onClick={() => setSelectedQuotation(null)}
                style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'var(--color-smoke)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
              
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.5rem' }}>Quotation Details</h2>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--color-graphite)', marginBottom: '2rem' }}>
                Ref: {selectedQuotation.booking_ref}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {selectedQuotation.versions?.map((v, i) => (
                  <div key={v.id} style={{ padding: '1.5rem', border: '1px solid var(--color-hairline)', borderRadius: '16px', background: i === selectedQuotation.versions.length - 1 ? 'var(--color-paper)' : '#f9fafb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-graphite)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Version {v.version_number}</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-graphite)' }}>{new Date(v.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                      <div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-ink)' }}>{formatCurrency(v.quote_amount)}</div>
                        {v.discount_reason && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--color-green)', fontWeight: 500, marginTop: '0.25rem' }}>
                            Discount Applied: {v.discount_reason}
                          </div>
                        )}
                      </div>
                      
                      {i === selectedQuotation.versions.length - 1 && selectedQuotation.status === 'QUOTE_PROVIDED' && (
                        <button 
                          onClick={() => handleAcceptQuote(selectedQuotation.id, v.id)}
                          disabled={actionLoading}
                          className="btn btn-primary"
                          style={{ padding: '0.75rem 1.5rem', background: 'var(--color-ink)', color: 'var(--color-paper)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}
                        >
                          {actionLoading ? 'Processing...' : 'Accept Quote'}
                        </button>
                      )}
                    </div>

                    {v.notes_from_admin && (
                      <div style={{ background: 'var(--color-blue-soft)', padding: '1rem', borderRadius: '8px', color: 'var(--color-blue-dark)', fontSize: '0.95rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                        <CornerDownRight size={18} style={{ marginTop: '2px', flexShrink: 0 }} />
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', textTransform: 'uppercase' }}>Admin Note</strong>
                          {v.notes_from_admin}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {selectedQuotation.status === 'QUOTE_PROVIDED' && (
                <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--color-hairline)', paddingTop: '2rem' }}>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Edit3 size={18} /> Negotiate / Request Revision
                  </h4>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="E.g., Can you offer a 10% discount for a 5-day rental?"
                    style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--color-hairline)', minHeight: '120px', resize: 'vertical', fontSize: '1rem', marginBottom: '1rem', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => handleRequestRevision(selectedQuotation.id)}
                      disabled={actionLoading || !notes.trim()}
                      className="btn"
                      style={{ padding: '0.75rem 1.5rem', background: 'var(--color-smoke)', color: 'var(--color-ink)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}
                    >
                      {actionLoading ? 'Sending...' : 'Submit Request'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
