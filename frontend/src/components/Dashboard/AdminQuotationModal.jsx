import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import apiClient from '../../services/apiClient.js';
import './AdminQuotationModal.css';

export default function AdminQuotationModal({ quotation, onClose }) {
  const [loading, setLoading] = useState(false);
  const [eqCost, setEqCost] = useState(quotation.versions?.[quotation.versions.length - 1]?.breakdown?.equipment_cost || 0);
  const [deliveryFee, setDeliveryFee] = useState(quotation.versions?.[quotation.versions.length - 1]?.breakdown?.delivery_fee || 0);
  const [insurance, setInsurance] = useState(quotation.versions?.[quotation.versions.length - 1]?.breakdown?.insurance || 0);
  const [discountAmount, setDiscountAmount] = useState(quotation.versions?.[quotation.versions.length - 1]?.breakdown?.discount_amount || 0);
  const [discountReason, setDiscountReason] = useState(quotation.versions?.[quotation.versions.length - 1]?.discount_reason || '');
  const [adminNotes, setAdminNotes] = useState('');

  const totalQuote = parseFloat(eqCost) + parseFloat(deliveryFee) + parseFloat(insurance) - parseFloat(discountAmount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        breakdown: {
          equipment_cost: parseFloat(eqCost),
          delivery_fee: parseFloat(deliveryFee),
          insurance: parseFloat(insurance),
          discount_amount: parseFloat(discountAmount)
        },
        quote_amount: totalQuote,
        notes_from_admin: adminNotes,
        discount_reason: discountReason
      };
      await apiClient.sendRevisedQuote(quotation.id, payload);
      onClose(); // triggers refresh in parent
    } catch (err) {
      console.error(err);
      alert('Failed to send quote');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="aqm-overlay" onClick={onClose}>
      <motion.div 
        className="aqm-modal" 
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <button className="aqm-close" onClick={onClose}><X size={20}/></button>

        <div className="aqm-header">
          <h2>Manage Quotation: {quotation.booking_ref}</h2>
          <span className={`status-badge status-badge--${quotation.status.toLowerCase()}`}>{quotation.status.replace(/_/g, ' ')}</span>
        </div>

        <div className="aqm-body">
          <div className="aqm-grid">
            <div className="aqm-col">
              <h3>Customer Request Info</h3>
              <div className="aqm-info-box">
                <p><strong>Customer:</strong> {quotation.customer_name}</p>
                <p><strong>Contact:</strong> {quotation.customer_phone}</p>
                <p><strong>Delivery:</strong> {new Date(quotation.delivery_date).toLocaleString()}</p>
                <p><strong>Return:</strong> {new Date(quotation.return_date).toLocaleString()}</p>
                {quotation.notes_from_customer && (
                  <div className="aqm-note">
                    <strong>Customer Note:</strong> {quotation.notes_from_customer}
                  </div>
                )}
              </div>

              <h3 style={{ marginTop: '2rem' }}>Version History</h3>
              <div className="aqm-history">
                {quotation.versions?.map(v => (
                  <div key={v.id} className="aqm-history-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <strong>V{v.version_number}</strong>
                      <span style={{ fontSize: '0.8rem', color: '#666' }}>{new Date(v.created_at).toLocaleString()}</span>
                    </div>
                    <div>Total: ₹{parseFloat(v.quote_amount).toLocaleString('en-IN')}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="aqm-col">
              <h3>Send Revised Quote</h3>
              {['ACCEPTED', 'REJECTED'].includes(quotation.status) ? (
                <div className="aqm-info-box">This quotation has already been {quotation.status.toLowerCase()} by the customer and can no longer be revised.</div>
              ) : (
                <form className="aqm-form" onSubmit={handleSubmit}>
                  <div className="aqm-form-group">
                    <label>Equipment Cost (₹)</label>
                    <input type="number" step="0.01" value={eqCost} onChange={e => setEqCost(e.target.value)} required />
                  </div>
                  <div className="aqm-form-group">
                    <label>Delivery Fee (₹)</label>
                    <input type="number" step="0.01" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} required />
                  </div>
                  <div className="aqm-form-group">
                    <label>Insurance (₹)</label>
                    <input type="number" step="0.01" value={insurance} onChange={e => setInsurance(e.target.value)} />
                  </div>
                  <div className="aqm-form-row">
                    <div className="aqm-form-group" style={{ flex: 1 }}>
                      <label>Discount Amount (₹)</label>
                      <input type="number" step="0.01" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} />
                    </div>
                    <div className="aqm-form-group" style={{ flex: 2 }}>
                      <label>Discount Reason</label>
                      <input type="text" value={discountReason} onChange={e => setDiscountReason(e.target.value)} placeholder="e.g. Multi-day discount" />
                    </div>
                  </div>

                  <div className="aqm-total">
                    <span>New Total Quote:</span>
                    <span>₹{totalQuote.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="aqm-form-group">
                    <label>Message to Customer (Admin Notes)</label>
                    <textarea rows="3" value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Explain the changes..."></textarea>
                  </div>

                  <div className="aqm-actions">
                    <button type="submit" className="aqm-btn-primary" disabled={loading}>
                      {loading ? 'Sending...' : 'Send Revised Quote'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
