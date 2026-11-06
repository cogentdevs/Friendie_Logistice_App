import { createChangePasswordSchema } from '../src/features/settings/schemas/changePasswordSchema';
import { changePasswordService } from '../src/features/settings/services/changePasswordService';
import { apiClient } from '../src/services/api/apiClient';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
const values = {
  currentPassword: 'Original-1',
  newPassword: 'Different-2',
  confirmPassword: 'Different-2',
};
test('unknown backend policy enforces required/matching values without inventing reuse rules', () => {
  expect(
    createChangePasswordSchema(null).safeParse({
      currentPassword: 'x',
      newPassword: 'x',
      confirmPassword: 'x',
    }).success,
  ).toBe(true);
  expect(
    createChangePasswordSchema(null).safeParse({
      ...values,
      currentPassword: '',
    }).success,
  ).toBe(false);
});
test('verified policy can enforce length, case, numbers, symbols and non-reuse without trimming secrets', () => {
  const schema = createChangePasswordSchema({
    minimumLength: 10,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSymbol: true,
    rejectCurrentPassword: true,
  });
  expect(
    schema.safeParse({
      ...values,
      newPassword: values.currentPassword,
      confirmPassword: values.currentPassword,
    }).success,
  ).toBe(false);
  expect(
    schema.safeParse({
      ...values,
      newPassword: 'short',
      confirmPassword: 'short',
    }).success,
  ).toBe(false);
  expect(schema.parse(values).newPassword).toBe('Different-2');
});
test('unverified endpoint never receives a guessed request or returns success', async () => {
  useDevelopmentStore.setState({ previewActive: false });
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
  const post = jest.spyOn(apiClient, 'post'),
    patch = jest.spyOn(apiClient, 'patch');
  await expect(changePasswordService.update(values)).rejects.toThrow(
    'not connected yet',
  );
  expect(post).not.toHaveBeenCalled();
  expect(patch).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});
