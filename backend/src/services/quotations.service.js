'use strict';

const db = require('../config/db');
const stateMachine = require('./stateMachine.service');
const notificationsService = require('./notifications.service');

/**
 * Get all quotation requests
 */
async function listQuotations(filters = {}) {
  let query = `
    SELECT qr.*, 
           c.name AS customer_name, c.email AS customer_email, c.company AS customer_company,
           b.booking_ref
    FROM quotation_requests qr
    JOIN customers c ON qr.customer_id = c.id
    JOIN bookings b ON qr.booking_id = b.id
    WHERE 1=1
  `;
  const params = [];
  
  if (filters.customer_id) {
    params.push(filters.customer_id);
    query += ` AND qr.customer_id = $${params.length}`;
  }
  if (filters.customer_email) {
    params.push(filters.customer_email);
    query += ` AND c.email = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    query += ` AND qr.status = $${params.length}`;
  }

  query += ` ORDER BY qr.updated_at DESC`;

  const res = await db.query(query, params);
  
  // also fetch versions for each
  for (let q of res.rows) {
      const vRes = await db.query(`SELECT * FROM quotation_versions WHERE quotation_request_id = $1 ORDER BY version_number ASC`, [q.id]);
      q.versions = vRes.rows;
  }
  
  return res.rows;
}

/**
 * Get a specific quotation request with its versions
 */
async function getQuotationById(id) {
  const qRes = await db.query(`
    SELECT qr.*, 
           c.name AS customer_name, c.email AS customer_email, c.company AS customer_company, c.phone AS customer_phone,
           b.booking_ref, b.status AS booking_status
    FROM quotation_requests qr
    JOIN customers c ON qr.customer_id = c.id
    JOIN bookings b ON qr.booking_id = b.id
    WHERE qr.id = $1
  `, [id]);

  if (!qRes.rows.length) {
    throw new Error('Quotation request not found');
  }
  const quotation = qRes.rows[0];

  const vRes = await db.query(`
    SELECT * FROM quotation_versions
    WHERE quotation_request_id = $1
    ORDER BY version_number ASC
  `, [id]);
  
  quotation.versions = vRes.rows;
  return quotation;
}

/**
 * Customer requests a revision
 */
async function requestRevision(id, customerEmail, notes) {
  const quotation = await getQuotationById(id);
  if (quotation.customer_email.toLowerCase().trim() !== customerEmail.toLowerCase().trim()) {
    throw new Error('Unauthorized to revise this quotation');
  }

  if (quotation.status !== 'QUOTE_PROVIDED' && quotation.status !== 'PENDING_QUOTE') {
    throw new Error(\`Cannot request revision for quotation in status \${quotation.status}\`);
  }

  await db.query(
    \`UPDATE quotation_requests 
     SET status = 'NEGOTIATING', notes_from_customer = $1, updated_at = NOW() 
     WHERE id = $2\`,
    [notes, id]
  );

  return { success: true, message: 'Revision requested successfully' };
}

/**
 * Admin sends a revised quote
 */
async function sendRevisedQuote(id, adminEmail, newAmount, discountReason, adminNotes, breakdown) {
  const quotation = await getQuotationById(id);
  
  // Calculate next version number
  const nextVersion = quotation.versions.length + 1;

  // Insert new version
  await db.query(\`
    INSERT INTO quotation_versions (
      quotation_request_id, version_number, quote_amount, breakdown, discount_reason, notes_from_admin, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  \`, [id, nextVersion, newAmount, JSON.stringify(breakdown), discountReason, adminNotes, adminEmail]);

  // Update quotation request status
  await db.query(
    \`UPDATE quotation_requests SET status = 'QUOTE_PROVIDED', updated_at = NOW() WHERE id = $1\`,
    [id]
  );

  // Email customer
  const mockBooking = {
    booking_ref: quotation.booking_ref,
    customer_name: quotation.customer_name,
    customer_email: quotation.customer_email
  };
  
  // We can just log the email for now or write a custom email method
  console.log(\`Sending Quote Ready Email to \${quotation.customer_email} for amount \${newAmount}\`);

  return { success: true, message: 'Revised quote sent' };
}

/**
 * Customer accepts a quote
 */
async function acceptQuote(quotationId, versionId, customerEmail) {
  const quotation = await getQuotationById(quotationId);
  if (quotation.customer_email.toLowerCase().trim() !== customerEmail.toLowerCase().trim()) {
    throw new Error('Unauthorized to accept this quotation');
  }

  if (quotation.status === 'ACCEPTED' || quotation.status === 'REJECTED') {
    throw new Error('Quotation is already finalized');
  }

  const version = quotation.versions.find(v => v.id === versionId);
  if (!version) {
    throw new Error('Quotation version not found');
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Mark version as accepted
    await client.query(\`
      UPDATE quotation_versions
      SET accepted_by_customer = TRUE, accepted_at = NOW()
      WHERE id = $1
    \`, [versionId]);

    // Mark quotation as accepted
    await client.query(\`
      UPDATE quotation_requests
      SET status = 'ACCEPTED', updated_at = NOW()
      WHERE id = $1
    \`, [quotationId]);

    // Update booking status to CONFIRMED
    await client.query(\`
      UPDATE bookings
      SET status = 'CONFIRMED', updated_at = NOW()
      WHERE id = $1
    \`, [quotation.booking_id]);

    // Log the transition
    await client.query(\`
      INSERT INTO booking_status_history (booking_id, from_status, to_status, changed_by, reason)
      VALUES ($1, $2, $3, $4, $5)
    \`, [
      quotation.booking_id, quotation.booking_status, 'CONFIRMED', quotation.customer_name,
      'Customer accepted quotation version ' + version.version_number
    ]);

    // Update invoice amount
    const invRes = await client.query(\`SELECT id FROM invoices WHERE booking_id = $1\`, [quotation.booking_id]);
    
    if (invRes.rows.length > 0) {
      await client.query(\`
        UPDATE invoices
        SET amount_due = $1, updated_at = NOW()
        WHERE id = $2
      \`, [version.quote_amount, invRes.rows[0].id]);
    } else {
      await client.query(\`
        INSERT INTO invoices (booking_id, invoice_ref, amount_due, status, due_at)
        VALUES ($1, $2, $3, 'UNPAID', NOW() + INTERVAL '1 day')
      \`, [quotation.booking_id, \`INV-\${quotation.booking_ref.slice(3)}\`, version.quote_amount]);
    }

    await client.query('COMMIT');
    return { success: true, booking_id: quotation.booking_id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Customer rejects a quote
 */
async function rejectQuote(quotationId, customerEmail) {
  const quotation = await getQuotationById(quotationId);
  if (quotation.customer_email.toLowerCase().trim() !== customerEmail.toLowerCase().trim()) {
    throw new Error('Unauthorized to reject this quotation');
  }

  if (quotation.status === 'ACCEPTED' || quotation.status === 'REJECTED') {
    throw new Error('Quotation is already finalized');
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    await client.query(\`
      UPDATE quotation_requests
      SET status = 'REJECTED', updated_at = NOW()
      WHERE id = $1
    \`, [quotationId]);

    // Cancel booking
    await client.query(\`
      UPDATE bookings
      SET status = 'ARCHIVED', is_deleted = TRUE, updated_at = NOW()
      WHERE id = $1
    \`, [quotation.booking_id]);

    await client.query(\`
      INSERT INTO booking_status_history (booking_id, from_status, to_status, changed_by, reason)
      VALUES ($1, $2, $3, $4, $5)
    \`, [
      quotation.booking_id, quotation.booking_status, 'ARCHIVED', quotation.customer_name,
      'Customer rejected quotation'
    ]);

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listQuotations,
  getQuotationById,
  requestRevision,
  sendRevisedQuote,
  acceptQuote,
  rejectQuote
};
