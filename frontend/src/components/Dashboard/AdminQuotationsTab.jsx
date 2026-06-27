import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { pageTransition } from '../../utils/motionVariants.js';
import { MessageSquare, Check, X, FileText } from 'lucide-react';
import apiClient from '../../services/apiClient.js';
import AdminQuotationModal from './AdminQuotationModal.jsx';

export default function AdminQuotationsTab() {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuotation, setSelectedQuotation] = useState(null);

  const fetchQuotations = async () => {
    try {
      const res = await apiClient.getQuotations();
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

  const handleOpenModal = (q) => {
    setSelectedQuotation(q);
  };

  const handleCloseModal = () => {
    setSelectedQuotation(null);
    fetchQuotations();
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading quotations...</div>;
  }

  return (
    <motion.div variants={pageTransition} initial="initial" animate="animate" exit="exit" style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-ink)' }}>Quotations Management</h2>
        <p style={{ color: 'var(--color-graphite)' }}>Review, revise, and approve customer quotation requests.</p>
      </div>

      <div style={{ overflowX: 'auto', background: 'var(--color-paper)', borderRadius: '12px', border: '1px solid var(--color-hairline)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-hairline)', background: '#fafafa' }}>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--color-graphite)', fontSize: '0.9rem' }}>Ref</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--color-graphite)', fontSize: '0.9rem' }}>Customer</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--color-graphite)', fontSize: '0.9rem' }}>Created At</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--color-graphite)', fontSize: '0.9rem' }}>Status</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--color-graphite)', fontSize: '0.9rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-graphite)' }}>No quotations found.</td>
              </tr>
            ) : (
              quotations.map(q => (
                <tr key={q.id} style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                  <td style={{ padding: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>{q.booking_ref}</td>
                  <td style={{ padding: '1rem', fontSize: '0.95rem' }}>{q.customer_name}</td>
                  <td style={{ padding: '1rem', color: 'var(--color-graphite)', fontSize: '0.9rem' }}>{new Date(q.created_at).toLocaleString()}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`status-badge status-badge--${q.status.toLowerCase()}`} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid' }}>
                      {q.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button 
                      onClick={() => handleOpenModal(q)}
                      style={{ padding: '0.5rem 1rem', background: 'var(--color-ink)', color: 'var(--color-paper)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      View / Manage
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedQuotation && (
        <AdminQuotationModal quotation={selectedQuotation} onClose={handleCloseModal} />
      )}
    </motion.div>
  );
}
