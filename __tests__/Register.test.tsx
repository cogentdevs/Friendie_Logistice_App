import React from 'react';
import { Linking, TextInput } from 'react-native';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RegisterScreen } from '../src/features/auth/screens/RegisterScreen';
import { registrationService } from '../src/features/auth/services/registrationService';
import { appConfig } from '../src/constants/appConfig';
import { ApiError } from '../src/types/api';
import { useAuthStore } from '../src/store/authStore';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
let tree: ReactTestRenderer;
let client: QueryClient;
const navigate = jest.fn();
const legal = {
  termsUrl: appConfig.termsUrl,
  privacyUrl: appConfig.privacyUrl,
};
beforeEach(async () => {
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: 0 } },
  });
  appConfig.termsUrl = '';
  appConfig.privacyUrl = '';
  useAuthStore.getState().clear();
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <RegisterScreen
          navigation={
            { popTo: navigate, navigate } as unknown as React.ComponentProps<
              typeof RegisterScreen
            >['navigation']
          }
          route={{ key: 'register', name: 'Register' }}
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
  Object.assign(appConfig, legal);
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
const textPresent = (text: string) =>
  tree.root.findAll(node => node.props.children === text).length > 0;
async function press(label: string) {
  await Renderer.act(async () => {
    await button(label).props.onPress();
  });
}
async function fill() {
  await Renderer.act(async () => {
    input('Full Name').props.onChangeText('Demo Traveller');
    input('Email Address').props.onChangeText(' DEMO@Example.test ');
    input('Phone Number').props.onChangeText('03001234567');
    input('Password').props.onChangeText('Test-pass-123');
    input('Confirm Password').props.onChangeText('Test-pass-123');
  });
  await press('I agree to the Terms & Conditions and Privacy Policy');
}
test('consent gates CTA, visibility toggles are independent and Sign In/back work', async () => {
  expect(button('Create Account').props.disabled).toBe(true);
  await press('Show password');
  expect(input('Password').props.secureTextEntry).toBe(false);
  expect(input('Confirm Password').props.secureTextEntry).toBe(true);
  await press('Show confirm password');
  expect(input('Confirm Password').props.secureTextEntry).toBe(false);
  await press('Sign In');
  await press('Back to Sign In');
  expect(navigate).toHaveBeenNthCalledWith(1, 'Login');
  expect(navigate).toHaveBeenNthCalledWith(2, 'Login');
});
test('invalid form stays local with inline field errors', async () => {
  const send = jest.spyOn(registrationService, 'register');
  await press('I agree to the Terms & Conditions and Privacy Policy');
  await press('Create Account');
  expect(textPresent('Enter your full name')).toBe(true);
  expect(textPresent('Enter a valid email address')).toBe(true);
  expect(textPresent('Use at least 8 characters')).toBe(true);
  expect(send).not.toHaveBeenCalled();
});
test('changing country revalidates phone and preserves unrelated fields', async () => {
  await fill();
  await press('Calling code: Pakistan +92');
  await press('United Arab Emirates +971');
  expect(input('Email Address').props.value).toBe(' DEMO@Example.test ');
  expect(
    textPresent('Enter a valid mobile number for the selected country'),
  ).toBe(true);
});
test('legal readers open without silently recording consent', async () => {
  const open = jest.spyOn(Linking, 'openURL');
  await press('Terms & Conditions');
  expect(navigate).toHaveBeenCalledWith('TermsConditions');
  await press('Privacy Policy');
  expect(navigate).toHaveBeenCalledWith('PrivacyPolicy');
  expect(open).not.toHaveBeenCalled();
  expect(
    button('I agree to the Terms & Conditions and Privacy Policy').props
      .accessibilityState.checked,
  ).toBe(false);
});
test('422 email and phone errors are inline; submission never fakes authentication', async () => {
  jest.spyOn(registrationService, 'register').mockRejectedValue(
    new ApiError('Please check your details.', 'validation', 422, {
      email: ['Email is already registered.'],
      phone: ['Phone is already registered.'],
    }),
  );
  await fill();
  await press('Create Account');
  expect(textPresent('Email is already registered.')).toBe(true);
  expect(textPresent('Phone is already registered.')).toBe(true);
  expect(navigate).not.toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
});
test.each([
  ['network', 'Unable to connect. Check your connection and try again.'],
  ['rate-limit', 'Too many attempts. Please wait before trying again.'],
  [
    'server',
    'Account creation is temporarily unavailable. Please try again later.',
  ],
] as const)(
  '%s failure has retryable inline feedback',
  async (kind, message) => {
    jest
      .spyOn(registrationService, 'register')
      .mockRejectedValue(new ApiError('error', kind));
    await fill();
    await press('Create Account');
    expect(textPresent(message)).toBe(true);
    expect(button('Create Account').props.disabled).toBe(false);
  },
);
test('pending submission disables controls and prevents duplicate requests', async () => {
  let reject!: (error: Error) => void;
  const send = jest.spyOn(registrationService, 'register').mockImplementation(
    () =>
      new Promise((_resolve, failure) => {
        reject = failure;
      }),
  );
  await fill();
  await press('Create Account');
  expect(button('Create Account').props.disabled).toBe(true);
  expect(input('Password').props.editable).toBe(false);
  await press('Create Account');
  expect(send).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => {
    reject(new ApiError('Unavailable', 'unknown'));
  });
});
