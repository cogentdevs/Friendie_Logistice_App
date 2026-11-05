import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../../theme';
import { AppText } from './AppText';
export function AppBadge({
  label,
  variant = 'brand',
}: {
  label: string;
  variant?: 'brand' | 'neutral' | 'success';
}) {
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor:
            variant === 'brand' ? colors.softPink : colors.lightGrey,
        },
      ]}
    >
      <AppText
        variant="caption"
        color={
          variant === 'brand'
            ? colors.primary
            : variant === 'success'
            ? colors.success
            : colors.secondary
        }
      >
        {label}
      </AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
