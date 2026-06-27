import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import './ProgressiveQuoteForm.css';

export default function ProgressiveQuoteForm({ equipment, onClose, onSubmit, isSubmitting }) {
  const [step, setStep] = useState(1);
  const [selectedEquip, setSelectedEquip] = useState([]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  
  const availableEq = equipment.filter(e => e.status === 'AVAILABLE');

  const handleNext = () => {
    if (step === 1 && selectedEquip.length === 0) return;
    if (step === 2 && (!deliveryDate || !returnDate || !address)) return;
    setStep(s => s + 1);
  };

  const handleBack = () => {
    setStep(s => s - 1);
  };

  const handleToggleEquip = (id) => {
    setSelectedEquip(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      equipment_ids: selectedEquip,
      delivery_date: deliveryDate,
      return_date: returnDate,
      address,
      notes
    });
  };

  return (
    <div className="pqf-overlay" onClick={onClose}>
      <motion.div 
        className="pqf-modal" 
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
      >
        <button className="pqf-close" onClick={onClose}><X size={20}/></button>
        
        <div className="pqf-header">
          <h2>Request Quotation</h2>
          <div className="pqf-stepper">
            <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Gear</div>
            <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Schedule</div>
            <div className={`step ${step >= 3 ? 'active' : ''}`}>3. Details</div>
          </div>
        </div>

        <div className="pqf-body">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" className="pqf-step"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              >
                <h3>Select Equipment</h3>
                <div className="pqf-equip-grid">
                  {availableEq.map(eq => {
                    const isSelected = selectedEquip.includes(eq.id || eq.equipment_id);
                    return (
                      <div 
                        key={eq.id || eq.equipment_id} 
                        className={`pqf-eq-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleToggleEquip(eq.id || eq.equipment_id)}
                      >
                        <div className="eq-icon">{eq.category.substring(0, 1)}</div>
                        <div className="eq-info">
                          <h4>{eq.name}</h4>
                          <p>₹{parseFloat(eq.rental_rate_per_day).toLocaleString('en-IN')}/day</p>
                        </div>
                        {isSelected && <div className="eq-check"><Check size={16}/></div>}
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" className="pqf-step"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              >
                <h3>Schedule & Location</h3>
                <div className="pqf-form-group">
                  <label>Delivery Date & Time</label>
                  <input type="datetime-local" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
                </div>
                <div className="pqf-form-group">
                  <label>Return Date & Time</label>
                  <input type="datetime-local" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
                </div>
                <div className="pqf-form-group">
                  <label>Delivery Address</label>
                  <textarea value={address} onChange={e => setAddress(e.target.value)} rows={3} placeholder="Full delivery address..."></textarea>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" className="pqf-step"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              >
                <h3>Review & Notes</h3>
                <div className="pqf-summary">
                  <p><strong>Selected Items:</strong> {selectedEquip.length}</p>
                  <p><strong>Delivery:</strong> {new Date(deliveryDate).toLocaleString()}</p>
                  <p><strong>Return:</strong> {new Date(returnDate).toLocaleString()}</p>
                </div>
                <div className="pqf-form-group">
                  <label>Additional Notes (e.g., Discount Request, Special Handling)</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="I'm requesting a multi-day discount..."></textarea>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="pqf-footer">
          {step > 1 && (
            <button className="pqf-btn pqf-btn-secondary" onClick={handleBack}>
              <ChevronLeft size={18}/> Back
            </button>
          )}
          {step < 3 ? (
            <button 
              className="pqf-btn pqf-btn-primary" 
              onClick={handleNext} 
              disabled={step === 1 && selectedEquip.length === 0 || step === 2 && (!deliveryDate || !returnDate || !address)}
            >
              Next <ChevronRight size={18}/>
            </button>
          ) : (
            <button className="pqf-btn pqf-btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
