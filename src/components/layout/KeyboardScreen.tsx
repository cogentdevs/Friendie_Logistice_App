import React, { PropsWithChildren, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
export function KeyboardScreen({
  children,
  offset,
  androidBehavior = 'height',
}: PropsWithChildren<{
  offset?: number;
  androidBehavior?: 'height' | 'padding' | 'position';
}>) {
  const view = useRef<React.ComponentRef<typeof KeyboardAvoidingView>>(null);
  const generation = useRef(0);
  const [measuredOffset, setMeasuredOffset] = useState(0);
  return (
    <KeyboardAvoidingView
      ref={view}
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : androidBehavior}
      keyboardVerticalOffset={offset ?? measuredOffset}
      onLayout={event => {
        if (offset !== undefined) return;
        const localY = event.nativeEvent.layout.y;
        const layout = ++generation.current;
        // Keyboard coordinates are window-relative; layout.y is parent-relative.
        // Measure the actual header/safe-area origin rather than guessing it.
        view.current?.viewRef.current?.measureInWindow((_x, y) => {
          if (view.current && layout === generation.current)
            setMeasuredOffset(Math.max(0, y - localY));
        });
      }}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
