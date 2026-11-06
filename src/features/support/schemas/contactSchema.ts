import { z } from 'zod';
export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your full name.')
    .max(100, 'Use 100 characters or fewer.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address.')
    .max(254),
  subject: z
    .string()
    .trim()
    .min(1, 'Enter a subject.')
    .max(150, 'Use 150 characters or fewer.'),
  category: z.string().trim().min(1, 'Select a category.'),
  message: z
    .string()
    .trim()
    .min(10, 'Enter at least 10 characters.')
    .max(5000, 'Use 5,000 characters or fewer.'),
});
export type ContactValues = z.infer<typeof contactSchema>;
export const contactAcceptanceSchema = z.object({
  accepted: z.literal(true),
  reference: z.string().min(1).optional(),
});
