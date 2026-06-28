import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, ShieldCheck, MapPin, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './EquipmentDetailModal.css';

export default function EquipmentDetailModal({ item, onClose }) {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  if (!item) return null;

  const isAvailable = item.status === 'AVAILABLE';
  const hasDates = startDate && endDate;

  const handleRequestQuoteForDates = () => {
    navigate('/customer/quote', { state: { preselect: item.id, startDate, endDate } });
  };

  const handleAddToQuote = () => {
    // Basic implementation that just routes for now, can be expanded to a context cart later
    navigate('/customer/quote', { state: { preselect: item.id } });
  };

  return (
    <AnimatePresence>
      <motion.div
        className="eq-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="eq-modal-content"
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="eq-modal-close" onClick={onClose}>
            <X size={24} />
          </button>

          <div className="eq-modal-grid">
            <div className="eq-modal-image-col">
              <div className="eq-modal-image-placeholder">
                <span className="eq-modal-cat">{item.category}</span>
              </div>
              <div className="eq-modal-gallery">
                <div className="gallery-thumb active"></div>
                <div className="gallery-thumb"></div>
                <div className="gallery-thumb"></div>
              </div>
            </div>

            <div className="eq-modal-info-col">
              <div className="eq-modal-header">
                <div className="eq-modal-badges">
                  <span className={`badge ${isAvailable ? 'badge-available' : 'badge-unavailable'}`}>
                    {isAvailable ? 'Available Now' : 'Currently Rented'}
                  </span>
                  <span className="badge badge-rating">⭐ 4.8 (24 Reviews)</span>
                </div>
                <h2>{item.name}</h2>
                <p className="eq-brand">{item.brand} {item.model_number ? `· ${item.model_number}` : ''}</p>
              </div>

              <div className="eq-modal-price">
                <span className="price-val">₹{parseFloat(item.rental_rate_per_day).toLocaleString('en-IN')}</span>
                <span className="price-label">/ day</span>
              </div>

              <div className="eq-modal-desc">
                {item.description || 'Professional cinema equipment maintained to the highest standards. Regularly serviced and tested before every dispatch.'}
              </div>
              
              {isAvailable && (
                <div className="eq-modal-dates-box">
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--color-ink)' }}><Calendar size={16} style={{ verticalAlign: 'middle', marginRight: 6 }}/> Select Dates</h4>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '4px' }}>Start Date</label>
                      <input type="date" className="eq-date-input" value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '4px' }}>End Date</label>
                      <input type="date" className="eq-date-input" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || new Date().toISOString().split('T')[0]} />
                    </div>
                  </div>
                </div>
              )}

              <div className="eq-modal-specs">
                <h3>Technical Specifications</h3>
                <ul className="specs-list">
                  <li><strong>Category:</strong> {item.category}</li>
                  <li><strong>Replacement Value:</strong> ₹{parseFloat(item.replacement_value).toLocaleString('en-IN')}</li>
                  <li><strong>Serial:</strong> {item.serial_number}</li>
                </ul>
              </div>

              <div className="eq-modal-trust">
                <div className="trust-item"><CheckCircle size={18} /> Verified Condition</div>
                <div className="trust-item"><ShieldCheck size={18} /> Insurance Available</div>
                <div className="trust-item"><MapPin size={18} /> Delhi NCR Delivery</div>
              </div>

              <div className="eq-modal-actions">
                <button 
                  className={`btn-primary ${(!isAvailable || !hasDates) ? 'btn-disabled' : ''}`}
                  onClick={handleRequestQuoteForDates}
                  disabled={!isAvailable || !hasDates}
                  style={{ width: '100%', marginBottom: '10px' }}
                >
                  {isAvailable ? 'Request Quote for These Dates' : 'Join Waitlist'}
                </button>
                {isAvailable && (
                  <button 
                    className="btn-secondary"
                    onClick={handleAddToQuote}
                    style={{ width: '100%' }}
                  >
                    Add to Quote Request
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
