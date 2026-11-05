import { StyleSheet } from 'react-native';
import React, { PropsWithChildren } from 'react';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors } from '../../theme';
export function SafeScreen({
  children,
  edges = ['left', 'right', 'bottom'],
  backgroundColor = colors.offWhite,
}: PropsWithChildren<{
  edges?: Edge[];
  backgroundColor?: string;
}>) {
  return (
    <SafeAreaView edges={edges} style={[styles.container, { backgroundColor }]}>
      {children}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
});
