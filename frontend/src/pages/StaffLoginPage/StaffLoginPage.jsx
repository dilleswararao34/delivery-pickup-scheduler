import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { loginCardEntrance, shakeError } from '../../utils/motionVariants.js';
import apiClient from '../../services/apiClient.js';
import '../LoginPage/LoginPage.css';

export default function StaffLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required.');
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const data = await apiClient.login(email, password);
      const { accessToken, user } = data;

      if (user.role !== 'ADMIN' && user.role !== 'EMPLOYEE') {
        setError('Unauthorized access. This portal is for staff members only.');
        triggerShake();
        return;
      }

      login(accessToken, user);
      const from = location.state?.from?.pathname || '/admin';
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check details.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  return (
    <div className="login-page">
      <motion.div
        className="login-card"
        variants={loginCardEntrance}
        initial="initial"
        animate="animate"
      >
        <div className="login-card__header">
          <div className="login-card__logo">SD</div>
          <h1 className="login-card__title">SD Digitals</h1>
          <p className="login-card__subtitle">Staff Operations Portal</p>
        </div>

        <div className="login-card__body">
          <form onSubmit={handleSubmit}>
            <AnimatePresence>
              {error && (
                <motion.div
                  className="login-form__error"
                  variants={shaking ? shakeError : {}}
                  animate={shaking ? 'animate' : ''}
                  initial={{ opacity: 0, height: 0 }}
                  whileInView={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  role="alert"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <AlertTriangle size={14} />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="login-form__group">
              <label className="login-form__label" htmlFor="staff-email">Staff Email *</label>
              <input
                id="staff-email"
                type="email"
                className="login-form__input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@sddigitals.in"
                autoComplete="email"
                required
              />
            </div>

            <div className="login-form__group">
              <label className="login-form__label" htmlFor="staff-password">Password *</label>
              <input
                id="staff-password"
                type="password"
                className="login-form__input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <motion.button
              id="staff-login-submit-btn"
              type="submit"
              className="login-form__submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? 'Connecting…' : 'Sign In to Portal →'}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
