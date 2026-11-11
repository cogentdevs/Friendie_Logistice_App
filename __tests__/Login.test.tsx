import {
  beginAuthFlow,
  clearAuthFlow,
  useAuthFlowStore,
} from '../src/features/auth/store/authFlowStore';
import React from 'react';
import { appConfig } from '../src/constants/appConfig';
const originalPreview = appConfig.uiPreviewEnabled;
import { TextInput } from 'react-native';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginScreen } from '../src/features/auth/screens/LoginScreen';
import { authService } from '../src/features/auth/services/authService';
import { ApiError } from '../src/types/api';
import { useAuthStore } from '../src/store/authStore';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
let tree: ReactTestRenderer;
let client: QueryClient;
const navigate = jest.fn();
beforeEach(async () => {
  clearAuthFlow();
  appConfig.uiPreviewEnabled = false;
  useAuthStore.getState().clear();
  client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false, gcTime: 0 },
      queries: { retry: false, gcTime: 0 },
    },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <LoginScreen
          navigation={
            { navigate } as unknown as React.ComponentProps<
              typeof LoginScreen
            >['navigation']
          }
          route={{ key: 'login', name: 'Login' }}
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
async function fill(
  email = '  TRAVELLER@Example.Test  ',
  password = 'test password',
) {
  await Renderer.act(async () => {
    input('Email Address').props.onChangeText(email);
    input('Password').props.onChangeText(password);
  });
}
async function press(label: string) {
  await Renderer.act(async () => {
    await button(label).props.onPress();
  });
}
const textPresent = (text: string) =>
  tree.root.findAll(node => node.props.children === text).length > 0;

test('invalid email and required password stay local without invoking login', async () => {
  const login = jest.spyOn(authService, 'login').mockResolvedValue();
  await fill('invalid', '');
  await press('Sign In');
  expect(textPresent('Enter a valid email address')).toBe(true);
  expect(textPresent('Enter your password')).toBe(true);
  expect(login).not.toHaveBeenCalled();
});
test('email is normalized and a pending submission cannot send duplicate requests', async () => {
  let resolve!: () => void;
  const pending = new Promise<void>(done => {
    resolve = done;
  });
  const login = jest.spyOn(authService, 'login').mockReturnValue(pending);
  await fill();
  let submissions: Promise<void>[] = [];
  await Renderer.act(async () => {
    submissions = [
      button('Sign In').props.onPress(),
      button('Sign In').props.onPress(),
    ];
  });
  expect(login).toHaveBeenCalledTimes(1);
  expect(login.mock.calls[0][0]).toEqual({
    email: 'traveller@example.test',
    password: 'test password',
    device_name: 'Friendie mobile',
  });
  expect(button('Sign In').props.accessibilityState).toMatchObject({
    disabled: true,
    busy: true,
  });
  await Renderer.act(async () => {
    resolve();
    await pending;
    await Promise.all(submissions);
  });
});
test('password visibility toggles without changing its value', async () => {
  await fill();
  expect(input('Password').props.secureTextEntry).toBe(true);
  await press('Show password');
  expect(input('Password').props.secureTextEntry).toBe(false);
  expect(input('Password').props.value).toBe('test password');
  await press('Hide password');
  expect(input('Password').props.secureTextEntry).toBe(true);
});
test('Laravel field validation is shown alongside a retryable server error', async () => {
  jest.spyOn(authService, 'login').mockRejectedValue(
    new ApiError('Please check your details.', 'validation', 422, {
      email: ['This email is not registered.'],
    }),
  );
  await fill();
  await press('Sign In');
  expect(textPresent('Please check your details.')).toBe(true);
  expect(textPresent('This email is not registered.')).toBe(true);
  expect(button('Sign In').props.disabled).toBe(false);
  expect(useAuthStore.getState().status).toBe('guest');
});
test('network errors stay on Sign In without authenticating', async () => {
  jest
    .spyOn(authService, 'login')
    .mockRejectedValue(
      new ApiError('Unable to connect. Check your connection.', 'network'),
    );
  await fill();
  await press('Sign In');
  expect(textPresent('Unable to connect. Check your connection.')).toBe(true);
  expect(navigate).not.toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
});
test('Forgot Password and Register open existing routes; unsupported providers are omitted', async () => {
  await press('Forgot Password?');
  expect(navigate).toHaveBeenCalledWith('ForgotPassword');
  await press('Register');
  expect(navigate).toHaveBeenCalledWith('Register');
  expect(
    tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Google' ||
        node.props.accessibilityLabel === 'Apple',
    ),
  ).toHaveLength(0);
});

test('testing release rejects blank and wrong credentials, then accepts the UI testing login without an auth request', async () => {
  const { useDevelopmentStore } = require('../src/store/developmentStore');
  const previousTesting = appConfig.testingUiPreview;
  const loginRequest = jest.spyOn(authService, 'login');
  try {
    appConfig.uiPreviewEnabled = true;
    appConfig.testingUiPreview = true;
    jest.replaceProperty(
      globalThis as typeof globalThis & { __DEV__: boolean },
      '__DEV__',
      false,
    );
    useDevelopmentStore.getState().exitPreview();
    await press('Sign In');
    expect(useDevelopmentStore.getState().previewActive).toBe(false);
    await fill('demo@friendie.test', 'wrong-password');
    await press('Sign In');
    expect(useDevelopmentStore.getState().previewActive).toBe(false);
    await fill('  DEMO@FRIENDIE.TEST  ', 'Friendie@123');
    await press('Sign In');
    expect(useDevelopmentStore.getState().previewActive).toBe(true);
    expect(useAuthStore.getState().status).not.toBe('authenticated');
    expect(loginRequest).not.toHaveBeenCalled();
  } finally {
    appConfig.testingUiPreview = previousTesting;
    useDevelopmentStore.getState().exitPreview();
  }
});

test('protected pending action uses real authentication even when UI testing preview is enabled', async () => {
  appConfig.uiPreviewEnabled = true;
  const login = jest
    .spyOn(authService, 'login')
    .mockRejectedValue(new ApiError('Sign in unavailable.', 'network'));
  await Renderer.act(async () => {
    beginAuthFlow({ type: 'POST_LISTING', params: { listingType: 'carry' } });
  });
  await fill('demo@friendie.test', 'Friendie@123');
  await press('Sign In');
  expect(login).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState().status).toBe('guest');
  expect(useAuthFlowStore.getState().flow?.action.type).toBe('POST_LISTING');
  expect(textPresent('Sign in unavailable.')).toBe(true);
  clearAuthFlow();
});

test('STATIC_TESTING guarded login accepts demo credentials without creating a session', async () => {
  const { useDevelopmentStore } = require('../src/store/developmentStore');
  const previousStatic = appConfig.staticTestingBuild;
  const previousTesting = appConfig.testingUiPreview;
  const login = jest.spyOn(authService, 'login');
  try {
    appConfig.staticTestingBuild = true;
    appConfig.testingUiPreview = true;
    appConfig.uiPreviewEnabled = true;
    jest.replaceProperty(
      globalThis as typeof globalThis & { __DEV__: boolean },
      '__DEV__',
      false,
    );
    useDevelopmentStore.getState().exitPreview();
    await Renderer.act(async () => {
      beginAuthFlow({ type: 'OPEN_MESSAGES' });
    });
    await fill('demo@friendie.test', 'wrong-password');
    await press('Sign In');
    expect(useDevelopmentStore.getState().previewActive).toBe(false);
    await fill('demo@friendie.test', 'Friendie@123');
    await press('Sign In');
    expect(useDevelopmentStore.getState().previewActive).toBe(true);
    expect(useAuthStore.getState().status).toBe('guest');
    expect(login).not.toHaveBeenCalled();
  } finally {
    appConfig.staticTestingBuild = previousStatic;
    appConfig.testingUiPreview = previousTesting;
    useDevelopmentStore.getState().exitPreview();
    clearAuthFlow();
  }
});

test('Login reveals the focused password after the keyboard opens and retains scrolling', async () => {
  const { Keyboard, ScrollView } = require('react-native');
  const {
    ScreenContainer,
  } = require('../src/components/layout/ScreenContainer');
  const scroll = jest.fn();
  const nativeInput = { isFocused: () => true, focus: jest.fn() };
  let keyboardShown: (() => void) | undefined;
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  jest
    .spyOn(Keyboard, 'addListener')
    .mockImplementation((...args: unknown[]) => {
      const [event, listener] = args;
      if (event === 'keyboardDidShow' && typeof listener === 'function')
        keyboardShown = () => listener();
      return { remove: jest.fn() };
    });
  await Renderer.act(async () => {
    tree.unmount();
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <LoginScreen
          navigation={{ navigate } as any}
          route={{ key: 'login-keyboard', name: 'Login' }}
        />
      </QueryClientProvider>,
    );
  });
  // Attach native handles as supplied by the mounted ScrollView/TextInput.
  const container = tree.root.findByType(ScreenContainer);
  container.props.scrollRef.current = {
    scrollResponderScrollNativeHandleToKeyboard: scroll,
  };
  const { AppInput } = require('../src/components/ui/AppInput');
  const password = tree.root
    .findAllByType(AppInput)
    .find((node: any) => node.props.label === 'Password')!;
  // React 19 exposes ref as a prop on the forwarded input component.
  password.props.ref(nativeInput);
  await Renderer.act(async () => {
    password.props.onFocus();
    keyboardShown?.();
  });
  expect(scroll).toHaveBeenCalledWith(nativeInput, expect.any(Number), true);
  expect(tree.root.findByType(ScrollView).props.keyboardShouldPersistTaps).toBe(
    'handled',
  );
});
