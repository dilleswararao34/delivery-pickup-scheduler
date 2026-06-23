import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bell, Clock, LogOut, User, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import './shared.css';

export default function Topbar({ alertCount = 0, bookingCount = 0, onAlertClick }) {
  const { user, isAdmin, isEmployee, logout } = useAuth();
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formattedTime = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day:     '2-digit',
    month:   'short',
    hour:    '2-digit',
    minute:  '2-digit',
    hour12:  true,
  }).format(time);

  const initials = user?.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'SD';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleProfileClick = () => {
    setDropdownOpen(false);
    navigate(isAdmin || isEmployee ? '/admin/profile' : '/customer/profile');
  };

  return (
    <header className="topbar" role="banner">
      {/* Live stats */}
      <div className="topbar__center">
        <div className="topbar__stat" title="Active bookings in the system">
          <span className="topbar__stat-dot" aria-hidden="true" />
          <span className="topbar__stat-label">Active Bookings</span>
          <span className="topbar__stat-value">{bookingCount}</span>
        </div>
        <div className="topbar__stat" title="Current time">
          <Clock size={14} className="topbar__stat-icon" />
          <span className="topbar__stat-value" style={{ color: 'var(--text-secondary)' }}>
            {formattedTime}
          </span>
        </div>
      </div>

      {/* Right controls */}
      <div className="topbar__right">
        <button
          id="topbar-alert-btn"
          className="topbar__alert-btn"
          onClick={onAlertClick}
          title={`${alertCount} system alert${alertCount !== 1 ? 's' : ''}`}
          aria-label={`View system alerts (${alertCount} active)`}
        >
          <Bell size={18} />
          {alertCount > 0 && (
            <span className="topbar__alert-badge" aria-hidden="true">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </button>

        {/* User Profile Dropdown */}
        <div className="topbar__operator-container" ref={dropdownRef}>
          <div 
            className="topbar__operator" 
            title={`Logged in as ${user?.name || 'User'}`} 
            role="button" 
            tabIndex={0}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            onKeyDown={(e) => e.key === 'Enter' && setDropdownOpen(!dropdownOpen)}
          >
            <div className="topbar__avatar" aria-hidden="true">{initials}</div>
            <span className="topbar__op-name">{user?.name || 'Staff Member'}</span>
            <ChevronDown size={14} className={`topbar__dropdown-arrow ${dropdownOpen ? 'rotated' : ''}`} />
          </div>

          {dropdownOpen && (
            <div className="topbar__dropdown-menu">
              <button onClick={handleProfileClick} className="topbar__dropdown-item">
                <User size={14} /> My Profile
              </button>
              <button onClick={handleLogout} className="topbar__dropdown-item logout">
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
