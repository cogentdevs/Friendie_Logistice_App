import { contactSchema } from '../src/features/support/schemas/contactSchema';
import {
  contactService,
  supportConfig,
} from '../src/features/support/services/contactService';
import { apiClient } from '../src/services/api/apiClient';
const values = {
  name: ' Member ',
  email: ' MEMBER@example.test ',
  subject: ' Help ',
  category: 'test',
  message: 'Please help with my listing.',
};
afterEach(() => jest.restoreAllMocks());
test('normalizes values, rejects empty/oversize message and invalid email', () => {
  expect(contactSchema.parse(values)).toMatchObject({
    name: 'Member',
    email: 'member@example.test',
    subject: 'Help',
  });
  for (const message of ['', 'short', 'x'.repeat(5001)])
    expect(contactSchema.safeParse({ ...values, message }).success).toBe(false);
  expect(contactSchema.safeParse({ ...values, email: 'bad' }).success).toBe(
    false,
  );
});
test('unverified endpoint sends no personal data and never fabricates acceptance', async () => {
  const post = jest.spyOn(apiClient, 'post'),
    old = supportConfig.categories;
  try {
    supportConfig.categories = [{ id: 'test', name: 'Test' }];
    await expect(contactService.submit(values)).rejects.toThrow(
      'not been sent',
    );
    expect(post).not.toHaveBeenCalled();
  } finally {
    supportConfig.categories = old;
  }
});
