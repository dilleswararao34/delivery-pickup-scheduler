'use strict';

/**
 * requireRole factory middleware
 * Usage: router.get('/admin-only', requireRole('ADMIN'), handler)
 * Usage: router.get('/either',     requireRole('ADMIN', 'CUSTOMER'), handler)
 *
 * Depends on authMiddleware having already populated req.user.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        data: null,
        meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.', fields: null },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        data: null,
        meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
        error: {
          code:    'FORBIDDEN',
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}.`,
          fields:  null,
        },
      });
    }

    next();
  };
}

module.exports = requireRole;
