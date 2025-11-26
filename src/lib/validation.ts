import { z } from 'zod';

export const plateSchema = z.object({
  plate_number: z.string()
    .trim()
    .min(1, 'Plate number required')
    .max(20, 'Plate number too long')
    .regex(/^[A-Z0-9\s-]+$/, 'Only letters, numbers, spaces and dashes allowed'),
  color: z.string()
    .trim()
    .max(50, 'Color too long')
    .optional(),
  brand: z.string()
    .trim()
    .max(100, 'Brand too long')
    .optional(),
  model: z.string()
    .trim()
    .max(100, 'Model too long')
    .optional(),
  description: z.string()
    .trim()
    .max(500, 'Description too long')
    .optional()
});

export const userSchema = z.object({
  telegram_id: z.string()
    .regex(/^\d+$/, 'Telegram ID must be numeric')
    .min(5, 'Telegram ID too short')
    .max(15, 'Telegram ID too long'),
  username: z.string()
    .trim()
    .max(100, 'Username too long')
    .optional(),
  first_name: z.string()
    .trim()
    .max(100, 'First name too long')
    .optional()
});

export const accessRequestSchema = z.object({
  telegram_id: z.string()
    .regex(/^\d+$/, 'Telegram ID must be numeric')
    .min(5, 'Telegram ID too short')
    .max(15, 'Telegram ID too long'),
  username: z.string()
    .trim()
    .max(100, 'Username too long')
    .optional()
    .nullable(),
  first_name: z.string()
    .trim()
    .max(100, 'First name too long')
    .optional()
    .nullable()
});
