import { forgotPasswordSchema } from '../src/features/auth/schemas/forgotPasswordSchema';
import {
  passwordResetService,
  passwordResetError,
} from '../src/features/auth/services/passwordResetService';
import { apiClient } from '../src/services/api/apiClient';
test('reset email is normalized and empty/invalid values rejected', () => {
  expect(forgotPasswordSchema.parse({ email: ' DEMO@Example.test ' })).toEqual({
    email: 'demo@example.test',
  });
  expect(forgotPasswordSchema.safeParse({ email: ' ' }).success).toBe(false);
  expect(forgotPasswordSchema.safeParse({ email: 'not email' }).success).toBe(
    false,
  );
});
test('invalid local input never calls the recovery endpoint', async () => {
  const post = jest.spyOn(apiClient, 'post');
  await expect(
    passwordResetService.request({ email: 'invalid' }),
  ).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
  post.mockRestore();
});
test('unexpected errors cannot expose backend account details', () => {
  expect(passwordResetError(new Error('private-account-detail'))).toBe(
    'Password reset is currently unavailable. Please try again later.',
  );
});
