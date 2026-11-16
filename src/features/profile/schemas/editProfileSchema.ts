import { z } from 'zod';
import { internationalPhone } from '../../auth/schemas/registerSchema';
export function createEditProfileSchema(allowEmptyPhone = false) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, 'Enter your full name')
        .max(255, 'Use no more than 255 characters'),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .max(255, 'Use no more than 255 characters')
        .pipe(z.email('Enter a valid email address')),
      phone: z.string().trim().max(255, 'Use no more than 255 characters'),
      callingCountry: z.enum(['PK', 'AE', 'SA', 'GB', 'US']).nullable(),
    })
    .superRefine((value, ctx) => {
      if (!value.phone && !allowEmptyPhone)
        ctx.addIssue({
          code: 'custom',
          path: ['phone'],
          message: 'Enter your phone number',
        });
      if (!value.phone && allowEmptyPhone) return;
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
}
export const editProfileSchema = createEditProfileSchema();
export type EditProfileValues = z.infer<typeof editProfileSchema>;
