import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/shared/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage/LoginPage.jsx';
import StaffLoginPage from './pages/StaffLoginPage/StaffLoginPage.jsx';
import PublicCatalog from './pages/PublicCatalog/PublicCatalog.jsx';
import TermsOfService from './pages/InfoPages/TermsOfService.jsx';
import PrivacyPolicy from './pages/InfoPages/PrivacyPolicy.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';
import CustomerPortal from './pages/CustomerPortal/CustomerPortal.jsx';

// ── Animated route wrapper ────────────────────────────────────────────────────
function AnimatedRoutes() {
  const location = useLocation();
  const { isAuth, isAdmin, isEmployee } = useAuth();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>

        {/* Public Catalog Landing Page */}
        <Route path="/" element={<PublicCatalog />} />

        {/* Public Info Pages */}
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        {/* Customer Login / Signup */}
        <Route
          path="/login"
          element={
            isAuth
              ? <Navigate to={isAdmin || isEmployee ? '/admin' : '/customer/browse'} replace />
              : <LoginPage />
          }
        />

        {/* Staff-only secure login */}
        <Route
          path="/staff/login"
          element={
            isAuth
              ? <Navigate to={isAdmin || isEmployee ? '/admin' : '/customer/browse'} replace />
              : <StaffLoginPage />
          }
        />

        {/* Admin/Staff portal */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute role="ADMIN">
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Customer portal */}
        <Route
          path="/customer/*"
          element={
            <ProtectedRoute role="CUSTOMER">
              <CustomerPortal />
            </ProtectedRoute>
          }
        />

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </AnimatePresence>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
