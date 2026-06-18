import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/shared/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage/LoginPage.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';
import CustomerPortal from './pages/CustomerPortal/CustomerPortal.jsx';

// ── Animated route wrapper ────────────────────────────────────────────────────
function AnimatedRoutes() {
  const location = useLocation();
  const { isAuth, isAdmin, isEmployee } = useAuth();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>

        {/* Public */}
        <Route
          path="/login"
          element={
            isAuth
              ? <Navigate to={isAdmin || isEmployee ? '/admin' : '/customer'} replace />
              : <LoginPage />
          }
        />



        {/* Admin portal */}
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

        {/* Root redirect */}
        <Route
          path="/"
          element={
            isAuth
              ? <Navigate to={isAdmin || isEmployee ? '/admin' : '/customer'} replace />
              : <Navigate to="/login" replace />
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
