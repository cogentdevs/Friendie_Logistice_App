import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';
import { AppText } from './AppText';
export function LoadingIndicator({ label = 'Loading...' }: { label?: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      <ActivityIndicator color={colors.primary} />
      <AppText>{label}</AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
});
