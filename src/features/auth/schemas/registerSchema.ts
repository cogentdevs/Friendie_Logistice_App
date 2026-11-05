import { z } from 'zod';

// Supported mobile-number formats; this does not verify ownership or assignment.
export const phoneCountries = [
  { id: 'PK', name: 'Pakistan', dial: '92', pattern: /^3\d{9}$/ },
  { id: 'AE', name: 'United Arab Emirates', dial: '971', pattern: /^5\d{8}$/ },
  { id: 'SA', name: 'Saudi Arabia', dial: '966', pattern: /^5\d{8}$/ },
  { id: 'GB', name: 'United Kingdom', dial: '44', pattern: /^7\d{9}$/ },
  {
    id: 'US',
    name: 'United States',
    dial: '1',
    pattern: /^[2-9]\d{2}[2-9]\d{6}$/,
  },
] as const;
export type PhoneCountry = (typeof phoneCountries)[number]['id'];
export function internationalPhone(value: string, countryId: PhoneCountry) {
  const country = phoneCountries.find(item => item.id === countryId)!;
  if (!/^[+\d(][\d\s()-]*$/.test(value.trim())) return undefined;
  let digits = value.replace(/[\s()-]/g, '');
  if (digits.startsWith('+')) {
    if (!digits.startsWith('+' + country.dial)) return undefined;
    digits = digits.slice(country.dial.length + 1);
  } else if (countryId === 'US' && digits.length === 11 && digits[0] === '1') {
    digits = digits.slice(1);
  } else if (countryId !== 'US' && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return country.pattern.test(digits) ? '+' + country.dial + digits : undefined;
}
// Local baseline only. Confirm the full password policy with the registration API.
export const registerSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Enter your full name'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email('Enter a valid email address')),
    country: z.enum(['PK', 'AE', 'SA', 'GB', 'US']),
    phone: z.string().trim().min(1, 'Enter your phone number'),
    password: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
    acceptedTerms: z
      .boolean()
      .refine(
        value => value,
        'Accept the Terms & Conditions and Privacy Policy',
      ),
  })
  .superRefine((values, context) => {
    if (!internationalPhone(values.phone, values.country))
      context.addIssue({
        code: 'custom',
        path: ['phone'],
        message: 'Enter a valid mobile number for the selected country',
      });
    if (values.password !== values.confirmPassword)
      context.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Passwords do not match',
      });
  });
export type RegisterValues = z.infer<typeof registerSchema>;
