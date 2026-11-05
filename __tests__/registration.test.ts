import {
  internationalPhone,
  registerSchema,
} from '../src/features/auth/schemas/registerSchema';
import {
  prepareRegistration,
  registrationService,
} from '../src/features/auth/services/registrationService';
import { apiClient } from '../src/services/api/apiClient';
const valid = {
  fullName: '  Demo Traveller  ',
  email: '  DEMO@Example.test ',
  country: 'PK' as const,
  phone: '0300 1234567',
  password: 'Test-pass-123',
  confirmPassword: 'Test-pass-123',
  acceptedTerms: true,
};
test('normalizes name, email and international phone without trimming passwords', () => {
  expect(prepareRegistration(valid)).toMatchObject({
    fullName: 'Demo Traveller',
    email: 'demo@example.test',
    phone: '+923001234567',
    password: valid.password,
  });
});
test.each([
  ['AE', '0501234567', '+971501234567'],
  ['SA', '+966501234567', '+966501234567'],
  ['GB', '07700900123', '+447700900123'],
  ['US', '(202) 555-0123', '+12025550123'],
] as const)('supported %s format is normalized', (country, phone, expected) => {
  expect(internationalPhone(phone, country)).toBe(expected);
});
test('rejects mismatched calling codes, letters, extensions and bad lengths', () => {
  for (const phone of [
    '+971501234567',
    '0300abc4567',
    '03001234567 ext 1',
    '123',
    '-3001234567',
  ])
    expect(internationalPhone(phone, 'PK')).toBeUndefined();
  expect(internationalPhone('02025550123', 'US')).toBeUndefined();
});
test('requires consent, minimum password, matching confirmation and nonempty name', () => {
  const result = registerSchema.safeParse({
    ...valid,
    fullName: ' ',
    acceptedTerms: false,
    password: 'short',
    confirmPassword: 'different',
  });
  expect(result.success).toBe(false);
  if (!result.success)
    expect(result.error.issues.map(issue => issue.path[0])).toEqual(
      expect.arrayContaining([
        'fullName',
        'acceptedTerms',
        'password',
        'confirmPassword',
      ]),
    );
});
test('unverified registration never calls a guessed endpoint or creates a session', async () => {
  const post = jest.spyOn(apiClient, 'post');
  await expect(registrationService.register(valid)).rejects.toThrow(
    'not connected yet',
  );
  expect(post).not.toHaveBeenCalled();
  post.mockRestore();
});
