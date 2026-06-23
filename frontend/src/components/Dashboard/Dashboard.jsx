import React, { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Truck, CheckCircle, Hourglass, Package, RotateCcw,
  ChevronLeft, ChevronRight, TrendingUp, BarChart3,
  Plus, RefreshCw, Lock, FileText, AlertTriangle 
} from 'lucide-react';
import NavBar from '../shared/NavBar.jsx';
import LiveLogisticsGrid from '../LiveLogisticsGrid/LiveLogisticsGrid.jsx';
import IntakeCommand from '../IntakeCommand/IntakeCommand.jsx';
import OpsAssistant from '../OpsAssistant/OpsAssistant.jsx';
import DeepViewFlyout from '../DeepViewFlyout/DeepViewFlyout.jsx';
import { useBookings } from '../../hooks/useBookings.js';
import { useEquipment } from '../../hooks/useEquipment.js';
import { useAlerts } from '../../hooks/useAlerts.js';
import { pageTransition, statChipPop, staggerContainer } from '../../utils/motionVariants.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatCurrency } from '../../utils/dateFormat.js';
import apiClient from '../../services/apiClient.js';
import '../shared/shared.css';
import './Dashboard.css';

const getActionIcon = (action) => {
  if (action.includes('CREATE')) return <Plus size={14} />;
  if (action.includes('STATUS')) return <RefreshCw size={14} />;
  if (action.includes('DAMAGE') || action.includes('REPORT')) return <AlertTriangle size={14} />;
  if (action.includes('PASSWORD')) return <Lock size={14} />;
  return <FileText size={14} />;
};

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine subview based on pathname
  let currentView = 'logistics'; // 'logistics', 'equipment', 'alerts', 'intake', 'employees', 'customers', 'activity-logs', 'profile'
  if (location.pathname.endsWith('/equipment')) {
    currentView = 'equipment';
  } else if (location.pathname.endsWith('/scheduler')) {
    currentView = 'scheduler';
  } else if (location.pathname.endsWith('/alerts')) {
    currentView = 'alerts';
  } else if (location.pathname.endsWith('/intake')) {
    currentView = 'intake';
  } else if (location.pathname.endsWith('/employees')) {
    currentView = 'employees';
  } else if (location.pathname.endsWith('/customers')) {
    currentView = 'customers';
  } else if (location.pathname.endsWith('/activity-logs')) {
    currentView = 'activity-logs';
  } else if (location.pathname.endsWith('/profile')) {
    currentView = 'profile';
  }

  const {
    bookings, loading: bookingsLoading, error: bookingsError,
    filters, refresh: refreshBookings, createBooking: createBookingRaw, updateStatus: updateStatusRaw, applyFilter,
  } = useBookings();

  const { equipment, updateStatus: updateEquipmentStatusRaw, refresh: refreshEquipment } = useEquipment();
  const { alerts, loading: alertsLoading, criticalCount, highCount, dismissAlert: dismissAlertRaw, refresh: refreshAlerts } = useAlerts();

  // State: Dashboard Stats
  const [dashboardStats, setDashboardStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchDashboardStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await apiClient.getDashboard();
      if (res.success && res.data) {
        setDashboardStats(res.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard stats', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([
      refreshBookings(),
      fetchDashboardStats(),
      refreshEquipment(),
      refreshAlerts()
    ]);
  }, [refreshBookings, fetchDashboardStats, refreshEquipment, refreshAlerts]);

  const updateStatus = useCallback(async (id, payload) => {
    const data = await updateStatusRaw(id, payload);
    await refresh();
    return data;
  }, [updateStatusRaw, refresh]);

  const createBooking = useCallback(async (payload) => {
    const data = await createBookingRaw(payload);
    await refresh();
    return data;
  }, [createBookingRaw, refresh]);

  const updateEquipmentStatus = useCallback(async (id, status) => {
    await updateEquipmentStatusRaw(id, status);
    await refresh();
  }, [updateEquipmentStatusRaw, refresh]);

  const dismissAlert = useCallback(async (alertId) => {
    await dismissAlertRaw(alertId);
    await refresh();
  }, [dismissAlertRaw, refresh]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  // State: Add Equipment Modal
  const [showAddEquip, setShowAddEquip] = useState(false);
  const [eqForm, setEqForm] = useState({ serial_number: '', name: '', category: 'Cinema Camera', brand: '', model_number: '', rental_rate_per_day: '', replacement_value: '', description: '', notes: '' });

  // Equipment Registry Filter States
  const [eqSearchTerm, setEqSearchTerm] = useState('');
  const [eqCategoryFilter, setEqCategoryFilter] = useState('');
  const [eqStatusFilter, setEqStatusFilter] = useState('');

  // Calendar Scheduler States
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  // State: Employees management
  const [employees, setEmployees] = useState([]);
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [empForm, setEmpForm] = useState({ name: '', email: '', password: '' });
  const [forceResetId, setForceResetId] = useState(null);
  const [tempPassword, setTempPassword] = useState('');

  // State: Audit Logs
  const [logs, setLogs] = useState([]);
  const [logFilterUser, setLogFilterUser] = useState('');
  const [logFilterDate, setLogFilterDate] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);

  // State: Customers
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  // State: Profiles & Passwords
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [adminName, setAdminName] = useState('');

  // Toast message
  const [toast, setToast] = useState(null);
  const showToast = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const [flyoutId, setFlyoutId] = useState(null);

  const openFlyout  = useCallback((booking) => setFlyoutId(booking.booking_id), []);
  const closeFlyout = useCallback(() => setFlyoutId(null), []);

  const { user, isAdmin, isEmployee, updateUser } = useAuth();

  // Load employees list
  const fetchEmployeesList = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await apiClient.listEmployees();
      setEmployees(res.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to load employees', 'error');
    }
  }, [isAdmin]);

  // Load customers list
  const fetchCustomersList = useCallback(async () => {
    if (!isAdmin) return;
    setCustomersLoading(true);
    try {
      const res = await apiClient.getCustomers();
      setCustomers(res.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to load customers', 'error');
    } finally {
      setCustomersLoading(false);
    }
  }, [isAdmin]);

  // Load activity logs
  const fetchActivityLogs = useCallback(async () => {
    if (!isAdmin) return;
    setLogsLoading(true);
    try {
      const params = {};
      if (logFilterUser) params.userId = logFilterUser;
      if (logFilterDate) params.dateFrom = logFilterDate;
      const res = await apiClient.getActivityLogs(params);
      setLogs(res.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to load activity logs', 'error');
    } finally {
      setLogsLoading(false);
    }
  }, [isAdmin, logFilterUser, logFilterDate]);

  useEffect(() => {
    if (currentView === 'employees') fetchEmployeesList();
    if (currentView === 'customers') fetchCustomersList();
    if (currentView === 'activity-logs') fetchActivityLogs();
    if (currentView === 'profile' && user) setAdminName(user.name);
  }, [currentView, fetchEmployeesList, fetchCustomersList, fetchActivityLogs, user]);

  const handleEqSubmit = async (e) => {
    e.preventDefault();
    try {
      const rate = parseFloat(eqForm.rental_rate_per_day);
      const replacement = parseFloat(eqForm.replacement_value);
      if (isNaN(rate) || rate < 0) throw new Error('Rental rate must be a positive number');
      
      await apiClient.createEquipment({
        ...eqForm,
        rental_rate_per_day: rate,
        replacement_value: isNaN(replacement) ? null : replacement
      });
      showToast('Equipment added successfully!');
      setShowAddEquip(false);
      setEqForm({ serial_number: '', name: '', category: 'Cinema Camera', brand: '', model_number: '', rental_rate_per_day: '', replacement_value: '', description: '', notes: '' });
      refreshEquipment();
    } catch (err) {
      showToast(err.message || 'Failed to add equipment', 'error');
    }
  };

  const handleEmpSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.createEmployee(empForm);
      showToast('Employee created successfully!');
      setShowAddEmp(false);
      setEmpForm({ name: '', email: '', password: '' });
      fetchEmployeesList();
    } catch (err) {
      showToast(err.message || 'Failed to create employee', 'error');
    }
  };

  const handleToggleEmpStatus = async (empId, currentStatus) => {
    if (currentStatus) {
      const confirmDeactivate = window.confirm("Are you sure you want to deactivate this employee account? They will lose access immediately.");
      if (!confirmDeactivate) return;
    }
    try {
      await apiClient.updateEmployeeStatus(empId, !currentStatus);
      showToast(`Employee ${currentStatus ? 'deactivated' : 'activated'} successfully!`);
      fetchEmployeesList();
    } catch (err) {
      showToast(err.message || 'Failed to update employee status', 'error');
    }
  };

  const handleForceResetPassword = async (e) => {
    e.preventDefault();
    const confirmReset = window.confirm("Are you sure you want to change this employee's password? Their previous credentials will no longer work.");
    if (!confirmReset) return;
    try {
      await apiClient.forcePasswordReset(forceResetId, tempPassword);
      showToast('Password reset successfully!');
      setForceResetId(null);
      setTempPassword('');
    } catch (err) {
      showToast(err.message || 'Failed to reset password', 'error');
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.updateProfile({ name: adminName });
      updateUser({ name: adminName });
      showToast('Profile updated successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to update profile', 'error');
    }
  };

  const handlePwdSubmit = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }
    try {
      await apiClient.changePassword(pwdForm.oldPassword, pwdForm.newPassword);
      showToast('Password updated successfully!');
      setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast(err.message || 'Failed to change password', 'error');
    }
  };

  const handleStatClick = useCallback((stat) => {
    if (stat.action === 'alerts') {
      navigate('/admin/alerts');
    } else {
      if (currentView !== 'logistics') {
        navigate('/admin');
      }
      applyFilter({ status: stat.filterValue || undefined });
    }
  }, [currentView, navigate, applyFilter]);

  // Booking status counts
  const liveCount      = dashboardStats
    ? (dashboardStats.bookings?.by_status?.['OUT_FOR_DELIVERY'] || 0)
    : bookings.filter((b) => b.status === 'OUT_FOR_DELIVERY').length;

  const awaitingCount  = dashboardStats
    ? (dashboardStats.bookings?.by_status?.['AWAITING_PICKUP'] || 0)
    : bookings.filter((b) => b.status === 'AWAITING_PICKUP').length;

  const confirmedCount = dashboardStats
    ? (dashboardStats.bookings?.by_status?.['CONFIRMED'] || 0)
    : bookings.filter((b) => b.status === 'CONFIRMED').length;

  const returnedCount  = dashboardStats
    ? (dashboardStats.bookings?.by_status?.['PICKED_UP_AND_RETURNED'] || 0)
    : bookings.filter((b) => b.status === 'PICKED_UP_AND_RETURNED').length;

  const totalAlertCount = dashboardStats
    ? (dashboardStats.alerts?.total_active || 0)
    : (criticalCount + highCount);

  // KPIs
  const activeBookingsCount = dashboardStats
    ? (
        (dashboardStats.bookings?.by_status?.['CONFIRMED'] || 0) +
        (dashboardStats.bookings?.by_status?.['OUT_FOR_DELIVERY'] || 0) +
        (dashboardStats.bookings?.by_status?.['DELIVERED'] || 0) +
        (dashboardStats.bookings?.by_status?.['AWAITING_PICKUP'] || 0)
      )
    : bookings.filter((b) =>
        ['CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'AWAITING_PICKUP'].includes(b.status)
      ).length;

  const overdueReturnsCount = dashboardStats
    ? (dashboardStats.bookings?.overdue_returns || 0)
    : bookings.filter((b) =>
        ['AWAITING_PICKUP', 'DELIVERED'].includes(b.status) && b.scheduled_return_date && new Date(b.scheduled_return_date) < new Date()
      ).length;

  const totalEquipmentCount = dashboardStats
    ? (dashboardStats.equipment?.total || 0)
    : equipment.length;

  const utilizedEquipmentCount = dashboardStats
    ? (
        (dashboardStats.equipment?.by_status?.['OUT_ON_HIRE'] || 0) +
        (dashboardStats.equipment?.by_status?.['RESERVED'] || 0)
      )
    : equipment.filter((eq) => ['OUT_ON_HIRE', 'RESERVED'].includes(eq.status)).length;

  const equipmentUtilization = totalEquipmentCount > 0
    ? Math.round((utilizedEquipmentCount / totalEquipmentCount) * 100)
    : 0;

  const totalBookingsCount = dashboardStats
    ? (dashboardStats.bookings?.total || 0)
    : bookings.length;

  // Filtered equipment catalog
  const filteredEquipment = equipment.filter((eq) => {
    const matchesSearch = eq.name.toLowerCase().includes(eqSearchTerm.toLowerCase()) || 
                          eq.serial_number.toLowerCase().includes(eqSearchTerm.toLowerCase()) ||
                          eq.brand.toLowerCase().includes(eqSearchTerm.toLowerCase()) ||
                          eq.model_number.toLowerCase().includes(eqSearchTerm.toLowerCase());
    const matchesCategory = eqCategoryFilter ? eq.category === eqCategoryFilter : true;
    const matchesStatus = eqStatusFilter ? eq.status === eqStatusFilter : true;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getEventsForDate = (date) => {
    if (!date) return [];
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const targetStr = `${yyyy}-${mm}-${dd}`;

    const events = [];
    bookings.forEach((b) => {
      if (b.scheduled_delivery_date) {
        const dStr = b.scheduled_delivery_date.slice(0, 10);
        if (dStr === targetStr) {
          events.push({ type: 'delivery', booking: b });
        }
      }
      if (b.scheduled_return_date) {
        const rStr = b.scheduled_return_date.slice(0, 10);
        if (rStr === targetStr) {
          events.push({ type: 'return', booking: b });
        }
      }
    });
    return events;
  };

  const calendarCells = [];
  const daysInMonthIndex = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayIndex = new Date(calYear, calMonth, 1).getDay();

  // Padding cells
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  // Days of month
  for (let d = 1; d <= daysInMonthIndex; d++) {
    calendarCells.push(new Date(calYear, calMonth, d));
  }

  const stats = [
    { icon: <Truck size={14} />, label: 'In Transit',      value: liveCount,        mod: 'live',  filterValue: 'OUT_FOR_DELIVERY' },
    { icon: <CheckCircle size={14} />, label: 'Confirmed',        value: confirmedCount,   mod: 'ok',    filterValue: 'CONFIRMED' },
    { icon: <Hourglass size={14} />, label: 'Awaiting Pickup',  value: awaitingCount,    mod: 'warn',  filterValue: 'AWAITING_PICKUP' },
    { icon: <Package size={14} />, label: 'Total Bookings',   value: totalBookingsCount,  mod: '',      filterValue: '' },
    { icon: <RotateCcw size={14} />,  label: 'Returned',         value: returnedCount,    mod: 'ok',    filterValue: 'PICKED_UP_AND_RETURNED' },
  ];

  return (
    <motion.div
      className="dashboard"
      id="sd-digitals-dashboard"
      variants={pageTransition}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* ── NavBar with integrated alert bell ─────────────────────────────── */}
      <NavBar alertCount={totalAlertCount} />

      {/* ── Stats Bar ────────────────────────────────────────────────────────── */}
      <motion.div
        className="dashboard__stats"
        role="region"
        aria-label="Booking statistics"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {stats.map((s) => {
          const isActive = s.action === 'alerts'
            ? currentView === 'alerts'
            : currentView === 'logistics' && (filters?.status === s.filterValue || (s.filterValue === '' && !filters?.status));

          return (
            <motion.div
              key={s.label}
              className={`stat-chip${s.mod ? ` stat-chip--${s.mod}` : ''}${isActive ? ' stat-chip--active' : ''}`}
              variants={statChipPop}
              onClick={() => handleStatClick(s)}
              onKeyDown={(e) => e.key === 'Enter' && handleStatClick(s)}
              tabIndex={0}
              role="button"
              aria-label={`Filter bookings by ${s.label}`}
            >
              <span className="stat-chip__icon">{s.icon}</span>
              <div>
                <div className="stat-chip__label">{s.label}</div>
                <div className="stat-chip__value">{s.value}</div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ── Main body ──────────────────────────────────────────────────────────── */}
      <main className="dashboard__body" role="main" style={{ display: (currentView === 'logistics' || currentView === 'intake') ? 'flex' : 'block' }}>
        {currentView === 'equipment' && (
          <div className="card animate-in" style={{ padding: 'var(--space-6)', background: 'var(--bg-secondary)', width: '100%', minHeight: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>Equipment Registry</h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Manage and inspect cinema camera rental inventory</p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowAddEquip(true)}>
                + Add Equipment
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '200px', display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  type="text"
                  placeholder="Search equipment by name, serial, model..."
                  value={eqSearchTerm}
                  onChange={(e) => setEqSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <select
                  value={eqCategoryFilter}
                  onChange={(e) => setEqCategoryFilter(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                >
                  <option value="">All Categories</option>
                  <option value="Cinema Camera">Cinema Camera</option>
                  <option value="Lens">Lens</option>
                  <option value="Stabilizer">Stabilizer</option>
                  <option value="Lighting">Lighting</option>
                  <option value="Audio">Audio</option>
                  <option value="Drone">Drone</option>
                </select>
                <select
                  value={eqStatusFilter}
                  onChange={(e) => setEqStatusFilter(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                >
                  <option value="">All Statuses</option>
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="RESERVED">RESERVED</option>
                  <option value="OUT_ON_HIRE">OUT ON HIRE</option>
                  <option value="IN_MAINTENANCE">IN MAINTENANCE</option>
                  <option value="RETIRED">RETIRED</option>
                </select>
                {(eqSearchTerm || eqCategoryFilter || eqStatusFilter) && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEqSearchTerm('');
                      setEqCategoryFilter('');
                      setEqStatusFilter('');
                    }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Name</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Category</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Serial Number</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Brand / Model</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Rate / Day</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEquipment.map((eq) => (
                    <tr key={eq.equipment_id || eq.id} style={{ borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                      <td style={{ padding: 'var(--space-4)', fontWeight: 600, color: 'var(--text-primary)' }}>{eq.name}</td>
                      <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)' }}>{eq.category}</td>
                      <td style={{ padding: 'var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>{eq.serial_number}</td>
                      <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)' }}>{eq.brand} · {eq.model_number}</td>
                      <td style={{ padding: 'var(--space-4)', fontWeight: 600, color: 'var(--blue)' }}>{formatCurrency(eq.rental_rate_per_day)}</td>
                      <td style={{ padding: 'var(--space-4)' }}>
                        <select
                          value={eq.status}
                          onChange={(e) => updateEquipmentStatus(eq.equipment_id || eq.id, e.target.value)}
                          className={`status-badge status-badge--${eq.status.toLowerCase()}`}
                          style={{
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '4px 8px',
                            background: 'var(--bg-tertiary)',
                            cursor: 'pointer',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 600,
                            outline: 'none',
                          }}
                        >
                          <option value="AVAILABLE">AVAILABLE</option>
                          <option value="OUT_ON_HIRE">OUT ON HIRE</option>
                          <option value="UNDER_MAINTENANCE">UNDER MAINTENANCE</option>
                          <option value="OUT_OF_SERVICE">OUT OF SERVICE</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentView === 'scheduler' && (
          <div className="card animate-in" style={{ padding: 'var(--space-6)', background: 'var(--bg-secondary)', width: '100%', minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>Operations Calendar</h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Track scheduled deliveries and returns over time</p>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <button className="btn btn-ghost" onClick={handlePrevMonth} style={{ fontSize: 'var(--text-md)', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronLeft size={16} /></button>
                <span style={{ fontSize: 'var(--text-md)', fontWeight: 700, minWidth: '140px', textAlign: 'center', color: 'var(--text-primary)' }}>
                  {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][calMonth]} {calYear}
                </span>
                <button className="btn btn-ghost" onClick={handleNextMonth} style={{ fontSize: 'var(--text-md)', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronRight size={16} /></button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: 'var(--space-2)' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', padding: 'var(--space-1) 0' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(120px, 1fr)', gap: '4px', background: 'var(--border)', padding: '1px', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                {calendarCells.map((date, idx) => {
                  const dayEvents = getEventsForDate(date);
                  const isToday = date && date.toDateString() === new Date().toDateString();

                  return (
                    <div
                      key={idx}
                      style={{
                        background: date ? (isToday ? 'var(--bg-elevated)' : 'var(--bg-secondary)') : 'var(--bg-tertiary)',
                        padding: 'var(--space-2)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        position: 'relative',
                        border: isToday ? '1px solid var(--blue)' : 'none',
                        minHeight: '120px'
                      }}
                    >
                      {date && (
                        <span style={{
                          alignSelf: 'flex-end',
                          fontSize: 'var(--text-xs)',
                          fontWeight: isToday ? 700 : 500,
                          color: isToday ? 'var(--blue)' : 'var(--text-secondary)',
                          background: isToday ? 'var(--blue-soft)' : 'transparent',
                          width: '20px',
                          height: '20px',
                          borderRadius: 'var(--radius-full)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {date.getDate()}
                        </span>
                      )}

                      {/* Day Events List */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', maxHeight: '100px' }}>
                        {dayEvents.map((evt, eIdx) => {
                          const isDelivery = evt.type === 'delivery';
                          const isReturnedStatus = evt.booking.status === 'PICKED_UP_AND_RETURNED';
                          const ref = evt.booking.booking_ref;
                          const client = evt.booking.customer_name || 'Client';

                          // Styles based on delivery/return
                          const bg = isDelivery ? 'var(--blue-soft)' : (isReturnedStatus ? 'var(--green-soft)' : 'var(--amber-soft)');
                          const border = isDelivery ? '1px solid var(--blue)' : (isReturnedStatus ? '1px solid var(--green)' : '1px solid var(--amber)');
                          const color = isDelivery ? 'var(--blue)' : (isReturnedStatus ? 'var(--green)' : 'var(--amber)');

                          return (
                            <div
                              key={eIdx}
                              onClick={() => openFlyout(evt.booking)}
                              style={{
                                background: bg,
                                border: border,
                                color: color,
                                padding: '4px 6px',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'transform 0.1s'
                              }}
                              title={`${isDelivery ? 'Delivery' : 'Return'} - ${ref} (${client})`}
                            >
                              <span>{isDelivery ? <Truck size={10} /> : <RotateCcw size={10} />}</span>
                              <span>{ref}</span>
                              <span style={{ opacity: 0.8, fontWeight: 400 }}>· {client}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {currentView === 'alerts' && (
          <div className="card animate-in" style={{ padding: 'var(--space-6)', background: 'var(--bg-secondary)', width: '100%', minHeight: '400px' }}>
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>System Alerts</h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Real-time conflicts, overdue pickups, and warnings</p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-tertiary)' }}>
                  <div style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'center' }}>
                    <CheckCircle size={36} style={{ color: 'var(--color-brass)' }} />
                  </div>
                  <p>All clear! No active system alerts.</p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.alert_id || alert.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-4) var(--space-5)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      background: alert.priority === 'CRITICAL' ? 'var(--red-soft)' : alert.priority === 'HIGH' ? 'var(--amber-soft)' : 'var(--blue-soft)',
                      borderColor: alert.priority === 'CRITICAL' ? 'var(--red)' : alert.priority === 'HIGH' ? 'var(--amber)' : 'var(--blue)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <span style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: alert.priority === 'CRITICAL' ? 'var(--red)' : alert.priority === 'HIGH' ? 'var(--amber)' : 'var(--blue)',
                        color: '#fff',
                      }}>
                        {alert.priority}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{alert.message}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                          Triggered by {alert.trigger_type} · Entity: {alert.related_entity}
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => dismissAlert(alert.alert_id || alert.id)}
                    >
                      Dismiss
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {currentView === 'logistics' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', gap: 'var(--space-3)' }}>
            {/* KPI Cards Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)', flexShrink: 0 }}>
              <div className="card" style={{ padding: 'var(--space-4) var(--space-5)', background: 'linear-gradient(135deg, var(--blue-soft), var(--bg-secondary))', border: '1px solid var(--blue)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}><TrendingUp size={12} /> Active Bookings</span>
                <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)' }}>{activeBookingsCount}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Confirmed & In-Transit orders</span>
              </div>
              <div className="card" style={{ padding: 'var(--space-4) var(--space-5)', background: 'linear-gradient(135deg, var(--red-soft), var(--bg-secondary))', border: '1px solid var(--red)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> Overdue Returns</span>
                <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--red)' }}>{overdueReturnsCount}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Orders past return window</span>
              </div>
              <div className="card" style={{ padding: 'var(--space-4) var(--space-5)', background: 'linear-gradient(135deg, var(--cyan-soft), var(--bg-secondary))', border: '1px solid var(--cyan)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}><BarChart3 size={12} /> Gear Utilization</span>
                <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--cyan)' }}>{equipmentUtilization}%</span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{utilizedEquipmentCount} of {totalEquipmentCount} items out/reserved</span>
              </div>
            </div>
            {/* Columns wrapper */}
            <div style={{ display: 'flex', flex: 1, gap: 'var(--space-3)', minHeight: 0, overflow: 'hidden' }}>
              {/* Left column */}
              <div className="dashboard__left">
                <div className="dashboard__grid-pane">
                  <LiveLogisticsGrid
                    bookings={bookings}
                    loading={bookingsLoading}
                    error={bookingsError}
                    onRowClick={openFlyout}
                    selectedId={flyoutId}
                    onFilterChange={applyFilter}
                    onRefresh={refresh}
                    activeFilter={filters?.status || ''}
                  />
                </div>
              </div>

              {/* Right column — Ops Assistant */}
              <div className="dashboard__right">
                <OpsAssistant
                  alerts={alerts}
                  loading={alertsLoading}
                  onDismiss={dismissAlert}
                />
              </div>
            </div>
          </div>
        )}

        {currentView === 'intake' && (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', height: '100%', overflowY: 'auto' }}>
            <div style={{ width: '100%', maxWidth: '800px', height: '100%' }}>
              <IntakeCommand
                equipment={equipment}
                onBookingCreate={createBooking}
              />
            </div>
          </div>
        )}

        {currentView === 'employees' && (
          <div className="card animate-in" style={{ padding: 'var(--space-6)', background: 'var(--bg-secondary)', width: '100%', minHeight: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>Employee Manager</h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Manage staff accounts and reset credentials</p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowAddEmp(true)}>
                + Add Employee
              </button>
            </div>
            
            {!isAdmin ? (
              <div style={{ padding: 'var(--space-4)', background: 'var(--red-soft)', color: 'var(--red)', borderRadius: 'var(--radius-md)' }}>
                Access Restricted: Only Super Admin can manage employee accounts.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Name</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Role</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.user_id} style={{ borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                        <td style={{ padding: 'var(--space-4)', fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</td>
                        <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)' }}>{emp.email}</td>
                        <td style={{ padding: 'var(--space-4)' }}>
                          <span style={{
                            fontSize: 'var(--text-xs)',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            background: emp.role === 'ADMIN' ? 'var(--purple-soft)' : 'var(--blue-soft)',
                            color: emp.role === 'ADMIN' ? 'var(--purple)' : 'var(--blue)'
                          }}>
                            {emp.role}
                          </span>
                        </td>
                        <td style={{ padding: 'var(--space-4)' }}>
                          <span style={{
                            fontSize: 'var(--text-xs)',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            background: emp.is_active ? 'var(--green-soft)' : 'var(--red-soft)',
                            color: emp.is_active ? 'var(--green)' : 'var(--red)'
                          }}>
                            {emp.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: 'var(--space-4)', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                            <button
                              className={`btn btn-sm ${emp.is_active ? 'btn-ghost' : 'btn-primary'}`}
                              onClick={() => handleToggleEmpStatus(emp.user_id, emp.is_active)}
                            >
                              {emp.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => {
                                setForceResetId(emp.user_id);
                                setTempPassword('');
                              }}
                            >
                              Reset PW
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {employees.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                          No staff accounts found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {currentView === 'customers' && (
          <div className="card animate-in" style={{ padding: 'var(--space-6)', background: 'var(--bg-secondary)', width: '100%', minHeight: '400px' }}>
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>Customers Directory</h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>View and search registered customer details</p>
            </div>
            
            {!isAdmin ? (
              <div style={{ padding: 'var(--space-4)', background: 'var(--red-soft)', color: 'var(--red)', borderRadius: 'var(--radius-md)' }}>
                Access Restricted: Only Super Admin can view customer profiles.
              </div>
            ) : customersLoading ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading customers...
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Name</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Phone</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Company</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Billing Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                        <td style={{ padding: 'var(--space-4)', fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</td>
                        <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)' }}>{c.email}</td>
                        <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)' }}>{c.phone || '—'}</td>
                        <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)' }}>{c.company || '—'}</td>
                        <td style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.billing_address}>
                          {c.billing_address || '—'}
                        </td>
                      </tr>
                    ))}
                    {customers.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                          No customers registered yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {currentView === 'activity-logs' && (
          <div className="card animate-in" style={{ padding: 'var(--space-6)', background: 'var(--bg-secondary)', width: '100%', minHeight: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>Console Audit Trail</h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Immutable history of operator activity and operations changes</p>
              </div>
              
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <label htmlFor="log-operator-select" style={{ margin: 0, whiteSpace: 'nowrap' }}>Operator:</label>
                  <select
                    id="log-operator-select"
                    value={logFilterUser}
                    onChange={(e) => setLogFilterUser(e.target.value)}
                    style={{ width: '180px', padding: '4px 10px', fontSize: 'var(--text-xs)' }}
                  >
                    <option value="">All Operators</option>
                    {employees.map((emp) => (
                      <option key={emp.user_id} value={emp.user_id}>{emp.name}</option>
                    ))}
                    {user && (
                      <option key={user.userId} value={user.userId}>{user.name} (Admin)</option>
                    )}
                  </select>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <label htmlFor="log-date-input" style={{ margin: 0, whiteSpace: 'nowrap' }}>Since:</label>
                  <input
                    id="log-date-input"
                    type="date"
                    value={logFilterDate}
                    onChange={(e) => setLogFilterDate(e.target.value)}
                    style={{ width: '140px', padding: '4px 10px', fontSize: 'var(--text-xs)' }}
                  />
                </div>
                
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setLogFilterUser('');
                    setLogFilterDate('');
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
            
            {!isAdmin ? (
              <div style={{ padding: 'var(--space-4)', background: 'var(--red-soft)', color: 'var(--red)', borderRadius: 'var(--radius-md)' }}>
                Access Restricted: Only Super Admin can view audit logs.
              </div>
            ) : logsLoading ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading activity logs...
              </div>
            ) : (
              <div className="audit-timeline">
                {logs.map((log) => {
                  return (
                    <div key={log.log_id} className="audit-item">
                      <div className="audit-icon">{getActionIcon(log.action)}</div>
                      <div className="audit-details">
                        <div className="audit-meta">
                          <span>{log.user_name} ({log.user_email})</span>
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="audit-title">
                          <span style={{
                            fontSize: 'var(--text-xs)',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border)',
                            marginRight: 'var(--space-2)'
                          }}>
                            {log.action}
                          </span>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                            {log.entity_type}{log.entity_id ? ` : ${log.entity_id}` : ''}
                          </span>
                        </div>
                        <div className="audit-desc">{log.details}</div>
                      </div>
                    </div>
                  );
                })}
                {logs.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-tertiary)' }}>
                    No audit logs matching selection.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {currentView === 'profile' && (
          <div className="card animate-in" style={{ padding: 'var(--space-6)', background: 'var(--bg-secondary)', width: '100%', minHeight: '400px' }}>
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>Profile & Settings</h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Update your display name and change password</p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-8)' }}>
              {/* Profile Info */}
              <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-2)' }}>Personal Information</h3>
                
                <div className="form-group">
                  <label htmlFor="profile-email-input">Email Address (Read-only)</label>
                  <input
                    id="profile-email-input"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    style={{ background: 'var(--bg-tertiary)', cursor: 'not-allowed' }}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="profile-name-input">Display Name</label>
                  <input
                    id="profile-name-input"
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                  />
                </div>
                
                <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                  Update Profile
                </button>
              </form>
              
              {/* Change Password */}
              <form onSubmit={handlePwdSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-2)' }}>Security Settings</h3>
                
                <div className="form-group">
                  <label htmlFor="old-password-input">Current Password</label>
                  <input
                    id="old-password-input"
                    type="password"
                    required
                    value={pwdForm.oldPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="new-password-input">New Password</label>
                  <input
                    id="new-password-input"
                    type="password"
                    required
                    value={pwdForm.newPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="confirm-password-input">Confirm New Password</label>
                  <input
                    id="confirm-password-input"
                    type="password"
                    required
                    value={pwdForm.confirmPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                  />
                </div>
                
                <button type="submit" className="btn btn-amber" style={{ alignSelf: 'flex-start' }}>
                  Update Password
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* ── Deep View Flyout ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {flyoutId && (
          <DeepViewFlyout
            bookingId={flyoutId}
            onClose={closeFlyout}
            onStatusUpdate={updateStatus}
          />
        )}
      </AnimatePresence>

      {/* ── Add Equipment Modal ────────────────────────────────────────────── */}
      {showAddEquip && (
        <div className="modal-backdrop" onClick={() => setShowAddEquip(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Equipment to Registry</h3>
              <button className="modal-close" onClick={() => setShowAddEquip(false)}>×</button>
            </div>
            <form onSubmit={handleEqSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="eq-serial-input">Serial Number *</label>
                    <input
                      id="eq-serial-input"
                      type="text"
                      required
                      placeholder="e.g. SNY-FX3-0041"
                      value={eqForm.serial_number}
                      onChange={(e) => setEqForm({ ...eqForm, serial_number: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="eq-name-input">Equipment Name *</label>
                    <input
                      id="eq-name-input"
                      type="text"
                      required
                      placeholder="e.g. Sony FX3 Camera"
                      value={eqForm.name}
                      onChange={(e) => setEqForm({ ...eqForm, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label htmlFor="eq-category-select">Category *</label>
                    <select
                      id="eq-category-select"
                      required
                      value={eqForm.category}
                      onChange={(e) => setEqForm({ ...eqForm, category: e.target.value })}
                    >
                      <option value="Cinema Camera">Cinema Camera</option>
                      <option value="Lens">Lens</option>
                      <option value="Stabilizer">Stabilizer</option>
                      <option value="Lighting">Lighting</option>
                      <option value="Audio">Audio</option>
                      <option value="Drone">Drone</option>
                      <option value="Accessories">Accessories</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="eq-brand-input">Brand *</label>
                    <input
                      id="eq-brand-input"
                      type="text"
                      required
                      placeholder="Sony"
                      value={eqForm.brand}
                      onChange={(e) => setEqForm({ ...eqForm, brand: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="eq-model-input">Model Number *</label>
                    <input
                      id="eq-model-input"
                      type="text"
                      required
                      placeholder="ILME-FX3"
                      value={eqForm.model_number}
                      onChange={(e) => setEqForm({ ...eqForm, model_number: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="eq-rate-input">Rental Rate / Day (₹) *</label>
                    <input
                      id="eq-rate-input"
                      type="number"
                      step="0.01"
                      required
                      min="0"
                      placeholder="185.00"
                      value={eqForm.rental_rate_per_day}
                      onChange={(e) => setEqForm({ ...eqForm, rental_rate_per_day: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="eq-value-input">Replacement Value (₹)</label>
                    <input
                      id="eq-value-input"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="3799.00"
                      value={eqForm.replacement_value}
                      onChange={(e) => setEqForm({ ...eqForm, replacement_value: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="eq-desc-input">Description</label>
                  <textarea
                    id="eq-desc-input"
                    placeholder="Enter short equipment overview..."
                    value={eqForm.description}
                    onChange={(e) => setEqForm({ ...eqForm, description: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="eq-notes-input">Maintenance/Operations Notes</label>
                  <textarea
                    id="eq-notes-input"
                    placeholder="Optional check notes..."
                    value={eqForm.notes}
                    onChange={(e) => setEqForm({ ...eqForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddEquip(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Equipment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Employee Modal ────────────────────────────────────────────── */}
      {showAddEmp && (
        <div className="modal-backdrop" onClick={() => setShowAddEmp(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Staff Account</h3>
              <button className="modal-close" onClick={() => setShowAddEmp(false)}>×</button>
            </div>
            <form onSubmit={handleEmpSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                  This creates an <strong>Employee</strong> user who can access the logistics planner, update booking status, and modify inventory. They will not have admin deactivation or logging access.
                </p>

                <div className="form-group">
                  <label htmlFor="emp-name-input">Display Name *</label>
                  <input
                    id="emp-name-input"
                    type="text"
                    required
                    placeholder="e.g. Sarah Connor"
                    value={empForm.name}
                    onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="emp-email-input">Email Address *</label>
                  <input
                    id="emp-email-input"
                    type="email"
                    required
                    placeholder="e.g. sarah@sddigitals.com"
                    value={empForm.email}
                    onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="emp-pwd-input">Initial Password *</label>
                  <input
                    id="emp-pwd-input"
                    type="password"
                    required
                    placeholder="Enter password"
                    value={empForm.password}
                    onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddEmp(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Force Password Reset Modal ────────────────────────────────────── */}
      {forceResetId && (
        <div className="modal-backdrop" onClick={() => setForceResetId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Force Employee Password Reset</h3>
              <button className="modal-close" onClick={() => setForceResetId(null)}>×</button>
            </div>
            <form onSubmit={handleForceResetPassword}>
              <div className="modal-body">
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                  Enter a new temporary password for this operator. They will need to use it to log in.
                </p>

                <div className="form-group">
                  <label htmlFor="temp-pwd-input">New Temporary Password *</label>
                  <input
                    id="temp-pwd-input"
                    type="password"
                    required
                    placeholder="Enter password"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setForceResetId(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Toast Alert Component ─────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: 'var(--space-4)',
          right: 'var(--space-4)',
          padding: 'var(--space-3) var(--space-5)',
          background: toast.type === 'error' ? 'var(--red)' : 'var(--green)',
          color: '#fff',
          fontWeight: 600,
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          zIndex: 9999,
          animation: 'slide-in-right 0.2s ease',
        }}>
          {toast.type === 'error' ? <AlertTriangle size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} /> : <CheckCircle size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />} {toast.text}
        </div>
      )}
    </motion.div>
  );
}
