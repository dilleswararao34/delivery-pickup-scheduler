import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, Activity, Calendar, ClipboardList, Package, 
  Users, UserCheck, History, BookOpen, Camera, 
  MessageSquare, RotateCcw, LogOut, ChevronLeft, User, Bell, FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import './NavBar.css';

export default function NavBar({ alertCount = 0 }) {
  const { user, isAdmin, isEmployee, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close drawer on path change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Lock scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  // Click outside dropdown handler
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [dropdownOpen]);

  let links = [];
  if (isAdmin || isEmployee) {
    links = [
      { to: '/admin',            label: 'Live Logistics',  icon: <Activity size={18} />, end: true  },
      { to: '/admin/scheduler',  label: 'Scheduler',       icon: <Calendar size={18} /> },
      { to: '/admin/intake',     label: 'Intake Command',  icon: <ClipboardList size={18} /> },
      { to: '/admin/equipment',  label: 'Equipment',       icon: <Package size={18} /> },
    ];
    if (isAdmin) {
      links.push({ to: '/admin/employees',     label: 'Employees',   icon: <Users size={18} /> });
      links.push({ to: '/admin/customers',     label: 'Customers',   icon: <UserCheck size={18} /> });
      links.push({ to: '/admin/quotations',    label: 'Quotations',  icon: <FileText size={18} /> });
      links.push({ to: '/admin/activity-logs', label: 'Audit Logs',  icon: <History size={18} /> });
    }
    links.push({ to: '/admin/profile', label: 'My Profile', icon: <User size={18} /> });
  } else {
    links = [
      { to: '/customer',          label: 'My Bookings',   icon: <BookOpen size={18} />, end: true },
      { to: '/customer/quotations',label: 'My Quotations', icon: <FileText size={18} /> },
      { to: '/customer/browse',   label: 'Browse Gear',   icon: <Camera size={18} /> },
      { to: '/customer/quote',    label: 'Request Quote', icon: <MessageSquare size={18} /> },
      { to: '/customer/returns',  label: 'Return Log',    icon: <RotateCcw size={18} /> },
      { to: '/customer/profile',  label: 'My Profile',    icon: <User size={18} /> },
    ];
  }

  const initials = user?.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'SD';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const showBackButton = location.pathname !== '/admin' && location.pathname !== '/customer' && location.pathname !== '/login';

  return (
    <>
      <nav className="navbar" role="navigation" aria-label="Main navigation">
        <div className="navbar__left-group">
          {/* Hamburger Menu Trigger - Visible Always */}
          <button
            className="navbar__hamburger-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
          >
            <Menu size={20} />
          </button>

          {showBackButton && (
            <button
              className="navbar__back-btn"
              onClick={() => navigate(-1)}
              title="Go Back"
              aria-label="Go Back"
            >
              <ChevronLeft size={16} />
            </button>
          )}

          {/* Brand */}
          <div 
            className="navbar__brand" 
            onClick={() => navigate(isAdmin || isEmployee ? '/admin' : '/customer/browse')} 
            role="link" 
            tabIndex={0} 
            aria-label="Go to home dashboard"
          >
            <div className="navbar__logo">SD</div>
            <div className="navbar__brand-text">
              <span className="navbar__brand-name">SD Digitals</span>
              <span className="navbar__brand-sub">NCR Scheduler</span>
            </div>
          </div>
        </div>

        {/* Right Section info */}
        <div className="navbar__right">
          {/* Alert Bell — admin/employee only */}
          {(isAdmin || isEmployee) && (
            <button
              className="navbar__alert-btn"
              onClick={() => navigate('/admin/alerts')}
              title={alertCount > 0 ? `${alertCount} active alert${alertCount !== 1 ? 's' : ''}` : 'No active alerts'}
              aria-label={`View system alerts (${alertCount} active)`}
            >
              <Bell size={18} />
              {alertCount > 0 && (
                <span className="navbar__alert-badge" aria-hidden="true">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </button>
          )}
          <span className={`navbar__role-badge navbar__role-badge--${isAdmin ? 'admin' : isEmployee ? 'employee' : 'customer'}`}>
            {isAdmin ? 'Admin' : isEmployee ? 'Employee' : 'Customer'}
          </span>
          <div ref={dropdownRef} className="navbar__user-container" style={{ position: 'relative' }}>
            <div 
              className="navbar__user" 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', userSelect: 'none' }}
              role="button"
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
            >
              <div className="navbar__avatar">{initials}</div>
              <span className="navbar__user-name">{user?.name}</span>
            </div>
            
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div 
                  className="navbar__dropdown"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.15 }}
                >
                  <button className="navbar__dropdown-item" onClick={() => { setDropdownOpen(false); navigate(isAdmin || isEmployee ? '/admin/profile' : '/customer/profile'); }}>
                    My Profile
                  </button>
                  <div className="navbar__dropdown-divider" />
                  <button className="navbar__dropdown-item" onClick={handleLogout} style={{ color: 'var(--red)' }}>
                    Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>

      {/* Global Sidebar Menu Drawer overlay */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div 
              className="navbar__overlay-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />

            {/* Sidebar drawer content */}
            <motion.aside 
              className="navbar__sidebar-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
            >
              <div className="navbar__sidebar-header">
                <div className="navbar__brand">
                  <div className="navbar__logo">SD</div>
                  <div className="navbar__brand-text">
                    <span className="navbar__brand-name">SD Digitals</span>
                    <span className="navbar__brand-sub">NCR Scheduler</span>
                  </div>
                </div>
                <button 
                  className="navbar__sidebar-close" 
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="navbar__sidebar-userinfo">
                <div className="navbar__avatar-large">{initials}</div>
                <div className="navbar__user-details">
                  <span className="navbar__user-fullname">{user?.name}</span>
                  <span className="navbar__user-email">{user?.email}</span>
                </div>
              </div>

              <nav className="navbar__sidebar-links" role="menu">
                {links.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      `navbar__sidebar-link${isActive ? ' active' : ''}`
                    }
                    role="menuitem"
                  >
                    <span className="navbar__sidebar-link-icon">{link.icon}</span>
                    <span className="navbar__sidebar-link-label">{link.label}</span>
                  </NavLink>
                ))}
              </nav>

              <div className="navbar__sidebar-footer">
                <button className="navbar__sidebar-logout" onClick={handleLogout}>
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

    </>
  );
}
