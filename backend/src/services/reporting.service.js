'use strict';

const db = require('../config/db');
const notificationsService = require('./notifications.service');

class ReportingService {
  /**
   * Run daily logistics tasks: dispatch reminders and email daily admin summary.
   */
  async runDailyJobs() {
    console.log('[ReportingService] [cron] Starting daily logistics and reporting jobs...');
    const results = {
      remindersSent: 0,
      adminReportSent: false,
      errors: []
    };

    try {
      // 1. Dispatch Reminders
      const reminders = await this.dispatchDailyReminders();
      results.remindersSent = reminders.count;
      if (reminders.errors.length) {
        results.errors.push(...reminders.errors);
      }
    } catch (err) {
      console.error('[ReportingService] Error running reminders:', err.message);
      results.errors.push(`Reminders failed: ${err.message}`);
    }

    try {
      // 2. Send Admin Operations Summary
      await this.sendAdminDailyReport();
      results.adminReportSent = true;
    } catch (err) {
      console.error('[ReportingService] Error running admin report:', err.message);
      results.errors.push(`Admin report failed: ${err.message}`);
    }

    return results;
  }

  /**
   * Dispatch delivery/pickup/return reminders for the next 24 hours.
   */
  async dispatchDailyReminders() {
    let count = 0;
    const errors = [];

    try {
      // Fetch upcoming deliveries (next 24 hours) for CONFIRMED bookings
      const deliveryRes = await db.query(`
        SELECT b.booking_ref, b.scheduled_delivery_date, c.name as customer_name, c.email as customer_email, c.phone as customer_phone, ol.driver_assigned
        FROM bookings b
        JOIN customers c ON b.customer_id = c.id
        LEFT JOIN operations_logs ol ON b.id = ol.booking_id
        WHERE b.is_deleted = FALSE
          AND b.status = 'CONFIRMED'
          AND b.scheduled_delivery_date >= NOW()
          AND b.scheduled_delivery_date <= NOW() + INTERVAL '24 hours'
      `);

      for (const b of deliveryRes.rows) {
        try {
          await notificationsService.sendReminder(b, 'DELIVERY_REMINDER');
          count++;
        } catch (err) {
          errors.push(`Failed to send delivery reminder for ${b.booking_ref}: ${err.message}`);
        }
      }

      // Fetch upcoming returns (next 24 hours) for DELIVERED / AWAITING_PICKUP bookings
      const returnRes = await db.query(`
        SELECT b.booking_ref, b.scheduled_return_date, c.name as customer_name, c.email as customer_email, c.phone as customer_phone, ol.driver_assigned
        FROM bookings b
        JOIN customers c ON b.customer_id = c.id
        LEFT JOIN operations_logs ol ON b.id = ol.booking_id
        WHERE b.is_deleted = FALSE
          AND b.status IN ('DELIVERED', 'AWAITING_PICKUP')
          AND b.scheduled_return_date >= NOW()
          AND b.scheduled_return_date <= NOW() + INTERVAL '24 hours'
      `);

      for (const b of returnRes.rows) {
        try {
          await notificationsService.sendReminder(b, 'RETURN_REMINDER');
          count++;
        } catch (err) {
          errors.push(`Failed to send return reminder for ${b.booking_ref}: ${err.message}`);
        }
      }
    } catch (err) {
      errors.push(`Database query failed for reminders: ${err.message}`);
    }

    return { count, errors };
  }

  /**
   * Compile statistics and send the Admin Operations Summary Report.
   */
  async sendAdminDailyReport() {
    // 1. Fetch KPI Statistics
    const statusCounts = await db.query(
      `SELECT status, COUNT(*)::int as count FROM bookings WHERE is_deleted = FALSE GROUP BY status`
    );
    const unpaidInv = await db.query(
      `SELECT COALESCE(SUM(amount_due - amount_paid), 0) as total FROM invoices WHERE status = 'UNPAID'`
    );
    const heldDep = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE status = 'HELD'`
    );
    const activeAlerts = await db.query(
      `SELECT related_entity, trigger_type, priority, message, created_at FROM system_alerts WHERE resolved_at IS NULL ORDER BY created_at DESC`
    );
    const overdueRes = await db.query(`
      SELECT b.booking_ref, c.name as customer_name, b.scheduled_return_date
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id
      WHERE b.is_deleted = FALSE
        AND b.status IN ('AWAITING_PICKUP', 'DELIVERED')
        AND b.scheduled_return_date < NOW()
    `);

    // 2. Fetch today's deliveries & returns lists
    const todayDeliveries = await db.query(`
      SELECT b.booking_ref, c.name as customer_name, b.scheduled_delivery_date, ol.driver_assigned
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id
      LEFT JOIN operations_logs ol ON b.id = ol.booking_id
      WHERE b.is_deleted = FALSE
        AND b.scheduled_delivery_date::date = CURRENT_DATE
    `);

    const todayReturns = await db.query(`
      SELECT b.booking_ref, c.name as customer_name, b.scheduled_return_date, ol.driver_assigned
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id
      LEFT JOIN operations_logs ol ON b.id = ol.booking_id
      WHERE b.is_deleted = FALSE
        AND b.scheduled_return_date::date = CURRENT_DATE
    `);

    // 3. Compile HTML report body
    const totalBookings = statusCounts.rows.reduce((sum, r) => sum + r.count, 0);
    const statusBreakdown = statusCounts.rows.map(r => `<li>${r.status}: <strong>${r.count}</strong></li>`).join('');
    
    let alertsListHtml = activeAlerts.rows.length 
      ? activeAlerts.rows.map(a => `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px; color: #e53e3e; font-weight: bold;">${a.priority}</td>
            <td style="padding: 8px;">${a.trigger_type}</td>
            <td style="padding: 8px;">${a.message}</td>
          </tr>`).join('')
      : '<tr><td colspan="3" style="padding: 8px; text-align: center; color: #718096;">No active alerts</td></tr>';

    let deliveriesHtml = todayDeliveries.rows.length
      ? todayDeliveries.rows.map(d => `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px; font-weight: 500;">${d.booking_ref}</td>
            <td style="padding: 8px;">${d.customer_name}</td>
            <td style="padding: 8px; font-family: monospace;">${new Date(d.scheduled_delivery_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
            <td style="padding: 8px;">${d.driver_assigned || 'Unassigned'}</td>
          </tr>`).join('')
      : '<tr><td colspan="4" style="padding: 8px; text-align: center; color: #718096;">No deliveries today</td></tr>';

    let returnsHtml = todayReturns.rows.length
      ? todayReturns.rows.map(r => `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px; font-weight: 500;">${r.booking_ref}</td>
            <td style="padding: 8px;">${r.customer_name}</td>
            <td style="padding: 8px; font-family: monospace;">${new Date(r.scheduled_return_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
            <td style="padding: 8px;">${r.driver_assigned || 'Unassigned'}</td>
          </tr>`).join('')
      : '<tr><td colspan="4" style="padding: 8px; text-align: center; color: #718096;">No returns today</td></tr>';

    const overdueListHtml = overdueRes.rows.length
      ? overdueRes.rows.map(o => `<li>${o.booking_ref} (${o.customer_name}) - Overdue since ${new Date(o.scheduled_return_date).toLocaleDateString('en-IN')}</li>`).join('')
      : '<li>None</li>';

    const subject = `SD Digitals - Daily Admin Operations Summary Report`;
    const emailContent = `SD Digitals Logistics Daily Summary Report. Total active bookings: ${totalBookings}. Overdue returns: ${overdueRes.rows.length}. Unpaid balance: ₹${parseFloat(unpaidInv.rows[0].total).toFixed(2)}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1a365d; margin-top: 0;">SD Digitals</h2>
        <h3 style="color: #4a5568;">Logistics Daily Summary Report</h3>
        <p style="color: #718096; font-size: 12px;">Generated on: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        
        <h4 style="color: #1a365d; margin-bottom: 8px;">1. Operational KPIs</h4>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background: #f7fafc;">
            <td style="padding: 10px; border: 1px solid #edf2f7; font-weight: 600;">Total Bookings</td>
            <td style="padding: 10px; border: 1px solid #edf2f7; font-family: monospace;">${totalBookings}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #edf2f7; font-weight: 600;">Overdue Returns</td>
            <td style="padding: 10px; border: 1px solid #edf2f7; color: #e53e3e; font-family: monospace; font-weight: bold;">${overdueRes.rows.length}</td>
          </tr>
          <tr style="background: #f7fafc;">
            <td style="padding: 10px; border: 1px solid #edf2f7; font-weight: 600;">Unpaid Invoices Sum</td>
            <td style="padding: 10px; border: 1px solid #edf2f7; font-family: monospace; color: #3182ce; font-weight: bold;">₹${parseFloat(unpaidInv.rows[0].total).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #edf2f7; font-weight: 600;">Deposits Held Sum</td>
            <td style="padding: 10px; border: 1px solid #edf2f7; font-family: monospace; color: #38a169; font-weight: bold;">₹${parseFloat(heldDep.rows[0].total).toFixed(2)}</td>
          </tr>
        </table>

        <h4 style="color: #1a365d; margin-bottom: 8px;">2. Status Breakdown</h4>
        <ul style="padding-left: 20px; margin-bottom: 20px;">
          ${statusBreakdown}
        </ul>

        <h4 style="color: #e53e3e; margin-bottom: 8px;">3. Overdue Details</h4>
        <ul style="padding-left: 20px; margin-bottom: 20px; color: #e53e3e;">
          ${overdueListHtml}
        </ul>

        <h4 style="color: #1a365d; margin-bottom: 8px;">4. Today's Scheduled Deliveries</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
          <thead>
            <tr style="background: #ebf8ff; color: #2b6cb0; text-align: left;">
              <th style="padding: 8px;">Ref</th>
              <th style="padding: 8px;">Customer</th>
              <th style="padding: 8px;">Time</th>
              <th style="padding: 8px;">Driver</th>
            </tr>
          </thead>
          <tbody>
            ${deliveriesHtml}
          </tbody>
        </table>

        <h4 style="color: #1a365d; margin-bottom: 8px;">5. Today's Scheduled Returns</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f0fff4; color: #22543d; text-align: left;">
              <th style="padding: 8px;">Ref</th>
              <th style="padding: 8px;">Customer</th>
              <th style="padding: 8px;">Time</th>
              <th style="padding: 8px;">Driver</th>
            </tr>
          </thead>
          <tbody>
            ${returnsHtml}
          </tbody>
        </table>

        <h4 style="color: #e53e3e; margin-bottom: 8px;">6. Active System Alerts (${activeAlerts.rows.length})</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
          <thead>
            <tr style="background: #fff5f5; color: #9b2c2c; text-align: left;">
              <th style="padding: 8px; width: 80px;">Priority</th>
              <th style="padding: 8px; width: 100px;">Type</th>
              <th style="padding: 8px;">Message</th>
            </tr>
          </thead>
          <tbody>
            ${alertsListHtml}
          </tbody>
        </table>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="font-size: 11px; color: #a0aec0; text-align: center;">This is an automated system-generated logistics dashboard notification from SD Digitals.</p>
      </div>
    `;

    const adminEmail = process.env.MAIN_ADMIN_EMAIL || 'admin@sddigitals.com';
    await notificationsService.logDispatch('email', 'DAILY_REPORT', adminEmail, subject, emailContent, htmlContent);
  }
}

module.exports = new ReportingService();
