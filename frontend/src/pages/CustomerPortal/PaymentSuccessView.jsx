import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Package, ArrowRight, ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function PaymentSuccessView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { bookingRef, amountPaid, paymentMethod } = location.state || {};
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/customer', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <motion.div 
      className="payment-success-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-secondary)',
        padding: '20px'
      }}
    >
      <div style={{
        background: 'var(--color-paper)',
        padding: '50px 40px',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
        textAlign: 'center',
        maxWidth: '500px',
        width: '100%'
      }}>
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.1 }}
          style={{ color: '#22c55e', marginBottom: '24px', display: 'flex', justifyContent: 'center' }}
        >
          <CheckCircle2 size={80} />
        </motion.div>
        
        <h1 style={{ fontSize: '2rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Payment Successful!</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '32px' }}>
          Your order has been placed and confirmed.
        </p>

        <div style={{
          background: 'var(--bg-tertiary)',
          padding: '20px',
          borderRadius: '12px',
          textAlign: 'left',
          marginBottom: '32px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Order Reference</span>
            <strong style={{ color: 'var(--color-ink)' }}>{bookingRef || 'SD-XXXXX'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Amount Paid</span>
            <strong style={{ color: 'var(--color-ink)' }}>₹{amountPaid?.toLocaleString('en-IN') || '0.00'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Payment Method</span>
            <strong style={{ color: 'var(--color-ink)' }}>{paymentMethod || 'RAZORPAY'}</strong>
          </div>
        </div>

        <div style={{ marginBottom: '40px', textAlign: 'left' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={20} className="brass-text" /> What Happens Next?
          </h3>
          <ul style={{ color: 'var(--text-secondary)', paddingLeft: '24px', lineHeight: '1.6' }}>
            <li>Confirmation email & receipt sent.</li>
            <li>Equipment is reserved for your dates.</li>
            <li>Driver details will be assigned closer to delivery.</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
          <button 
            className="btn-primary" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            onClick={() => navigate('/customer', { replace: true })}
          >
            View Booking <ArrowRight size={18} />
          </button>
        </div>
        
        <p style={{ marginTop: '24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Auto-redirecting in {countdown} seconds...
        </p>
      </div>
    </motion.div>
  );
}
