import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/apiClient.js';

export function useEquipment(initialParams = {}) {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const fetchEquipment = useCallback(async (params = initialParams) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.equipment.list(params);
      setEquipment(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEquipment(); }, [fetchEquipment]);

  const updateStatus = useCallback(async (id, newStatus) => {
    await api.equipment.updateStatus(id, newStatus);
    setEquipment((prev) =>
      prev.map((e) => (e.equipment_id === id || e.id === id) ? { ...e, status: newStatus } : e)
    );
    fetchEquipment();
  }, [fetchEquipment]);

  const availableEquipment = equipment.filter((e) => e.status === 'AVAILABLE');

  return { equipment, availableEquipment, loading, error, refresh: fetchEquipment, updateStatus };
}
