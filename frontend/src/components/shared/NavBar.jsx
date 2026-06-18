import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext.jsx';
import { navItemHover } from '../../utils/motionVariants.js';
import './NavBar.css';

const ADMIN_LINKS = [
  { to: '/admin',            label: '📊 Live Logistics',  end: true  },
  { to: '/admin/scheduler',  label: '📅 Scheduler'                   },
  { to: '/admin/intake',     label: '✍ Intake Command'              },
  { to: '/admin/equipment',  label: '📦 Equipment'                   },
  { to: '/admin/alerts',     label: '🔔 Alerts'                      },
];

const CUSTOMER_LINKS = [
  { to: '/customer',         label: '📋 My Bookings', end: true },
  { to: '/customer/browse',  label: '🎬 Browse Gear'            },
  { to: '/customer/quote',   label: '💬 Request Quote'          },
  { to: '/customer/returns',  label: '↩ Return Log'             },
];

export default function NavBar() {
  const { user, isAdmin, isEmployee, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  let links = [];
  if (isAdmin || isEmployee) {
    links = [
      { to: '/admin',            label: '📊 Live Logistics',  end: true  },
      { to: '/admin/scheduler',  label: '📅 Scheduler'                   },
      { to: '/admin/intake',     label: '✍ Intake Command'              },
      { to: '/admin/equipment',  label: '📦 Equipment'                   },
      { to: '/admin/alerts',     label: '🔔 Alerts'                      },
    ];
    if (isAdmin) {
      links.push({ to: '/admin/employees',     label: '👥 Employees'      });
      links.push({ to: '/admin/customers',     label: '👤 Customers'      });
      links.push({ to: '/admin/activity-logs', label: '📜 Audit Logs'     });
    }
    links.push({ to: '/admin/profile',         label: '👤 Profile'        });
  } else {
    links = [
      { to: '/customer',         label: '📋 My Bookings', end: true },
      { to: '/customer/browse',  label: '🎬 Browse Gear'            },
      { to: '/customer/quote',   label: '💬 Request Quote'          },
      { to: '/customer/returns',  label: '↩ Return Log'             },
      { to: '/customer/profile', label: '👤 Profile'                },
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
        {showBackButton && (
          <button
            className="navbar__back-btn"
            onClick={() => navigate(-1)}
            title="Go Back"
            aria-label="Go Back"
          >
            ←
          </button>
        )}

        {/* Brand */}
        <div className="navbar__brand" onClick={() => navigate(isAdmin ? '/admin' : '/customer')} role="link" tabIndex={0} aria-label="Go to home dashboard">
          <div className="navbar__logo">SD</div>
          <div className="navbar__brand-text">
            <span className="navbar__brand-name">SD Digitals</span>
            <span className="navbar__brand-sub">Ops Scheduler</span>
          </div>
        </div>

        {/* Desktop nav links */}
        <div className="navbar__links" role="menubar">
          {links.map((link) => (
            <motion.div key={link.to} {...navItemHover}>
              <NavLink
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `navbar__link${isActive ? ' navbar__link--active' : ''}`
                }
                role="menuitem"
              >
                {link.label}
              </NavLink>
            </motion.div>
          ))}
        </div>

        {/* Right section */}
        <div className="navbar__right">
          <span className={`navbar__role-badge navbar__role-badge--${isAdmin ? 'admin' : isEmployee ? 'employee' : 'customer'}`}>
            {isAdmin ? 'Admin' : isEmployee ? 'Employee' : 'Customer'}
          </span>
          <div className="navbar__user">
            <div className="navbar__avatar">{initials}</div>
            <span className="navbar__user-name">{user?.name}</span>
          </div>
          <motion.button
            className="navbar__logout-btn"
            onClick={handleLogout}
            id="navbar-logout-btn"
            whileTap={{ scale: 0.95 }}
          >
            Sign Out
          </motion.button>
          {/* Hamburger */}
          <button
            className="navbar__hamburger"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={drawerOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div className={`navbar__drawer${drawerOpen ? ' open' : ''}`} role="menu">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `navbar__link${isActive ? ' navbar__link--active' : ''}`
            }
            onClick={() => setDrawerOpen(false)}
            role="menuitem"
          >
            {link.label}
          </NavLink>
        ))}
        <button className="navbar__logout-btn" onClick={handleLogout} style={{ width: '100%', marginTop: 8 }}>
          Sign Out
        </button>
      </div>
    </>
  );
}
