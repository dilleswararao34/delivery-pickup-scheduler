import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

const TOKEN_KEY = 'sd_digitals_token';
const USER_KEY  = 'sd_digitals_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [user,  setUser]  = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const login = useCallback((accessToken, userData) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUserData) => {
    setUser((prevUser) => {
      const newUser = { ...prevUser, ...updatedUserData };
      localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      return newUser;
    });
  }, []);

  const isAdmin    = user?.role === 'ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';
  const isCustomer = user?.role === 'CUSTOMER';
  const isAuth     = !!token && !!user;

  return (
    <AuthContext.Provider value={{ token, user, login, logout, updateUser, isAdmin, isEmployee, isCustomer, isAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
