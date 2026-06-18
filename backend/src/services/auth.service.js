'use strict';

const db      = require('../config/db');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES } = require('../middleware/auth.middleware');

/**
 * Find user by email and verify password.
 * Returns { userId, email, name, role } on success.
 * Throws structured error on failure.
 */
async function authenticate(email, password) {
  const result = await db.query(
    `SELECT user_id, email, name, role, password_hash, is_active
     FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );

  const user = result.rows[0];

  if (!user) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  if (!user.is_active) {
    const err = new Error('This account has been deactivated. Contact SD Digitals support.');
    err.statusCode = 403;
    err.code = 'ACCOUNT_DEACTIVATED';
    throw err;
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  let profile = {};
  if (user.role === 'CUSTOMER') {
    const custRes = await db.query(
      "SELECT phone, company, billing_address FROM customers WHERE email = $1",
      [user.email]
    );
    if (custRes.rows.length) {
      profile = custRes.rows[0];
    }
  }

  const payload = {
    userId: user.user_id,
    email:  user.email,
    name:   user.name,
    role:   user.role,
    phone:  profile.phone || '',
    company: profile.company || '',
    billing_address: profile.billing_address || '',
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  return {
    accessToken,
    user: payload,
  };
}

/**
 * Hash a plain-text password (used by seed).
 */
async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

/**
 * Register a new user in the database.
 * If user is a customer, creates both user and customer profile.
 */
async function registerUser({ name, email, password, role, phone }) {
  // Check if exists
  const existing = await db.query('SELECT user_id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  if (existing.rows.length > 0) {
    const err = new Error('An account with this email already exists.');
    err.statusCode = 409;
    err.code = 'EMAIL_ALREADY_EXISTS';
    throw err;
  }

  const password_hash = await hashPassword(password);
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    // Insert into users
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, email, name, role`,
      [email.toLowerCase().trim(), password_hash, name, role]
    );
    const newUser = userRes.rows[0];

    // If role is CUSTOMER, also insert into customers table
    if (role === 'CUSTOMER') {
      await client.query(
        `INSERT INTO customers (name, email, phone)
         VALUES ($1, $2, $3)`,
        [name, email.toLowerCase().trim(), phone || '+91 99999 99999']
      );
    }

    await client.query('COMMIT');

    let profile = {};
    if (newUser.role === 'CUSTOMER') {
      const custRes = await client.query(
        "SELECT phone, company, billing_address FROM customers WHERE email = $1",
        [newUser.email]
      );
      if (custRes.rows.length) {
        profile = custRes.rows[0];
      }
    }

    // Generate JWT token automatically for session
    const payload = {
      userId: newUser.user_id,
      email:  newUser.email,
      name:   newUser.name,
      role:   newUser.role,
      phone:  profile.phone || phone || '',
      company: profile.company || '',
      billing_address: profile.billing_address || '',
    };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    return {
      accessToken,
      user: payload
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Authenticate or register a Google user on-the-fly.
 */
async function googleAuthenticate({ name, email, role }) {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check if user exists
  const existing = await db.query(
    `SELECT user_id, email, name, role, is_active
     FROM users WHERE email = $1`,
    [normalizedEmail]
  );

  let user = existing.rows[0];

  if (user) {
    if (!user.is_active) {
      const err = new Error('This account has been deactivated. Contact SD Digitals support.');
      err.statusCode = 403;
      err.code = 'ACCOUNT_DEACTIVATED';
      throw err;
    }
  } else {
    // 2. If user does not exist, register them on-the-fly
    // Generate a secure random password hash since password is not used for Google SSO users
    const randomPassword = Math.random().toString(36).substring(2, 15) + 'A1!';
    const password_hash = await hashPassword(randomPassword);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES ($1, $2, $3, 'CUSTOMER')
         RETURNING user_id, email, name, role`,
        [normalizedEmail, password_hash, name]
      );
      user = userRes.rows[0];

      if (user.role === 'CUSTOMER') {
        await client.query(
          `INSERT INTO customers (name, email, phone)
           VALUES ($1, $2, $3)`,
          [name, normalizedEmail, '+91 99999 99999']
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  let profile = {};
  if (user.role === 'CUSTOMER') {
    const custRes = await db.query(
      "SELECT phone, company, billing_address FROM customers WHERE email = $1",
      [user.email]
    );
    if (custRes.rows.length) {
      profile = custRes.rows[0];
    }
  }

  const payload = {
    userId: user.user_id,
    email:  user.email,
    name:   user.name,
    role:   user.role,
    phone:  profile.phone || '',
    company: profile.company || '',
    billing_address: profile.billing_address || '',
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  return {
    accessToken,
    user: payload,
  };
}

async function listEmployees() {
  const result = await db.query(
    `SELECT user_id, email, name, role, is_active, created_at, updated_at
     FROM users WHERE role = 'EMPLOYEE' ORDER BY name`
  );
  return result.rows;
}

async function updateUserStatus(userId, isActive) {
  const result = await db.query(
    `UPDATE users SET is_active = $1, updated_at = NOW()
     WHERE user_id = $2
     RETURNING user_id, email, name, role, is_active`,
    [isActive, userId]
  );
  if (!result.rows.length) {
    const err = new Error(`User with ID ${userId} not found.`);
    err.statusCode = 404;
    throw err;
  }
  return result.rows[0];
}

async function forceUserPassword(userId, tempPassword) {
  const hash = await bcrypt.hash(tempPassword, 12);
  const result = await db.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW()
     WHERE user_id = $2
     RETURNING user_id`,
    [hash, userId]
  );
  if (!result.rows.length) {
    const err = new Error(`User with ID ${userId} not found.`);
    err.statusCode = 404;
    throw err;
  }
  return true;
}

async function changeUserPassword(userId, oldPassword, newPassword) {
  const userRes = await db.query(
    `SELECT password_hash FROM users WHERE user_id = $1`,
    [userId]
  );
  if (!userRes.rows.length) {
    const err = new Error('User not found.');
    err.statusCode = 404;
    throw err;
  }
  
  const passwordMatch = await bcrypt.compare(oldPassword, userRes.rows[0].password_hash);
  if (!passwordMatch) {
    const err = new Error('Invalid current password.');
    err.statusCode = 400;
    throw err;
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await db.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2`,
    [hash, userId]
  );
  return true;
}

async function listCustomers() {
  const result = await db.query(
    `SELECT id, name, email, phone, company, billing_address, created_at, updated_at
     FROM customers ORDER BY name`
  );
  return result.rows;
}

async function updateUserProfile(userId, role, { name, phone, company, billing_address }) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    // Fetch current email of the user
    const userRes = await client.query(
      `SELECT email FROM users WHERE user_id = $1`,
      [userId]
    );
    if (!userRes.rows.length) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }
    const currentEmail = userRes.rows[0].email;

    // Update users table name
    if (name) {
      await client.query(
        `UPDATE users SET name = $1, updated_at = NOW() WHERE user_id = $2`,
        [name, userId]
      );
    }

    // If role is CUSTOMER, also update customers table
    if (role === 'CUSTOMER') {
      // Upsert customer record if it doesn't exist, else update it
      const custCheck = await client.query(
        `SELECT id FROM customers WHERE email = $1`,
        [currentEmail]
      );

      if (custCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO customers (name, email, phone, company, billing_address)
           VALUES ($1, $2, $3, $4, $5)`,
          [name || 'Customer Name', currentEmail, phone || '', company || '', billing_address || '']
        );
      } else {
        await client.query(
          `UPDATE customers 
           SET name = COALESCE($1, name), 
               phone = COALESCE($2, phone), 
               company = COALESCE($3, company), 
               billing_address = COALESCE($4, billing_address),
               updated_at = NOW()
           WHERE email = $5`,
          [name, phone, company, billing_address, currentEmail]
        );
      }
    }

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
  authenticate,
  hashPassword,
  registerUser,
  googleAuthenticate,
  listEmployees,
  updateUserStatus,
  forceUserPassword,
  changeUserPassword,
  listCustomers,
  updateUserProfile
};

