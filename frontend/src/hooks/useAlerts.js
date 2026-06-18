import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/apiClient.js';

export function useAlerts(pollIntervalMs = 30000) {
  const [alerts, setAlerts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const intervalRef = useRef(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const result = await api.alerts.list();
      setAlerts(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    if (pollIntervalMs > 0) {
      intervalRef.current = setInterval(fetchAlerts, pollIntervalMs);
    }
    return () => clearInterval(intervalRef.current);
  }, [fetchAlerts, pollIntervalMs]);

  const dismissAlert = useCallback(async (alertId) => {
    try {
      await api.alerts.resolve(alertId);
      setAlerts((prev) => prev.filter((a) => (a.alert_id || a.id) !== alertId));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const criticalCount = alerts.filter((a) => a.priority === 'CRITICAL').length;
  const highCount     = alerts.filter((a) => a.priority === 'HIGH').length;

  return { alerts, loading, error, criticalCount, highCount, dismissAlert, refresh: fetchAlerts };
}
