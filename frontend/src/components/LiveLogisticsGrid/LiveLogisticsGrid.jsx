import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Download, Loader2, Clock } from 'lucide-react';
import BookingRow from './BookingRow.jsx';
import { SkeletonGrid } from '../shared/SkeletonLoader.jsx';
import EmptyState from '../shared/EmptyState.jsx';
import { staggerContainer } from '../../utils/motionVariants.js';
import apiClient from '../../services/apiClient.js';
import './LiveLogisticsGrid.css';

const STATUS_FILTERS = [
  { label: 'All',        value: '' },
  { label: 'Live',       value: 'OUT_FOR_DELIVERY' },
  { label: 'Confirmed',  value: 'CONFIRMED' },
  { label: 'Awaiting Return', value: 'AWAITING_PICKUP' },
  { label: 'Draft',      value: 'DRAFT' },
  { label: 'Quote',      value: 'QUOTATION_REQUESTED' },
  { label: 'Delivered',  value: 'DELIVERED' },
  { label: 'Returned',   value: 'PICKED_UP_AND_RETURNED' },
  { label: 'Archived',   value: 'ARCHIVED' },
  { label: 'Canceled',   value: 'CANCELLED' },
];

export default function LiveLogisticsGrid({
  bookings,
  loading,
  error,
  onRowClick,
  selectedId,
  onFilterChange,
  onRefresh,
  activeFilter = '',
}) {
  const [searchTerm, setSearchTerm]   = useState('');
  const [refreshing, setRefreshing]   = useState(false);
  const [exporting, setExporting]     = useState(false);
 
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = {};
      if (activeFilter) params.status = activeFilter;
      if (searchTerm) params.customer_name = searchTerm;
      const blob = await apiClient.exportBookingsCSV(params);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bookings_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to export CSV: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleSearch = useCallback((e) => {
    const val = e.target.value;
    setSearchTerm(val);
    onFilterChange?.({ customer_name: val || undefined });
  }, [onFilterChange]);

  const handleStatusFilter = useCallback((status) => {
    onFilterChange?.({ status: status || undefined, customer_name: searchTerm || undefined });
  }, [onFilterChange, searchTerm]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh?.();
    setTimeout(() => setRefreshing(false), 800);
  }, [onRefresh]);

  // Client-side search filter
  const filtered = searchTerm
    ? bookings.filter(
        (b) =>
          b.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.booking_ref?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.customer_company?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : bookings;

  return (
    <section className="live-grid card" aria-label="Live Logistics Grid">
      {/* Header */}
      <div className="live-grid__header">
        <div className="live-grid__title">
          <h2>Live Logistics</h2>
          <span className="live-grid__count">{filtered.length}</span>
        </div>

        <div className="live-grid__controls">
          <div className="live-grid__search-wrap">
            <span className="live-grid__search-icon" aria-hidden="true">
              <Search size={14} style={{ color: 'var(--text-tertiary)' }} />
            </span>
            <input
              id="grid-search-input"
              type="search"
              className="live-grid__search"
              placeholder="Search bookings, clients…"
              value={searchTerm}
              onChange={handleSearch}
              aria-label="Search bookings"
            />
          </div>

          <button
            id="grid-refresh-btn"
            className={`live-grid__refresh-btn${refreshing ? ' spinning' : ''}`}
            onClick={handleRefresh}
            title="Refresh grid"
            aria-label="Refresh bookings list"
            style={{ marginRight: 'var(--space-2)' }}
          >
            ↻
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={handleExportCSV}
            disabled={exporting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              background: 'var(--blue-soft)',
              border: '1px solid var(--blue)',
              color: 'var(--blue)',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              height: '34px',
              padding: '0 var(--space-3)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            {exporting ? (
              <>
                <Loader2 size={14} className="spinning" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>Export CSV</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="live-grid__filter-tabs" role="tablist" aria-label="Filter by booking status">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={activeFilter === f.value}
            id={`filter-tab-${f.value || 'all'}`}
            className={`filter-tab${activeFilter === f.value ? ' filter-tab--active' : ''}`}
            onClick={() => handleStatusFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="live-grid__table-wrap">
        {loading ? (
          <SkeletonGrid rows={6} />
        ) : error ? (
          <EmptyState
            type="search"
            title="Failed to load bookings"
            subtitle={error}
            action={handleRefresh}
            actionLabel="Retry"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            type="bookings"
            title="No bookings found"
            subtitle={
              searchTerm || activeFilter
                ? 'No bookings match the current filters. Try clearing your search.'
                : 'No bookings have been created yet. Use the Intake Command panel to get started.'
            }
          />
        ) : (
          <table className="live-grid__table" role="table" aria-label="Bookings table">
            <thead>
              <tr>
                <th className="live-grid__col-header" scope="col">Ref #</th>
                <th className="live-grid__col-header" scope="col">Customer</th>
                <th className="live-grid__col-header" scope="col">Status</th>
                <th className="live-grid__col-header" scope="col">Priority</th>
                <th className="live-grid__col-header" scope="col">Source</th>
                <th className="live-grid__col-header" scope="col">Owner</th>
                <th className="live-grid__col-header" scope="col">Equipment</th>
                <th className="live-grid__col-header" scope="col">Driver</th>
                <th className="live-grid__col-header" scope="col">Delivery → Return</th>
                <th className="live-grid__col-header" scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <motion.tbody
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {filtered.map((booking) => (
                <BookingRow
                  key={booking.booking_id}
                  booking={booking}
                  onClick={onRowClick}
                  isSelected={booking.booking_id === selectedId}
                />
              ))}
            </motion.tbody>
          </table>
        )}
      </div>
    </section>
  );
}
