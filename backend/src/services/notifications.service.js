'use strict';

const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const dns = require('dns');

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

/**
 * Notification Service
 * Manages confirmations, reminders, follow-ups, alerts, and admin reports.
 * Integrates with:
 * - Nodemailer / SMTP Email API
 * - PDF Export using pdfkit
 * - Console WhatsApp/Slack stubs
 */
class NotificationService {
  constructor() {
    this.logs = [];
    this.transporter = undefined;
  }

  /**
   * Initialize transporter on demand and resolve IPv4 address for SMTP host
   */
  async getTransporter() {
    if (this.transporter !== undefined) {
      return this.transporter;
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASSWORD;

    if (smtpHost && smtpUser && smtpPass) {
      let hostAddress = smtpHost;
      let tlsOpts = {};

      try {
        const dns = require('dns').promises;
        console.log(`[NotificationService] Resolving IPv4 address for ${smtpHost}...`);
        const addresses = await dns.resolve4(smtpHost);
        if (addresses && addresses.length > 0) {
          hostAddress = addresses[0];
          tlsOpts = { servername: smtpHost };
          console.log(`[NotificationService] Resolved ${smtpHost} to IPv4: ${hostAddress}`);
        }
      } catch (dnsErr) {
        console.warn(`[NotificationService] DNS IPv4 resolution failed for ${smtpHost}, falling back to hostname:`, dnsErr.message);
      }

      this.transporter = nodemailer.createTransport({
        host: hostAddress,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: tlsOpts,
        connectionTimeout: 10000, // 10s connection timeout
      });
      console.log(`[NotificationService] SMTP Transporter initialized successfully on ${hostAddress}:${smtpPort}`);
    } else {
      console.warn(`[NotificationService] SMTP credentials missing. Email alerts will only be logged to console.`);
      this.transporter = null;
    }

    return this.transporter;
  }

  /**
   * Log a notification dispatch event and send email if configured
   */
  async logDispatch(channel, type, recipient, subject, content, htmlContent = null) {
    const transporter = await this.getTransporter();
    const logEntry = {
      timestamp: new Date().toISOString(),
      channel,
      type,
      recipient,
      subject,
      content,
      status: transporter ? 'SENT' : 'SENT_MOCK'
    };
    this.logs.push(logEntry);
    console.log(`[NotificationService] [${channel.toUpperCase()}] Dispatching ${type} to ${recipient}: "${subject || 'No Subject'}"`);

    if (channel === 'email' && recipient) {
      const from = process.env.SMTP_FROM || 'SD Digitals <no-reply@sddigitals.in>';
      if (transporter) {
        try {
          await transporter.sendMail({
            from,
            to: recipient,
            subject,
            text: content,
            html: htmlContent || `<p>${content}</p>`
          });
          console.log(`[NotificationService] [SMTP] Email successfully dispatched to ${recipient}`);
        } catch (err) {
          console.error(`[NotificationService] [SMTP] Error dispatching email to ${recipient}:`, err.message);
        }
      }
    }
  }

  /**
   * Send quotation request acknowledgment
   */
  async sendQuoteAcknowledgement(booking) {
    const subject = `SD Digitals - Quotation Request Received: ${booking.booking_ref}`;
    const gearList = booking.equipment.map(e => e.name).join(', ');
    const customerName = booking.customer?.name || booking.customer_name || 'Customer';
    const emailRecipient = booking.customer?.email || booking.customer_email;
    const phoneRecipient = booking.customer?.phone || booking.customer_phone;
    const content = `Hi ${customerName}, we have received your quotation request for the following camera equipment: ${gearList}.\nAn operator will review the availability and send over the finalized quote/invoice shortly.`;
    
    if (emailRecipient) {
      await this.logDispatch('email', 'QUOTE_REQUESTED', emailRecipient, subject, content);
    }
    if (phoneRecipient) {
      await this.logDispatch('whatsapp', 'QUOTE_REQUESTED', phoneRecipient, null, `*QUOTE REQUESTED:* Quotation request logged for booking ${booking.booking_ref}.`);
    }
  }

  /**
   * Send rental booking confirmation
   */
  async sendConfirmation(booking) {
    const subject = `SD Digitals - Rental Confirmation: ${booking.booking_ref}`;
    const gearList = booking.equipment.map(e => e.name).join(', ');
    const customerName = booking.customer?.name || booking.customer_name || 'Customer';
    const emailRecipient = booking.customer?.email || booking.customer_email;
    const phoneRecipient = booking.customer?.phone || booking.customer_phone;
    const content = `Hi ${customerName}, your rental of ${gearList} is confirmed! Delivery is scheduled for ${new Date(booking.scheduled_delivery_date).toLocaleDateString('en-IN')}.`;
    
    if (emailRecipient) {
      await this.logDispatch('email', 'CONFIRMATION', emailRecipient, subject, content);
    }
    if (phoneRecipient) {
      await this.logDispatch('whatsapp', 'CONFIRMATION', phoneRecipient, null, `*CONFIRMED:* Booking ${booking.booking_ref} is locked for delivery.`);
    }
  }

  /**
   * Send payment received confirmation
   */
  async sendPaymentConfirmation(booking, invoice) {
    const subject = `SD Digitals - Payment Received: ${booking.booking_ref}`;
    const customerName = booking.customer?.name || booking.customer_name || 'Customer';
    const emailRecipient = booking.customer?.email || booking.customer_email;
    const phoneRecipient = booking.customer?.phone || booking.customer_phone;
    const content = `Hi ${customerName}, we have received your payment of ₹${invoice.amount_paid} for booking ${booking.booking_ref} (Invoice: ${invoice.invoice_ref}). Your invoice is now paid!`;
    
    if (emailRecipient) {
      await this.logDispatch('email', 'PAYMENT_RECEIVED', emailRecipient, subject, content);
    }
    if (phoneRecipient) {
      await this.logDispatch('whatsapp', 'PAYMENT_RECEIVED', phoneRecipient, null, `*PAYMENT RECEIVED:* ₹${invoice.amount_paid} received for booking ${booking.booking_ref}.`);
    }
  }

  /**
   * Send delivery notification
   */
  async sendDeliveryNotification(booking) {
    const subject = `SD Digitals - Equipment Delivered: ${booking.booking_ref}`;
    const customerName = booking.customer?.name || booking.customer_name || 'Customer';
    const emailRecipient = booking.customer?.email || booking.customer_email;
    const phoneRecipient = booking.customer?.phone || booking.customer_phone;
    const content = `Hi ${customerName}, your equipment for booking ${booking.booking_ref} has been successfully delivered. Have a great shoot!`;
    
    if (emailRecipient) {
      await this.logDispatch('email', 'EQUIPMENT_DELIVERED', emailRecipient, subject, content);
    }
    if (phoneRecipient) {
      await this.logDispatch('whatsapp', 'EQUIPMENT_DELIVERED', phoneRecipient, null, `*DELIVERED:* Equipment for booking ${booking.booking_ref} is delivered.`);
    }
  }

  /**
   * Send delivery/pickup/return reminders
   */
  async sendReminder(booking, type = 'DELIVERY_REMINDER') {
    const isDelivery = type === 'DELIVERY_REMINDER' || type === 'PICKUP_REMINDER';
    const subject = isDelivery 
      ? `SD Digitals - Equipment Delivery Scheduled: ${booking.booking_ref}`
      : `SD Digitals - Equipment Return Reminder: ${booking.booking_ref}`;
    
    const customerName = booking.customer?.name || booking.customer_name || 'Customer';
    const driverName = booking.operations_log?.driver_assigned || booking.driver_assigned || 'Ravi';
    
    const content = isDelivery
      ? `Hi ${customerName}, driver ${driverName} is assigned to deliver your equipment today.`
      : `Hi ${customerName}, your equipment rental return period ends on ${new Date(booking.scheduled_return_date).toLocaleDateString('en-IN')}. Our team will collect the gear.`;

    const emailRecipient = booking.customer?.email || booking.customer_email;
    const phoneRecipient = booking.customer?.phone || booking.customer_phone;

    if (emailRecipient) {
      await this.logDispatch('email', type, emailRecipient, subject, content);
    }
    if (phoneRecipient) {
      await this.logDispatch('whatsapp', type, phoneRecipient, null, content);
    }
  }

  /**
   * Send post-rental follow-up / feedback request
   */
  async sendFollowUp(booking) {
    const subject = `SD Digitals - Gear Return Acknowledgment: ${booking.booking_ref}`;
    const customerName = booking.customer?.name || booking.customer_name || 'Customer';
    const emailRecipient = booking.customer?.email || booking.customer_email;
    const phoneRecipient = booking.customer?.phone || booking.customer_phone;
    const content = `Hi ${customerName}, thank you for choosing SD Digitals! Your returned gear has been received at our depot. Please share your feedback or log any issues.`;
    
    if (emailRecipient) {
      await this.logDispatch('email', 'FOLLOW_UP', emailRecipient, subject, content);
    }
    if (phoneRecipient) {
      await this.logDispatch('whatsapp', 'FOLLOW_UP', phoneRecipient, null, `Thank you for choosing SD Digitals! Booking ${booking.booking_ref} is closed.`);
    }
  }

  /**
   * Trigger critical administrator system alert notifications
   */
  async sendSystemAlert(alert) {
    const adminEmail = process.env.MAIN_ADMIN_EMAIL || 'admin@sddigitals.com';
    const subject = `[SYSTEM ALERT] ${alert.priority}: ${alert.trigger_type}`;
    const content = `Alert message: ${alert.message}`;
    
    await this.logDispatch('email', 'SYSTEM_ALERT', adminEmail, subject, content);
    await this.logDispatch('slack', 'SYSTEM_ALERT', '#logistics-alerts', subject, content);
  }

  /**
   * Compile and generate PDF of a quotation/invoice using pdfkit
   */
  async generatePDF(booking, invoice) {
    console.log(`[NotificationService] [PDFExport] Generating PDF for Invoice ${invoice.invoice_ref}`);
    
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];
        
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', err => reject(err));

        // Header / Branding
        doc.fontSize(22).fillColor('#1a365d').text('SD Digitals', { align: 'left' });
        doc.fontSize(10).fillColor('#4a5568').text('Premium Cinema Equipment Rental Services', { align: 'left' });
        doc.text('New Delhi, India | ops@sddigitals.in', { align: 'left' });
        doc.moveDown();

        // Horizontal Line
        doc.moveTo(50, 110).lineTo(550, 110).strokeColor('#cbd5e0').lineWidth(1).stroke();
        doc.moveDown(2);

        // Document Title
        doc.fontSize(18).fillColor('#2d3748').text('INVOICE & RENTAL QUOTATION', { align: 'center' });
        doc.moveDown(1.5);

        // Invoice metadata table structure
        doc.fontSize(11).fillColor('#4a5568');
        const metaY = doc.y;
        doc.text(`Invoice Reference: ${invoice.invoice_ref}`, 50, metaY);
        doc.text(`Date Issued: ${new Date(invoice.issued_at || new Date()).toLocaleDateString('en-IN')}`, 50, metaY + 15);
        doc.text(`Booking Reference: ${booking.booking_ref}`, 50, metaY + 30);

        doc.text(`Billed To:`, 330, metaY, { bold: true });
        doc.text(`Name: ${booking.customer.name}`, 330, metaY + 15);
        doc.text(`Email: ${booking.customer.email}`, 330, metaY + 30);
        doc.text(`Phone: ${booking.customer.phone}`, 330, metaY + 45);
        if (booking.customer.company) {
          doc.text(`Company: ${booking.customer.company}`, 330, metaY + 60);
        }

        doc.moveDown(4);

        // Table Header
        const tableHeaderY = doc.y;
        doc.fontSize(11).fillColor('#1a365d');
        doc.text('Rented Equipment Item', 50, tableHeaderY);
        doc.text('Serial Number', 260, tableHeaderY);
        doc.text('Category', 380, tableHeaderY);
        doc.text('Rental Rate/Day', 480, tableHeaderY, { align: 'right' });

        doc.moveTo(50, tableHeaderY + 15).lineTo(550, tableHeaderY + 15).strokeColor('#e2e8f0').lineWidth(1).stroke();
        doc.moveDown(1);

        // Table Rows
        doc.fontSize(10).fillColor('#2d3748');
        let currentY = doc.y;
        booking.equipment.forEach((item) => {
          doc.text(item.name, 50, currentY);
          doc.text(item.serial_number || 'N/A', 260, currentY);
          doc.text(item.category, 380, currentY);
          doc.text(`₹${parseFloat(item.rental_rate_per_day).toFixed(2)}`, 480, currentY, { align: 'right' });
          currentY += 20;
        });

        doc.moveTo(50, currentY + 5).lineTo(550, currentY + 5).strokeColor('#cbd5e0').lineWidth(1).stroke();
        doc.moveDown(2);

        // Calculate hire duration
        const start = new Date(booking.scheduled_delivery_date);
        const end = new Date(booking.scheduled_return_date);
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) || 1;

        // Totals
        const totalY = currentY + 20;
        doc.fontSize(11).fillColor('#4a5568');
        doc.text(`Rental Duration:`, 330, totalY);
        doc.text(`${diffDays} Day(s)`, 480, totalY, { align: 'right' });

        doc.text(`Security Deposit (10%):`, 330, totalY + 18);
        const depAmt = booking.deposits?.[0]?.amount || (invoice.amount_due * 0.1);
        doc.text(`₹${parseFloat(depAmt).toFixed(2)}`, 480, totalY + 18, { align: 'right' });

        doc.fontSize(13).fillColor('#1a365d');
        doc.text(`Total Amount Due:`, 330, totalY + 36, { bold: true });
        doc.text(`₹${parseFloat(invoice.amount_due).toFixed(2)}`, 480, totalY + 36, { align: 'right', bold: true });

        // Invoice status badge
        const badgeY = totalY + 65;
        doc.fontSize(11).fillColor('#2d3748');
        doc.text(`Payment Status:`, 50, badgeY);
        doc.fontSize(12).fillColor(invoice.status === 'PAID' ? '#38a169' : '#e53e3e');
        doc.text(invoice.status, 150, badgeY, { bold: true });

        // Footer note
        doc.fontSize(9).fillColor('#718096').text('Terms & Conditions: All gear must be returned on the scheduled return date. Any damages will be deducted from the security deposit. Thank you for your business!', 50,badgeY + 80, { align: 'center', width: 500 });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Compile and generate CSV export of admin operations
   */
  async generateCSV(bookingsList) {
    console.log(`[NotificationService] [CSVExport] Generating operations CSV report for ${bookingsList.length} records`);
    const headers = 'BookingRef,Customer,Status,Priority,DeliveryDate,ReturnDate,AssignedOwner,DriverAssigned\n';
    const rows = bookingsList.map(b => {
      const delDate = new Date(b.scheduled_delivery_date).toLocaleDateString('en-IN');
      const retDate = new Date(b.scheduled_return_date).toLocaleDateString('en-IN');
      return `${b.booking_ref},"${b.customer_name}",${b.status},${b.priority},${delDate},${retDate},"${b.assigned_owner || 'Unassigned'}","${b.driver_assigned || 'None'}"`;
    }).join('\n');
    return headers + rows;
  }
  /**
   * Send payment confirmation email
   */
  async sendPaymentConfirmation(booking, invoice) {
    const subject = `SD Digitals - Payment Received for Invoice ${invoice.invoice_ref}`;
    const content = `Hi ${booking.customer_name || booking.customer?.name || 'Customer'},\n\nWe have successfully received your payment of ₹${parseFloat(invoice.amount_paid).toFixed(2)} for invoice ${invoice.invoice_ref} (Booking Ref: ${booking.booking_ref}).\n\nThank you for your business!`;
    const recipient = booking.customer_email || booking.customer?.email;
    if (recipient) {
      await this.logDispatch('email', 'PAYMENT_CONFIRMATION', recipient, subject, content);
    }
  }

  /**
   * Send deposit refund confirmation email
   */
  async sendDepositRefundConfirmation(booking, deposit) {
    const subject = `SD Digitals - Security Deposit Refunded: ${booking.booking_ref}`;
    const content = `Hi ${booking.customer_name || booking.customer?.name || 'Customer'},\n\nYour security deposit of ₹${parseFloat(deposit.amount).toFixed(2)} has been successfully refunded to your original payment method (Refund ID: ${deposit.razorpay_refund_id || 'N/A'}).\n\nThank you for choosing SD Digitals!`;
    const recipient = booking.customer_email || booking.customer?.email;
    if (recipient) {
      await this.logDispatch('email', 'DEPOSIT_REFUND', recipient, subject, content);
    }
  }

  /**
   * Send employee welcome email
   */
  async sendEmployeeWelcome(email, name, tempPassword) {
    const subject = `Welcome to the SD Digitals Team!`;
    const content = `Hi ${name},\n\nYou have been registered as an employee at SD Digitals.\n\nYour temporary credentials are:\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nPlease sign in and update your password at the Staff Portal:\nhttp://localhost:5173/staff/login\n\nWelcome aboard!`;
    await this.logDispatch('email', 'EMPLOYEE_ONBOARDING', email, subject, content);
  }

  /**
   * Send cancellation request notification
   */
  async sendCancellationRequested(booking) {
    const subject = `SD Digitals - Cancellation Request Received: ${booking.booking_ref}`;
    const customerName = booking.customer?.name || booking.customer_name || 'Customer';
    const recipient = booking.customer?.email || booking.customer_email;
    const content = `Hi ${customerName},\n\nWe have received your request to cancel booking ${booking.booking_ref}.\n\nSince your delivery is scheduled within 24 hours, our team will review the request and contact you shortly regarding the confirmation.`;
    
    if (recipient) {
      await this.logDispatch('email', 'CANCELLATION_REQUESTED', recipient, subject, content);
    }
  }

  /**
   * Send cancellation confirmation notification
   */
  async sendCancellationConfirmed(booking) {
    const subject = `SD Digitals - Cancellation Confirmed: ${booking.booking_ref}`;
    const customerName = booking.customer?.name || booking.customer_name || 'Customer';
    const recipient = booking.customer?.email || booking.customer_email;
    const content = `Hi ${customerName},\n\nYour booking ${booking.booking_ref} has been successfully cancelled. Any payments made have been processed for refund to your original payment method.`;
    
    if (recipient) {
      await this.logDispatch('email', 'CANCELLATION_CONFIRMED', recipient, subject, content);
    }
  }

  /**
   * Send invoice refund confirmation email
   */
  async sendInvoiceRefundConfirmation(invoice, refundId) {
    const subject = `SD Digitals - Invoice Refund Processed: ${invoice.invoice_ref}`;
    const content = `Hi ${invoice.customer_name || 'Customer'},\n\nYour invoice payment of ₹${parseFloat(invoice.amount_paid).toFixed(2)} has been successfully refunded (Refund ID: ${refundId || 'N/A'}).\n\nThank you.`;
    const recipient = invoice.customer_email;
    if (recipient) {
      await this.logDispatch('email', 'INVOICE_REFUND', recipient, subject, content);
    }
  }
}

module.exports = new NotificationService();
