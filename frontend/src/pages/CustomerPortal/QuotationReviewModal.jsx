import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, FileText, ChevronRight, MessageSquare, IndianRupee } from 'lucide-react';
import './QuotationReviewModal.css';

export default function QuotationReviewModal({ quotation, onClose, onAccept, onReject, onRevise }) {
  const [showReviseInput, setShowReviseInput] = useState(false);
  const [reviseNote, setReviseNote] = useState('');

  if (!quotation) return null;

  const latestVersion = quotation.versions?.[quotation.versions.length - 1];
  const isNegotiating = quotation.status === 'NEGOTIATING';
  const isAccepted = quotation.status === 'ACCEPTED';
  const isRejected = quotation.status === 'REJECTED';
  const isPending = quotation.status === 'PENDING_QUOTE';
  const isProvided = quotation.status === 'QUOTE_PROVIDED';

  const handleReviseSubmit = () => {
    if (!reviseNote.trim()) return;
    onRevise(quotation.id, reviseNote);
    setShowReviseInput(false);
    setReviseNote('');
  };

  return (
    <div className="qrm-overlay" onClick={onClose}>
      <motion.div 
        className="qrm-modal" 
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <button className="qrm-close" onClick={onClose}><X size={20}/></button>

        <div className="qrm-header">
          <h2>Quotation {quotation.booking_ref}</h2>
          <span className={`qrm-badge qrm-badge--${quotation.status.toLowerCase()}`}>
            {quotation.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="qrm-body">
          {/* History / Versions Thread */}
          <div className="qrm-timeline">
            {quotation.versions?.map((v, i) => (
              <div key={v.id} className="qrm-version-card">
                <div className="qrm-v-header">
                  <h4>Version {v.version_number}</h4>
                  <span className="qrm-v-date">{new Date(v.created_at).toLocaleString()}</span>
                </div>
                <div className="qrm-v-breakdown">
                  <div className="qrm-v-row">
                    <span>Equipment Cost</span>
                    <span>₹{parseFloat(v.breakdown?.equipment_cost || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="qrm-v-row">
                    <span>Delivery Fee</span>
                    <span>₹{parseFloat(v.breakdown?.delivery_fee || 0).toLocaleString('en-IN')}</span>
                  </div>
                  {parseFloat(v.breakdown?.insurance || 0) > 0 && (
                    <div className="qrm-v-row">
                      <span>Insurance</span>
                      <span>₹{parseFloat(v.breakdown?.insurance || 0).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {v.discount_reason && (
                    <div className="qrm-v-row qrm-discount">
                      <span>Discount ({v.discount_reason})</span>
                      <span>Applied</span>
                    </div>
                  )}
                  <div className="qrm-v-total">
                    <span>Total Quote</span>
                    <span>₹{parseFloat(v.quote_amount).toLocaleString('en-IN')}</span>
                  </div>
                </div>
                {v.notes_from_admin && (
                  <div className="qrm-v-notes">
                    <strong>Admin Note:</strong> {v.notes_from_admin}
                  </div>
                )}
                {v.accepted_by_customer && (
                  <div className="qrm-v-accepted">
                    <Check size={16}/> Accepted by you on {new Date(v.accepted_at).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pending state */}
          {isPending && (
             <div className="qrm-info-box">
                <p>Your quotation request is currently under review by our team. We will provide a formal quote shortly.</p>
             </div>
          )}

          {/* Negotiating state */}
          {isNegotiating && (
             <div className="qrm-info-box">
                <p>You requested a revision. Our team is reviewing your notes and will send an updated quote soon.</p>
                {quotation.notes_from_customer && (
                  <p className="qrm-cust-note"><strong>Your Note:</strong> {quotation.notes_from_customer}</p>
                )}
             </div>
          )}

          {/* Revise Input Form */}
          <AnimatePresence>
            {showReviseInput && (
              <motion.div 
                className="qrm-revise-box"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <textarea 
                  placeholder="Explain why you need a revision (e.g. asking for a multi-day discount)..."
                  value={reviseNote}
                  onChange={e => setReviseNote(e.target.value)}
                  rows={3}
                ></textarea>
                <div className="qrm-revise-actions">
                  <button onClick={() => setShowReviseInput(false)} className="qrm-btn-ghost">Cancel</button>
                  <button onClick={handleReviseSubmit} className="qrm-btn-primary" disabled={!reviseNote.trim()}>
                    Submit Revision Request
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Footer Actions */}
        <div className="qrm-footer">
          {isProvided && !showReviseInput && (
            <>
              <button className="qrm-btn-ghost" onClick={() => onReject(quotation.id)}>
                Reject Quote
              </button>
              <div style={{display:'flex', gap:'1rem'}}>
                <button className="qrm-btn-secondary" onClick={() => setShowReviseInput(true)}>
                  Request Revision
                </button>
                <button className="qrm-btn-primary" onClick={() => onAccept(quotation.id, latestVersion.id)}>
                  Accept & Book
                </button>
              </div>
            </>
          )}
          {(isAccepted || isRejected) && (
            <div className="qrm-final-msg">
              This quotation is {quotation.status.toLowerCase()}.
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
