import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * ProtectedRoute
 * - If not authenticated → redirect to /login (with return URL)
 * - If authenticated but wrong role → redirect to their correct portal
 * - Otherwise → render children
 */
export default function ProtectedRoute({ children, role }) {
  const { isAuth, isAdmin, isEmployee, isCustomer } = useAuth();
  const location = useLocation();

  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Dashboard access (role === 'ADMIN' represents either Admin or Employee)
  if (role === 'ADMIN' && !isAdmin && !isEmployee) {
    return <Navigate to="/customer/browse" replace />;
  }

  if (role === 'CUSTOMER' && !isCustomer && !isAdmin && !isEmployee) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
