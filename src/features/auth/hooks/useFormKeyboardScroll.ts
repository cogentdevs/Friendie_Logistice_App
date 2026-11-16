import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, ScrollView, TextInput } from 'react-native';
import type React from 'react';
import { spacing } from '../../../theme';

type InputHandle = React.ComponentRef<typeof TextInput>;

// Opt-in for auth forms: use the resized native viewport and keyboard lifecycle,
// rather than guessing keyboard heights or scheduling arbitrary scroll delays.
export function useFormKeyboardScroll(enabled: boolean) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const focusedInput = useRef<InputHandle | null>(null);
  const revealFocusedInput = useCallback(() => {
    const input = focusedInput.current;
    if (enabled && input?.isFocused()) {
      scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
        input,
        spacing.lg,
        true,
      );
    }
  }, [enabled]);
  const focusInput = useCallback(
    (input: InputHandle | null) => {
      focusedInput.current = input;
      if (Keyboard.isVisible()) revealFocusedInput();
    },
    [revealFocusedInput],
  );
  useEffect(() => {
    if (!enabled) {
      focusedInput.current = null;
      return;
    }
    const shown = Keyboard.addListener('keyboardDidShow', revealFocusedInput);
    const resized = Keyboard.addListener(
      'keyboardDidChangeFrame',
      revealFocusedInput,
    );
    return () => {
      shown.remove();
      resized.remove();
      focusedInput.current = null;
    };
  }, [enabled, revealFocusedInput]);
  // Also called after native viewport/content layout. This covers Android
  // adjustResize cases where a keyboard event may not be emitted.
  return { scrollRef, focusInput, revealFocusedInput };
}
