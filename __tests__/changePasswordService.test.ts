import { secureStorage } from '../src/services/storage/secureStorage';
import { ApiError } from '../src/types/api';
import { createChangePasswordSchema } from '../src/features/settings/schemas/changePasswordSchema';
import {
  changePasswordService,
  passwordChangePolicy,
} from '../src/features/settings/services/changePasswordService';
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
const member = { id: 8, name: 'Member', email: 'member@example.test' };
beforeEach(() => {
  useAuthStore.getState().setUser(member);
  useDevelopmentStore.setState({ previewActive: false });
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('real-test-token');
  jest
    .spyOn(secureStorage, 'removeTokenIfCurrent')
    .mockImplementation(async (_token, current) => current());
});
afterEach(() => jest.restoreAllMocks());
const accepted = {
  status: 200,
  data: {
    success: true,
    message: 'Password changed successfully. Sign in again.',
    data: { reauthentication_required: true },
  },
};
test('posts exact contract and clears revoked credentials without Logout API', async () => {
  const post = jest.spyOn(apiClient, 'post').mockResolvedValue(accepted);
  await expect(changePasswordService.update(values)).resolves.toEqual({
    updated: true,
    session: 'revoked',
  });
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith(
    '/customer/change-password',
    {
      current_password: values.currentPassword,
      password: values.newPassword,
      password_confirmation: values.confirmPassword,
    },
    expect.objectContaining({
      headers: { Authorization: 'Bearer real-test-token' },
    }),
  );
  expect(secureStorage.removeTokenIfCurrent).toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
});
test.each([
  'network',
  'server',
  'forbidden',
  'rate-limit',
  'validation',
] as const)('%s retains current session', async kind => {
  jest
    .spyOn(apiClient, 'post')
    .mockRejectedValue(new ApiError('private details', kind));
  await expect(changePasswordService.update(values)).rejects.toMatchObject({
    kind,
  });
  expect(secureStorage.removeTokenIfCurrent).not.toHaveBeenCalled();
  expect(useAuthStore.getState().user).toBe(member);
});
test('unexpected response cannot clear credentials', async () => {
  jest
    .spyOn(apiClient, 'post')
    .mockResolvedValue({ status: 200, data: { success: true, data: {} } });
  await expect(changePasswordService.update(values)).rejects.toMatchObject({
    kind: 'unknown',
  });
  expect(secureStorage.removeTokenIfCurrent).not.toHaveBeenCalled();
});
test.each([false, true])(
  'guest/demo never calls real API (preview %s)',
  async previewActive => {
    useAuthStore.getState().clear();
    useDevelopmentStore.setState({ previewActive });
    const post = jest.spyOn(apiClient, 'post');
    await expect(changePasswordService.update(values)).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    expect(post).not.toHaveBeenCalled();
  },
);
test('late response cannot clear replacement session', async () => {
  jest.spyOn(apiClient, 'post').mockImplementation(async () => {
    useAuthStore.getState().setUser({ ...member, id: 9 });
    return accepted;
  });
  await expect(changePasswordService.update(values)).rejects.toMatchObject({
    kind: 'cancelled',
  });
  expect(useAuthStore.getState().user?.id).toBe(9);
  expect(secureStorage.removeTokenIfCurrent).not.toHaveBeenCalled();
});
test('invalid local password never submits', async () => {
  const post = jest.spyOn(apiClient, 'post');
  await expect(
    changePasswordService.update({
      ...values,
      newPassword: 'short',
      confirmPassword: 'short',
    }),
  ).rejects.toMatchObject({ kind: 'validation' });
  expect(post).not.toHaveBeenCalled();
});
test('UTF8 passwords obey bcrypt cap without invented complexity', () => {
  const schema = createChangePasswordSchema(passwordChangePolicy);
  expect(
    schema.safeParse({
      ...values,
      newPassword: 'a'.repeat(8),
      confirmPassword: 'a'.repeat(8),
    }).success,
  ).toBe(true);
  expect(
    schema.safeParse({
      ...values,
      newPassword: '\uD83D\uDE00'.repeat(19),
      confirmPassword: '\uD83D\uDE00'.repeat(19),
    }).success,
  ).toBe(false);
});
test('aborted navigation does not send a password request', async () => {
  const post = jest.spyOn(apiClient, 'post');
  const controller = new AbortController();
  controller.abort();
  await expect(
    changePasswordService.update(values, controller.signal),
  ).rejects.toMatchObject({ kind: 'cancelled' });
  expect(post).not.toHaveBeenCalled();
});
test('duplicate submissions send only one request', async () => {
  let finish!: (value: typeof accepted) => void;
  const post = jest.spyOn(apiClient, 'post').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const first = changePasswordService.update(values);
  await Promise.resolve();
  await expect(changePasswordService.update(values)).rejects.toMatchObject({
    kind: 'cancelled',
  });
  finish(accepted);
  await first;
  expect(post).toHaveBeenCalledTimes(1);
});
test('secure cleanup failure is distinguishable from a failed password change', async () => {
  jest.spyOn(apiClient, 'post').mockResolvedValue(accepted);
  jest
    .mocked(secureStorage.removeTokenIfCurrent)
    .mockRejectedValue(new Error('keychain'));
  await expect(changePasswordService.update(values)).rejects.toThrow(
    'Password changed, but secure local sign-out needs to be retried.',
  );
  expect(useAuthStore.getState().user).toBe(member);
});
