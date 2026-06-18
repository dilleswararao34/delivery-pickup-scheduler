import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/apiClient.js';

export function useBookings(initialFilters = {}) {
  const [bookings, setBookings]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters]       = useState(initialFilters);
  const abortRef = useRef(null);

  const fetchBookings = useCallback(async (overrideFilters) => {
    setLoading(true);
    setError(null);

    try {
      const params = { ...filters, ...overrideFilters };
      const result = await api.bookings.list(params);
      setBookings(result.data || []);
      setPagination(result.meta?.pagination || null);
    } catch (err) {
      setError(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const createBooking = useCallback(async (payload) => {
    const result = await api.bookings.create(payload);
    // Optimistically prepend to list
    setBookings((prev) => [result.data, ...prev]);
    fetchBookings();
    return result.data;
  }, [fetchBookings]);

  const updateStatus = useCallback(async (id, payload) => {
    const result = await api.bookings.updateStatus(id, payload);
    // Update in-place
    setBookings((prev) =>
      prev.map((b) => b.booking_id === id ? { ...b, status: payload.new_status } : b)
    );
    fetchBookings();
    return result.data;
  }, [fetchBookings]);

  const applyFilter = useCallback((newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const refresh = useCallback(() => {
    fetchBookings();
  }, [fetchBookings]);

  return {
    bookings,
    loading,
    error,
    pagination,
    filters,
    applyFilter,
    clearFilters,
    refresh,
    createBooking,
    updateStatus,
  };
}

export function useBookingDetail(id) {
  const [booking, setBooking]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.bookings.get(id);
      setBooking(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { booking, loading, error, refresh: fetch };
}
