import React, { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
export function KeyboardScreen({
  children,
  offset = 0,
  androidBehavior,
}: PropsWithChildren<{
  offset?: number;
  androidBehavior?: 'height' | 'padding' | 'position';
}>) {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : androidBehavior}
      keyboardVerticalOffset={offset}
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
