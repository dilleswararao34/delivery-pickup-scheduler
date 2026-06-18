import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext.jsx';
import { loginCardEntrance, shakeError, buttonTap } from '../../utils/motionVariants.js';
import apiClient from '../../services/apiClient.js';
import './LoginPage.css';

const ROLES = [
  { id: 'CUSTOMER', icon: '🎬', label: 'Customer Portal', desc: 'Rental bookings & returns' },
  { id: 'ADMIN', icon: '⚡', label: 'Admin Dashboard', desc: 'Logistics & operations' },
];


export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedRole, setSelectedRole] = useState('ADMIN');
  const [mode, setMode] = useState('signin'); // 'signin' or 'signup'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  const selectGoogleAccount = useCallback(async (accountName, email) => {
    setGoogleLoading(true);
    setError('');
    try {
      await new Promise((r) => setTimeout(r, 600)); // Simulate Google validation delay
      const data = await apiClient.googleLogin(accountName, email);

      login(data.accessToken, data.user);

      const targetPath = (data.user.role === 'ADMIN' || data.user.role === 'EMPLOYEE') ? '/admin' : '/customer';
      navigate(targetPath, { replace: true });
    } catch (err) {
      setError(err.message || 'Google Sign-in failed. Please try again.');
      triggerShake();
    } finally {
      setGoogleLoading(false);
    }
  }, [login, navigate]);

  useEffect(() => {
    /* global google */
    if (typeof google !== 'undefined' && import.meta.env.VITE_GOOGLE_CLIENT_ID && selectedRole === 'CUSTOMER') {
      try {
        google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: async (response) => {
            setGoogleLoading(true);
            try {
              const base64Url = response.credential.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const payload = JSON.parse(window.atob(base64));
              await selectGoogleAccount(payload.name, payload.email);
            } catch (err) {
              setError('Failed to process Google login.');
            } finally {
              setGoogleLoading(false);
            }
          }
        });

        const btnContainer = document.getElementById('official-google-btn-container');
        if (btnContainer) {
          google.accounts.id.renderButton(
            btnContainer,
            {
              theme: 'outline',
              size: 'large',
              width: btnContainer.clientWidth || 360,
              text: 'signin_with'
            }
          );
        }
      } catch (err) {
        console.error('Google GSI rendering failed:', err);
      }
    }
  }, [selectGoogleAccount, selectedRole]);

  const handleRoleSwitch = (roleId) => {
    setSelectedRole(roleId);
    setMode('signin');
    setEmail('');
    setPassword('');
    setName('');
    setPhone('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required.');
      triggerShake();
      return;
    }

    if (mode === 'signup' && (!name || !phone)) {
      setError('All fields are required.');
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      let data;
      if (mode === 'signin') {
        data = await apiClient.login(email, password);
      } else {
        data = await apiClient.register({ name, email, password, role: selectedRole, phone });
      }
      const { accessToken, user } = data;

      // Role mismatch guard
      const isRoleMatched = (selectedRole === 'ADMIN' && (user.role === 'ADMIN' || user.role === 'EMPLOYEE')) ||
        (selectedRole === 'CUSTOMER' && user.role === 'CUSTOMER');
      if (!isRoleMatched) {
        setError(`This account is registered as ${user.role}. Please select the correct portal tab.`);
        triggerShake();
        return;
      }

      login(accessToken, user);
      const from = location.state?.from?.pathname || ((user.role === 'ADMIN' || user.role === 'EMPLOYEE') ? '/admin' : '/customer');
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
        {/* Header */}
        <div className="login-card__header">
          <div className="login-card__logo">SD</div>
          <h1 className="login-card__title">SD Digitals</h1>
          <p className="login-card__subtitle">Delivery &amp; Pickup Scheduler</p>
        </div>

        {/* Role-selection tabs */}
        <div className="login-card__tabs" role="tablist" aria-label="Select portal">
          {ROLES.map((role) => (
            <button
              key={role.id}
              id={`login-tab-${role.id.toLowerCase()}`}
              role="tab"
              aria-selected={selectedRole === role.id}
              className={`login-tab${selectedRole === role.id ? ' login-tab--active' : ''}`}
              onClick={() => handleRoleSwitch(role.id)}
            >
              <span className="login-tab__icon">{role.icon}</span>
              <span className="login-tab__label">{role.label}</span>
            </button>
          ))}
        </div>

        {/* Switcher between Login and Signup */}
        {selectedRole === 'CUSTOMER' && (
          <div className="login-mode-switcher">
            <button
              type="button"
              className={`login-mode-btn${mode === 'signin' ? ' active' : ''}`}
              onClick={() => { setMode('signin'); setError(''); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`login-mode-btn${mode === 'signup' ? ' active' : ''}`}
              onClick={() => { setMode('signup'); setError(''); }}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Form */}
        <div className="login-card__body">
          <AnimatePresence mode="wait">
            <motion.form
              key={`${selectedRole}-${mode}`}
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
              exit={{ opacity: 0 }}
            >
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
                  >
                    ⚠ {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {mode === 'signup' && (
                <>
                  <div className="login-form__group">
                    <label className="login-form__label" htmlFor="login-name">Full Name *</label>
                    <input
                      id="login-name"
                      type="text"
                      className="login-form__input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Priya Mehta"
                      required
                    />
                  </div>

                  <div className="login-form__group">
                    <label className="login-form__label" htmlFor="login-phone">Phone Number *</label>
                    <input
                      id="login-phone"
                      type="tel"
                      className="login-form__input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      required
                    />
                  </div>
                </>
              )}

              <div className="login-form__group">
                <label className="login-form__label" htmlFor="login-email">Email Address *</label>
                <input
                  id="login-email"
                  type="email"
                  className="login-form__input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`${selectedRole === 'ADMIN' ? 'admin' : 'customer'}@example.com`}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="login-form__group">
                <label className="login-form__label" htmlFor="login-password">Password *</label>
                <input
                  id="login-password"
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
                id="login-submit-btn"
                type="submit"
                className="login-form__submit"
                disabled={loading || googleLoading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? '⟳ Connecting…' : mode === 'signin' ? `Sign In as ${selectedRole === 'ADMIN' ? 'Admin' : 'Customer'} →` : `Sign Up as ${selectedRole === 'ADMIN' ? 'Admin' : 'Customer'} →`}
              </motion.button>
            </motion.form>
          </AnimatePresence>

          {selectedRole === 'CUSTOMER' && import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            <>
              <div className="login-form__separator">
                <span>or</span>
              </div>
              <div
                id="official-google-btn-container"
                style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '8px' }}
              ></div>
            </>
          )}
        </div>


      </motion.div>
    </div>
  );
}
