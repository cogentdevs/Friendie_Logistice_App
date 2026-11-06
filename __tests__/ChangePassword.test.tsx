import React from 'react';
import { Alert, TextInput } from 'react-native';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChangePasswordScreen } from '../src/features/settings/screens/ChangePasswordScreen';
import { changePasswordService } from '../src/features/settings/services/changePasswordService';
import * as sessions from '../src/features/auth/services/sessionLogout';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { ApiError } from '../src/types/api';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: () => {},
}));
let tree: ReactTestRenderer, client: QueryClient;
const navigate = jest.fn();
beforeEach(async () => {
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
  useDevelopmentStore.setState({
    previewActive: false,
    authEntryRequested: false,
  });
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: 0 } },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <ChangePasswordScreen
          route={{ key: 'change', name: 'ChangePassword' }}
          navigation={
            { navigate } as unknown as React.ComponentProps<
              typeof ChangePasswordScreen
            >['navigation']
          }
        />
      </QueryClientProvider>,
    );
  });
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree.unmount();
    client.clear();
  });
  jest.restoreAllMocks();
  navigate.mockClear();
});
const input = (label: string) =>
  tree.root
    .findAllByType(TextInput)
    .find(node => node.props.accessibilityLabel === label)!;
const button = (label: string) =>
  tree.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
const present = (text: string) =>
  tree.root.findAll(node => node.props.children === text).length > 0;
async function press(label: string) {
  await Renderer.act(async () => {
    await button(label).props.onPress();
  });
}
async function fill() {
  await Renderer.act(async () => {
    input('Current Password').props.onChangeText('Current-pass-1');
    input('New Password').props.onChangeText('Next-pass-2');
    input('Confirm New Password').props.onChangeText('Next-pass-2');
  });
}
test('all passwords are secure by default with independent visibility controls', async () => {
  for (const label of [
    'Current Password',
    'New Password',
    'Confirm New Password',
  ])
    expect(input(label).props.secureTextEntry).toBe(true);
  await press('Show current password');
  expect(input('Current Password').props.secureTextEntry).toBe(false);
  expect(input('New Password').props.secureTextEntry).toBe(true);
  await press('Show new password');
  await press('Show confirm new password');
  expect(input('New Password').props.secureTextEntry).toBe(false);
  expect(input('Confirm New Password').props.secureTextEntry).toBe(false);
  await press('Back to Settings');
  expect(navigate).toHaveBeenCalledWith('Settings');
});
test('required fields and confirmation mismatch stay local', async () => {
  const update = jest.spyOn(changePasswordService, 'update');
  await press('Change Password');
  expect(present('Enter your current password')).toBe(true);
  expect(update).not.toHaveBeenCalled();
  await fill();
  await Renderer.act(async () => {
    input('Confirm New Password').props.onChangeText('different');
  });
  await press('Change Password');
  expect(present('Passwords do not match')).toBe(true);
  expect(update).not.toHaveBeenCalled();
});
test('retained-session success requires confirmation and clears every password', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  jest
    .spyOn(changePasswordService, 'update')
    .mockResolvedValue({ updated: true, session: 'retained' });
  const logout = jest.spyOn(sessions, 'logoutSession');
  await fill();
  await press('Change Password');
  expect(alert).toHaveBeenCalledWith(
    'Password updated',
    expect.any(String),
    expect.any(Array),
  );
  for (const label of [
    'Current Password',
    'New Password',
    'Confirm New Password',
  ])
    expect(input(label).props.value).toBe('');
  expect(logout).not.toHaveBeenCalled();
});
test('unexpected response cannot show success', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  jest
    .spyOn(changePasswordService, 'update')
    .mockResolvedValue(
      undefined as unknown as { updated: true; session: 'retained' },
    );
  await fill();
  await press('Change Password');
  expect(alert).not.toHaveBeenCalled();
  expect(
    present('Unable to confirm the password update. Please try again.'),
  ).toBe(true);
});
test('incorrect current password and server validation render sanitized inline errors', async () => {
  jest.spyOn(changePasswordService, 'update').mockRejectedValue(
    new ApiError('private server text', 'validation', 422, {
      currentPassword: ['private-value'],
      newPassword: ['weak'],
    }),
  );
  await fill();
  await press('Change Password');
  expect(present('The current password could not be verified.')).toBe(true);
  expect(present('The new password does not meet the required policy.')).toBe(
    true,
  );
  expect(present('private-value')).toBe(false);
});
test.each([
  ['network', 'Unable to connect or request timed out. Please try again.'],
  ['rate-limit', 'Too many attempts. Please wait before trying again.'],
] as const)('%s failure never reports success', async (kind, message) => {
  const alert = jest.spyOn(Alert, 'alert');
  jest
    .spyOn(changePasswordService, 'update')
    .mockRejectedValue(new ApiError('failed', kind));
  await fill();
  await press('Change Password');
  expect(present(message)).toBe(true);
  expect(alert).not.toHaveBeenCalled();
});
test('revoked session clears passwords and invokes central secure logout', async () => {
  jest
    .spyOn(changePasswordService, 'update')
    .mockResolvedValue({ updated: true, session: 'revoked' });
  const logout = jest
    .spyOn(sessions, 'logoutSession')
    .mockResolvedValue({ cacheCleared: true });
  await fill();
  await press('Change Password');
  expect(logout).toHaveBeenCalledWith(client);
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
});
test('expired session retries secure cleanup without allowing another password update', async () => {
  jest
    .spyOn(changePasswordService, 'update')
    .mockRejectedValue(new ApiError('expired', 'unauthorized', 401));
  const logout = jest
    .spyOn(sessions, 'logoutSession')
    .mockRejectedValueOnce(new Error('keychain'))
    .mockResolvedValueOnce({ cacheCleared: true });
  await fill();
  await press('Change Password');
  expect(
    present(
      'Could not clear the secure session. Retry sign out before continuing.',
    ),
  ).toBe(true);
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  expect(button('Back to Settings').props.disabled).toBe(true);
  await press('Retry secure sign out');
  expect(logout).toHaveBeenCalledTimes(2);
});
test('pending update disables inputs and guards duplicate keyboard/button sends', async () => {
  let reject!: (error: Error) => void;
  const update = jest.spyOn(changePasswordService, 'update').mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  await fill();
  await press('Change Password');
  expect(input('Current Password').props.editable).toBe(false);
  expect(button('Change Password').props.disabled).toBe(true);
  await press('Change Password');
  expect(update).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => {
    reject(new ApiError('failed', 'network'));
  });
});

test('a response for an old account cannot sign out a newly active account', async () => {
  let finish!: (value: { updated: true; session: 'revoked' }) => void;
  jest.spyOn(changePasswordService, 'update').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const logout = jest.spyOn(sessions, 'logoutSession');
  await fill();
  await press('Change Password');
  await Renderer.act(async () => {
    useAuthStore
      .getState()
      .setUser({ id: 9, name: 'Other Member', email: 'other@example.test' });
    finish({ updated: true, session: 'revoked' });
  });
  expect(logout).not.toHaveBeenCalled();
  expect(useAuthStore.getState().user?.id).toBe(9);
});
