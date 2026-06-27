import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, ShieldCheck, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './EquipmentDetailModal.css';

export default function EquipmentDetailModal({ item, onClose }) {
  const navigate = useNavigate();
  if (!item) return null;

  const isAvailable = item.status === 'AVAILABLE';

  const handleQuoteRequest = () => {
    // Navigate to a dedicated quote request page or open another modal
    // For now, we'll navigate to login (or /quote if implemented)
    navigate('/login');
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
                  className={`btn-primary ${!isAvailable ? 'btn-disabled' : ''}`}
                  onClick={handleQuoteRequest}
                  disabled={!isAvailable}
                >
                  {isAvailable ? 'Request Quotation' : 'Join Waitlist'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
