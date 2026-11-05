import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PackageOpen } from 'lucide-react-native';
import { colors, spacing } from '../../theme';
import { AppText } from './AppText';
export function EmptyState({
  title,
  message,
}: {
  title: string;
  message?: string;
}) {
  return (
    <View style={styles.container}>
      <PackageOpen color={colors.primary} size={40} />
      <AppText variant="headingMD" color={colors.navy}>
        {title}
      </AppText>
      {message && <AppText style={styles.message}>{message}</AppText>}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  message: {
    textAlign: 'center',
  },
});
