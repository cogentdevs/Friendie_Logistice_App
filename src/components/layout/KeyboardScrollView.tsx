import React, { forwardRef, useCallback, useEffect, useRef } from 'react';
import { Keyboard, ScrollView, ScrollViewProps, TextInput } from 'react-native';
import { revealInputInViewport } from './keyboardVisibility';

// Keep the native ScrollView (and its layout/styles). Only reveal inputs which
// focused inside this scroll view, never an input on another screen or modal.
export const KeyboardScrollView = forwardRef<
  React.ComponentRef<typeof ScrollView>,
  ScrollViewProps
>(function KeyboardScrollContainer(
  { onFocus, onBlur, onLayout, onContentSizeChange, onScroll, ...props },
  forwardedRef,
) {
  const scroll = useRef<React.ComponentRef<typeof ScrollView> | null>(null);
  const input =
    useRef<ReturnType<typeof TextInput.State.currentlyFocusedInput>>(null);
  const visible = useRef(false);
  const viewportHeight = useRef<number | undefined>(undefined);
  const generation = useRef(0);
  const reveal = useCallback(() => {
    const focused = input.current;
    const request = ++generation.current;
    revealInputInViewport(
      scroll.current,
      focused,
      () =>
        request === generation.current &&
        focused === input.current &&
        focused === TextInput.State.currentlyFocusedInput(),
    );
  }, []);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => {
      visible.current = true;
      reveal();
    });
    const changed = Keyboard.addListener('keyboardDidChangeFrame', reveal);
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      visible.current = false;
      generation.current++;
    });
    return () => {
      shown.remove();
      changed.remove();
      hidden.remove();
      input.current = null;
    };
  }, [reveal]);
  const setRef = useCallback(
    (node: React.ComponentRef<typeof ScrollView> | null) => {
      scroll.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
      {...props}
      ref={setRef}
      onFocus={event => {
        input.current = TextInput.State.currentlyFocusedInput();
        if (visible.current || Keyboard.isVisible()) reveal();
        onFocus?.(event);
      }}
      onBlur={event => {
        input.current = null;
        generation.current++;
        onBlur?.(event);
      }}
      onScroll={event => {
        generation.current++;
        onScroll?.(event);
      }}
      onLayout={event => {
        const height = event.nativeEvent.layout.height;
        const shrank =
          viewportHeight.current !== undefined &&
          height < viewportHeight.current;
        viewportHeight.current = height;
        // adjustResize on older Android may resize without a keyboard event.
        if (shrank || visible.current || Keyboard.isVisible()) reveal();
        onLayout?.(event);
      }}
      onContentSizeChange={(width, height) => {
        if (visible.current || Keyboard.isVisible()) reveal();
        onContentSizeChange?.(width, height);
      }}
    />
  );
});
