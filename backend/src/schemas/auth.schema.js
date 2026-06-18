'use strict';

const { z } = require('zod');

// Strong password schema (min 8 characters, at least 1 uppercase, 1 lowercase, and 1 number/special char)
const passwordSchema = z.string()
  .min(8, { message: 'Password must be at least 8 characters long.' })
  .refine(v => /[A-Z]/.test(v), { message: 'Password must contain at least one uppercase letter.' })
  .refine(v => /[a-z]/.test(v), { message: 'Password must contain at least one lowercase letter.' })
  .refine(v => /[\d\W]/.test(v), { message: 'Password must contain at least one number or special character.' });

const loginSchema = z.object({
  email: z.string().email({ message: 'Must be a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

const registerSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters long.' }).max(120),
  email: z.string().email({ message: 'Must be a valid email address.' }),
  password: passwordSchema,
  phone: z.string().min(7).max(20).refine((v) => /^\+?[\d\s\-().]{7,20}$/.test(v), {
    message: 'Must be a valid phone number',
  }),
  role: z.enum(['CUSTOMER']),
});

const employeeCreateSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters long.' }).max(120),
  email: z.string().email({ message: 'Must be a valid email address.' }),
  password: passwordSchema,
});

const passwordChangeSchema = z.object({
  oldPassword: z.string().min(1, { message: 'Current password is required.' }),
  newPassword: passwordSchema,
});

module.exports = {
  loginSchema,
  registerSchema,
  employeeCreateSchema,
  passwordChangeSchema,
};
