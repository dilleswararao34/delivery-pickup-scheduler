'use strict';

/**
 * Global error handler middleware.
 * Formats all thrown errors into the standard response envelope.
 */
module.exports = function errorHandler(err, req, res, next) {
  const status    = err.statusCode || err.status || 500;
  const code      = err.code       || 'INTERNAL_SERVER_ERROR';
  const message   = err.message    || 'An unexpected error occurred';
  const fields    = err.fields     || null;

  // Structured server-side log
  const logEntry = {
    level:     status >= 500 ? 'error' : 'warn',
    code,
    message,
    status,
    method:    req.method,
    path:      req.originalUrl,
    requestId: req.requestId || req.headers['x-request-id'] || null,
    timestamp: new Date().toISOString(),
  };

  if (status >= 500) {
    logEntry.stack = err.stack;
    console.error('[error]', JSON.stringify(logEntry));
  } else {
    console.warn('[warn]', JSON.stringify(logEntry));
  }

  res.status(status).json({
    success: false,
    data:    null,
    meta: {
      requestId:  req.requestId || null,
      timestamp:  new Date().toISOString(),
      pagination: null,
    },
    error: { code, message, fields },
  });
};
