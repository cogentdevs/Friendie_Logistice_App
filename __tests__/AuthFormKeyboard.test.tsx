import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RegisterScreen } from '../src/features/auth/screens/RegisterScreen';
import { ForgotPasswordScreen } from '../src/features/auth/screens/ForgotPasswordScreen';
import { ScreenContainer } from '../src/components/layout/ScreenContainer';
import { AppInput } from '../src/components/ui/AppInput';
import { useIsFocused } from '@react-navigation/native';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: jest.fn(() => true),
}));
let tree: ReactTestRenderer, client: QueryClient;
let listeners: Map<string, () => void>;
const nav = { popTo: jest.fn(), navigate: jest.fn() };
function content(screen: 'register' | 'forgot') {
  return (
    <QueryClientProvider client={client}>
      {screen === 'register' ? (
        <RegisterScreen
          navigation={
            nav as unknown as React.ComponentProps<
              typeof RegisterScreen
            >['navigation']
          }
          route={{ key: 'register-keyboard', name: 'Register' }}
        />
      ) : (
        <ForgotPasswordScreen
          navigation={
            nav as unknown as React.ComponentProps<
              typeof ForgotPasswordScreen
            >['navigation']
          }
          route={{ key: 'forgot-keyboard', name: 'ForgotPassword' }}
        />
      )}
    </QueryClientProvider>
  );
}
async function mount(screen: 'register' | 'forgot') {
  await Renderer.act(async () => {
    tree = Renderer.create(content(screen));
  });
}
function field(label: string) {
  return tree.root
    .findAllByType(AppInput)
    .find(node => node.props.label === label)!;
}
beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  listeners = new Map();
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: 0 } },
  });
  (useIsFocused as jest.Mock).mockReturnValue(true);
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  jest
    .spyOn(Keyboard, 'addListener')
    .mockImplementation((...args: unknown[]) => {
      const [event, listener] = args;
      if (typeof listener === 'function')
        listeners.set(String(event), listener as () => void);
      return { remove: jest.fn() };
    });
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client.clear();
  });
  jest.restoreAllMocks();
});
test.each([
  ['register', 'Confirm Password'],
  ['forgot', 'Email Address'],
] as const)(
  '%s reveals focused field on keyboard show, height change and viewport resize',
  async (screen, label) => {
    await mount(screen);
    const scroll = jest.fn(),
      nativeInput = { isFocused: jest.fn(() => true), focus: jest.fn() };
    const container = tree.root.findByType(ScreenContainer);
    container.props.scrollRef.current = {
      scrollResponderScrollNativeHandleToKeyboard: scroll,
    };
    field(label).props.ref(nativeInput);
    await Renderer.act(async () => {
      field(label).props.onFocus();
    });
    await Renderer.act(async () => {
      listeners.get('keyboardDidShow')?.();
      listeners.get('keyboardDidChangeFrame')?.();
    });
    expect(scroll).toHaveBeenCalledWith(nativeInput, expect.any(Number), true);
    scroll.mockClear();
    // Older Android adjustResize may resize without emitting a keyboard event.
    await Renderer.act(async () => {
      container.props.onLayout();
      container.props.onContentSizeChange();
    });
    expect(scroll).toHaveBeenCalledTimes(2);
    expect(tree.root.findByType(KeyboardAvoidingView).props.behavior).toBe(
      'height',
    );
    expect(
      tree.root.findByType(ScrollView).props.keyboardShouldPersistTaps,
    ).toBe('handled');
    nativeInput.isFocused.mockReturnValue(false);
    scroll.mockClear();
    await Renderer.act(async () => {
      container.props.onLayout();
      listeners.get('keyboardDidChangeFrame')?.();
    });
    expect(scroll).not.toHaveBeenCalled();
  },
);
test('Register Next focuses Confirm Password and reveals it while the keyboard is already visible', async () => {
  await mount('register');
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
  const scroll = jest.fn();
  tree.root.findByType(ScreenContainer).props.scrollRef.current = {
    scrollResponderScrollNativeHandleToKeyboard: scroll,
  };
  const confirm = field('Confirm Password');
  const confirmInput = {
    isFocused: () => true,
    focus: jest.fn(() => confirm.props.onFocus()),
  };
  confirm.props.ref(confirmInput);
  await Renderer.act(async () => {
    field('Password').props.onSubmitEditing();
  });
  expect(confirmInput.focus).toHaveBeenCalledTimes(1);
  expect(scroll).toHaveBeenLastCalledWith(
    confirmInput,
    expect.any(Number),
    true,
  );
});
test.each([
  ['register', 'Confirm Password'],
  ['forgot', 'Email Address'],
] as const)(
  '%s stops keyboard scrolling when screen loses focus',
  async (screen, label) => {
    await mount(screen);
    const scroll = jest.fn(),
      nativeInput = { isFocused: () => true, focus: jest.fn() };
    const container = tree.root.findByType(ScreenContainer);
    container.props.scrollRef.current = {
      scrollResponderScrollNativeHandleToKeyboard: scroll,
    };
    field(label).props.ref(nativeInput);
    await Renderer.act(async () => {
      field(label).props.onFocus();
    });
    (useIsFocused as jest.Mock).mockReturnValue(false);
    await Renderer.act(async () => {
      tree.update(content(screen));
    });
    scroll.mockClear();
    await Renderer.act(async () => {
      tree.root.findByType(ScreenContainer).props.onLayout();
    });
    expect(scroll).not.toHaveBeenCalled();
  },
);

test('iOS keeps padding avoidance and reveals the focused email with an open keyboard', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  await mount('forgot');
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
  const scroll = jest.fn(),
    nativeInput = { isFocused: () => true, focus: jest.fn() };
  tree.root.findByType(ScreenContainer).props.scrollRef.current = {
    scrollResponderScrollNativeHandleToKeyboard: scroll,
  };
  field('Email Address').props.ref(nativeInput);
  await Renderer.act(async () => {
    field('Email Address').props.onFocus();
  });
  expect(tree.root.findByType(KeyboardAvoidingView).props.behavior).toBe(
    'padding',
  );
  expect(scroll).toHaveBeenCalledWith(nativeInput, expect.any(Number), true);
});
