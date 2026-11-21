import React, { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { KeyboardScreen } from '../src/components/layout/KeyboardScreen';
import { KeyboardScrollView } from '../src/components/layout/KeyboardScrollView';
import { ScreenContainer } from '../src/components/layout/ScreenContainer';
import { keyboardMeasurements } from '../test/fixtures/keyboard';

let tree: ReactTestRenderer;
let events: Map<string, () => void>;
let removers: jest.Mock[];
let geometry: ReturnType<typeof keyboardMeasurements>;
let input: ReturnType<typeof keyboardMeasurements>['input'];
beforeEach(() => {
  jest.clearAllMocks();
  events = new Map();
  removers = [];
  geometry = keyboardMeasurements();
  input = geometry.input;
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined);
  jest.spyOn(Keyboard, 'addListener').mockImplementation((name, listener) => {
    events.set(name, () => listener({} as never));
    const remove = jest.fn();
    removers.push(remove);
    return { remove };
  });
  jest
    .spyOn(TextInput.State, 'currentlyFocusedInput')
    .mockReturnValue(input as never);
});
afterEach(async () => {
  await Renderer.act(async () => tree?.unmount());
  jest.restoreAllMocks();
});
async function mount() {
  const ref = React.createRef<React.ComponentRef<typeof ScrollView>>();
  await Renderer.act(async () => {
    tree = Renderer.create(
      <ScreenContainer scrollRef={ref}>
        <TextInput accessibilityLabel="Last field" />
      </ScreenContainer>,
    );
  });
  jest
    .spyOn(ref.current!, 'getNativeScrollRef')
    .mockReturnValue(geometry.viewport as never);
  jest
    .spyOn(ref.current!, 'getInnerViewRef')
    .mockReturnValue(geometry.content as never);
  const reveal = jest
    .spyOn(ref.current!, 'scrollTo')
    .mockImplementation(() => {});
  const scroll = tree.root.findByType(ScrollView);
  await Renderer.act(async () => scroll.props.onFocus({}));
  return { scroll, reveal };
}
const layout = (height: number) => ({ nativeEvent: { layout: { height } } });

test('measures the parent window origin for headers/safe area and ignores stale measurements', async () => {
  const callbacks: Array<(x: number, y: number) => void> = [];
  await Renderer.act(async () => {
    tree = Renderer.create(
      <KeyboardScreen>
        <View />
      </KeyboardScreen>,
    );
  });
  const avoid = tree.root.findByType(KeyboardAvoidingView);
  avoid.instance.viewRef.current = {
    measureInWindow: (callback: (x: number, y: number) => void) =>
      callbacks.push(callback),
  };
  await Renderer.act(async () => {
    avoid.props.onLayout({ nativeEvent: { layout: { y: 10 } } });
    avoid.props.onLayout({ nativeEvent: { layout: { y: 10 } } });
    callbacks[1](0, 90);
    callbacks[0](0, 150);
  });
  expect(
    tree.root.findByType(KeyboardAvoidingView).props.keyboardVerticalOffset,
  ).toBe(80);
});

test.each(['android', 'ios'] as const)(
  '%s has explicit avoidance without changing the closed layout',
  async os => {
    jest.replaceProperty(Platform, 'OS', os);
    await Renderer.act(async () => {
      tree = Renderer.create(
        <KeyboardScreen offset={56}>
          <View />
        </KeyboardScreen>,
      );
    });
    const avoid = tree.root.findByType(KeyboardAvoidingView);
    expect(avoid.props.behavior).toBe(os === 'android' ? 'height' : 'padding');
    expect(avoid.props.keyboardVerticalOffset).toBe(56);
    expect(avoid.props.style).toEqual({ flex: 1 });
  },
);

test('reveals the focused lower input on show/frame/content change and keeps taps/scroll usable', async () => {
  const { scroll, reveal } = await mount();
  expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
  expect(scroll.props.keyboardDismissMode).toBe('none');
  await Renderer.act(async () => {
    events.get('keyboardDidShow')!();
    events.get('keyboardDidChangeFrame')!();
    scroll.props.onContentSizeChange(320, 1400);
  });
  expect(reveal).toHaveBeenCalledTimes(3);
  expect(reveal).toHaveBeenCalledWith({ y: 514, animated: true });
});

test('a shrinking native viewport reveals input even without a keyboard event', async () => {
  const { scroll, reveal } = await mount();
  await Renderer.act(async () => {
    scroll.props.onLayout(layout(800));
    scroll.props.onLayout(layout(450));
  });
  expect(reveal).toHaveBeenCalledTimes(1);
});

test('focus moving while keyboard is open reveals the new input; blur isolates other screens', async () => {
  const { scroll, reveal } = await mount();
  jest.mocked(Keyboard.isVisible).mockReturnValue(true);
  const next = keyboardMeasurements().input;
  jest
    .mocked(TextInput.State.currentlyFocusedInput)
    .mockReturnValue(next as never);
  await Renderer.act(async () => scroll.props.onFocus({}));
  expect(next.measureLayout).toHaveBeenCalled();
  expect(reveal).toHaveBeenLastCalledWith({ y: 514, animated: true });
  reveal.mockClear();
  await Renderer.act(async () => {
    scroll.props.onBlur({});
    events.get('keyboardDidShow')!();
  });
  expect(reveal).not.toHaveBeenCalled();
});

test('hide restores normal scrolling without forcing a scroll or dismissing user keyboard', async () => {
  const { scroll, reveal } = await mount();
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  await Renderer.act(async () => {
    events.get('keyboardDidShow')!();
    scroll.props.onLayout(layout(450));
  });
  reveal.mockClear();
  await Renderer.act(async () => {
    events.get('keyboardDidHide')!();
    scroll.props.onLayout(layout(800));
    scroll.props.onContentSizeChange(320, 1400);
  });
  expect(reveal).not.toHaveBeenCalled();
  expect(dismiss).not.toHaveBeenCalled();
});

test('unfocused inputs are ignored and every listener is removed on unmount', async () => {
  const { reveal } = await mount();
  jest.mocked(TextInput.State.currentlyFocusedInput).mockReturnValue(undefined);
  await Renderer.act(async () => events.get('keyboardDidShow')!());
  expect(reveal).not.toHaveBeenCalled();
  await Renderer.act(async () => tree.unmount());
  // Native ScrollView has its own keyboard listeners as well as our three.
  expect(removers.length).toBeGreaterThanOrEqual(3);
  removers.forEach(remove => expect(remove).toHaveBeenCalledTimes(1));
});

test('multiline draft and forwarded handlers survive focus, resize and keyboard dismissal', async () => {
  const focused = jest.fn(),
    resized = jest.fn(),
    content = jest.fn();
  function Form() {
    const [draft, setDraft] = useState('');
    return (
      <KeyboardScrollView
        onFocus={focused}
        onLayout={resized}
        onContentSizeChange={content}
      >
        <TextInput multiline value={draft} onChangeText={setDraft} />
      </KeyboardScrollView>
    );
  }
  await Renderer.act(async () => {
    tree = Renderer.create(<Form />);
  });
  await Renderer.act(async () =>
    tree.root
      .findByType(TextInput)
      .props.onChangeText('User draft\nSecond line'),
  );
  const scroll = tree.root.findByType(ScrollView);
  jest.mocked(TextInput.State.currentlyFocusedInput).mockReturnValue(undefined);
  await Renderer.act(async () => {
    scroll.props.onFocus({});
    scroll.props.onLayout(layout(450));
    scroll.props.onContentSizeChange(320, 1400);
    events.get('keyboardDidHide')!();
  });
  expect(tree.root.findByType(TextInput).props.value).toBe(
    'User draft\nSecond line',
  );
  expect(focused).toHaveBeenCalledTimes(1);
  expect(resized).toHaveBeenCalledTimes(1);
  expect(content).toHaveBeenCalledWith(320, 1400);
});
