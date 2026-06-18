'use strict';

const jwt = require('jsonwebtoken');

let secret = process.env.JWT_SECRET;
if (!secret) {
  if (process.env.NODE_ENV === 'production') {
    console.error("FATAL ERROR: JWT_SECRET environment variable is required in production!");
    process.exit(1);
  } else {
    const crypto = require('crypto');
    secret = crypto.randomBytes(32).toString('hex');
    console.log(`[auth] JWT_SECRET unset in development, generated random secret: ${secret}`);
  }
}

const JWT_SECRET  = secret;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

/**
 * authMiddleware
 * Validates Bearer token and attaches req.user = { userId, role, email, name }
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      data: null,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
      error: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header.', fields: null },
    });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      role:   decoded.role,
      email:  decoded.email,
      name:   decoded.name,
      phone:  decoded.phone || '',
      company: decoded.company || '',
      billing_address: decoded.billing_address || '',
    };
    next();
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      data: null,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
      error: {
        code:    isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
        message: isExpired ? 'Session expired. Please log in again.' : 'Invalid access token.',
        fields:  null,
      },
    });
  }
}

module.exports = authMiddleware;
module.exports.JWT_SECRET  = JWT_SECRET;
module.exports.JWT_EXPIRES = JWT_EXPIRES;
