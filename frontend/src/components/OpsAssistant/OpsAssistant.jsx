import React from 'react';
import { AnimatePresence } from 'framer-motion';
import AlertCard from './AlertCard.jsx';
import { SkeletonCard } from '../shared/SkeletonLoader.jsx';
import './OpsAssistant.css';

const OPS_TIPS = [
  { id: 1, text: 'Always assign a driver before dispatching to OUT_FOR_DELIVERY — the workflow will block unassigned transitions.' },
  { id: 2, text: 'Set a scheduled_pickup_time before dispatch. This anchors the return window for customer SLA.' },
  { id: 3, text: 'Equipment is automatically released back to AVAILABLE when a booking reaches PICKED_UP_AND_RETURNED.' },
];

export default function OpsAssistant({ alerts, loading, onDismiss }) {
  const criticalAlerts = (alerts || []).filter((a) => a.priority === 'CRITICAL');
  const otherAlerts    = (alerts || []).filter((a) => a.priority !== 'CRITICAL');

  return (
    <aside className="ops-assistant card" aria-label="Operations Assistant Sidebar">
      <div className="ops-assistant__header">
        <div className="ops-assistant__title">
          <span>⚡</span>
          <span>Ops Assistant</span>
        </div>
        <span className="ops-assistant__ai-pill">AI Rules Engine</span>
      </div>

      <div className="ops-assistant__body">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : alerts.length === 0 ? (
          <div className="ops-no-alerts">
            <div className="ops-no-alerts__icon">✅</div>
            <p className="ops-no-alerts__text">All systems nominal. No active alerts.</p>
          </div>
        ) : (
          /* AnimatePresence enables exit animations when alerts are dismissed */
          <AnimatePresence mode="popLayout" initial={false}>
            {criticalAlerts.map((alert) => (
              <AlertCard key={alert.alert_id || alert.id} alert={alert} onDismiss={onDismiss} />
            ))}
            {otherAlerts.map((alert) => (
              <AlertCard key={alert.alert_id || alert.id} alert={alert} onDismiss={onDismiss} />
            ))}
          </AnimatePresence>
        )}

        {/* Workflow tips */}
        {!loading && (
          <div style={{ marginTop: 'var(--space-2)' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 'var(--space-3)', paddingLeft: 'var(--space-1)' }}>
              Workflow Rules
            </p>
            {OPS_TIPS.map((tip) => (
              <div key={tip.id} className="ops-tip" style={{ marginBottom: 'var(--space-2)' }}>
                <div className="ops-tip__label">🔧 Rule #{tip.id}</div>
                <p className="ops-tip__text">{tip.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
