import { z } from 'zod';
import { internationalPhone } from '../../auth/schemas/registerSchema';
export const editProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter your full name'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email('Enter a valid email address')),
    phone: z.string().trim().min(1, 'Enter your phone number'),
    callingCountry: z.enum(['PK', 'AE', 'SA', 'GB', 'US']).nullable(),
  })
  .superRefine((value, ctx) => {
    if (!value.callingCountry)
      ctx.addIssue({
        code: 'custom',
        path: ['callingCountry'],
        message: 'Select your country calling code',
      });
    if (
      value.phone &&
      value.callingCountry &&
      !internationalPhone(value.phone, value.callingCountry)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['phone'],
        message: 'Enter a valid phone number for the selected calling code',
      });
  });
export type EditProfileValues = z.infer<typeof editProfileSchema>;
