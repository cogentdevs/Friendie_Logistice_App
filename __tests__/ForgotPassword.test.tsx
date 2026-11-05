import React from 'react';
import { TextInput } from 'react-native';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ForgotPasswordScreen,
  resetConfirmation,
} from '../src/features/auth/screens/ForgotPasswordScreen';
import { passwordResetService } from '../src/features/auth/services/passwordResetService';
import { appConfig } from '../src/constants/appConfig';
import { ApiError } from '../src/types/api';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
let tree: ReactTestRenderer;
let client: QueryClient;
const popTo = jest.fn();
const originalPreview = appConfig.uiPreviewEnabled;
beforeEach(async () => {
  appConfig.uiPreviewEnabled = false;
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: 0 } },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <ForgotPasswordScreen
          navigation={
            { popTo } as unknown as React.ComponentProps<
              typeof ForgotPasswordScreen
            >['navigation']
          }
          route={{ key: 'forgot', name: 'ForgotPassword' }}
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
  appConfig.uiPreviewEnabled = originalPreview;
  jest.restoreAllMocks();
  popTo.mockClear();
});
const input = () => tree.root.findByType(TextInput);
const button = (label: string) =>
  tree.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
const textPresent = (text: string) =>
  tree.root.findAll(node => node.props.children === text).length > 0;
async function press(label: string) {
  await Renderer.act(async () => {
    await button(label).props.onPress();
  });
}
async function fill(email = '  DEMO@Example.test  ') {
  await Renderer.act(async () => {
    input().props.onChangeText(email);
  });
}
test('empty and malformed email errors stay local', async () => {
  const send = jest.spyOn(passwordResetService, 'request');
  await press('Send Reset Link');
  expect(textPresent('Enter your email address')).toBe(true);
  await fill('invalid');
  await press('Send Reset Link');
  expect(textPresent('Enter a valid email address')).toBe(true);
  expect(send).not.toHaveBeenCalled();
});
test('accepted request normalizes email and shows neutral confirmation without exposing email', async () => {
  const send = jest
    .spyOn(passwordResetService, 'request')
    .mockResolvedValue({ accepted: true });
  await fill();
  await press('Send Reset Link');
  expect(send).toHaveBeenCalledWith({ email: 'demo@example.test' });
  expect(textPresent('Check Your Email')).toBe(true);
  expect(textPresent(resetConfirmation)).toBe(true);
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  expect(textPresent('demo@example.test')).toBe(false);
  expect(button('Resend Reset Link')).toBeUndefined();
  const backButtons = tree.root.findAll(
    node =>
      node.props.accessibilityLabel === 'Back to Sign In' &&
      typeof node.props.onPress === 'function',
  );
  await Renderer.act(async () => {
    backButtons.at(-1)!.props.onPress();
  });
  expect(popTo).toHaveBeenCalledWith('Login');
});
test('unexpected response cannot display acceptance', async () => {
  jest
    .spyOn(passwordResetService, 'request')
    .mockResolvedValue(undefined as unknown as { accepted: true });
  await fill();
  await press('Send Reset Link');
  expect(textPresent('Check Your Email')).toBe(false);
  expect(
    textPresent(
      'Password reset is currently unavailable. Please try again later.',
    ),
  ).toBe(true);
});
test.each([
  ['validation', 'Check the email address format and try again.'],
  [
    'network',
    'Connection failed or timed out. Check your connection and try again.',
  ],
  ['rate-limit', 'Too many attempts. Please wait before trying again.'],
  [
    'server',
    'Password reset is temporarily unavailable. Please try again later.',
  ],
  [
    'unknown',
    'Password reset is currently unavailable. Please try again later.',
  ],
] as const)(
  '%s error stays neutral and never claims delivery',
  async (kind, expected) => {
    jest
      .spyOn(passwordResetService, 'request')
      .mockRejectedValue(
        new ApiError(
          'This email is not registered: private@example.test',
          kind,
          422,
          { email: ['Account not found'] },
        ),
      );
    await fill();
    await press('Send Reset Link');
    expect(textPresent(expected)).toBe(true);
    expect(textPresent('Account not found')).toBe(false);
    expect(textPresent('Check Your Email')).toBe(false);
    expect(button('Send Reset Link').props.disabled).toBe(false);
  },
);
test('pending request disables controls and guards keyboard and button duplicate submissions', async () => {
  let finish!: (value: { accepted: true }) => void;
  const send = jest.spyOn(passwordResetService, 'request').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await fill();
  await press('Send Reset Link');
  expect(input().props.editable).toBe(false);
  expect(button('Send Reset Link').props.disabled).toBe(true);
  await Renderer.act(async () => {
    input().props.onSubmitEditing();
  });
  await press('Send Reset Link');
  expect(send).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => {
    finish({ accepted: true });
  });
  expect(textPresent('Check Your Email')).toBe(true);
});
test('header and footer return to existing Login screen', async () => {
  await press('Back to Sign In');
  await press('Back to Sign In footer');
  expect(popTo).toHaveBeenNthCalledWith(1, 'Login');
  expect(popTo).toHaveBeenNthCalledWith(2, 'Login');
});
test('UI-only confirmation preview is labeled and makes no request', async () => {
  expect(button('Preview confirmation (UI only)')).toBeUndefined();
  appConfig.uiPreviewEnabled = true;
  await fill();
  const send = jest.spyOn(passwordResetService, 'request');
  await press('Preview confirmation (UI only)');
  expect(
    textPresent(
      'UI preview only. No reset request was made and no email was sent.',
    ),
  ).toBe(true);
  expect(send).not.toHaveBeenCalled();
  await press('Back to reset form');
  expect(input().props.value).toBe('  DEMO@Example.test  ');
});
