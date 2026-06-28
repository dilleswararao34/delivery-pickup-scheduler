import { useCallback } from 'react';
import { ALLOWED_TRANSITIONS } from '../utils/statusColors.js';

export function useStateMachine() {
  const getAllowedNext = useCallback((currentStatus) => {
    return ALLOWED_TRANSITIONS[currentStatus] || [];
  }, []);

  const canTransition = useCallback((from, to) => {
    return (ALLOWED_TRANSITIONS[from] || []).includes(to);
  }, []);

  const getTransitionLabel = useCallback((to) => {
    const labels = {
      QUOTATION_REQUESTED:    'Request Quotation',
      CONFIRMED:              'Confirm Booking',
      OUT_FOR_DELIVERY:       'Dispatch for Delivery',
      DELIVERED:              'Mark as Delivered',
      AWAITING_PICKUP:        'Flag for Pickup',
      PICKED_UP_AND_RETURNED: 'Confirm Returned',
      ARCHIVED:               'Archive Booking',
      DRAFT:                  'Revert to Draft',
      CANCELLATION_REQUESTED: 'Request Cancellation',
    };
    return labels[to] || to;
  }, []);

  return { getAllowedNext, canTransition, getTransitionLabel };
}
