'use strict';

/**
 * Zod validation middleware factory.
 * @param {ZodSchema} schema - The Zod schema to validate against
 * @param {'body'|'query'|'params'} target - Which part of the request to validate
 */
function validate(schema, target = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const fields = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        issue: e.message,
      }));

      console.warn(`[validate] Validation failed for ${target} on ${req.method} ${req.originalUrl}:`, JSON.stringify(fields));

      const err = new Error('Request validation failed. Check the fields array for details.');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      err.fields = fields;
      return next(err);
    }

    // Replace request target with the parsed (coerced) data
    req[target] = result.data;
    next();
  };
}

module.exports = { validate };
