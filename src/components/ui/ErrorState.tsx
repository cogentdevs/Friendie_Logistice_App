import React from 'react';
import { View } from 'react-native';
import { spacing, colors } from '../../theme';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ padding: spacing.xl, gap: spacing.lg }}
    >
      <AppText color={colors.danger}>{message}</AppText>
      {onRetry && <AppButton title="Try again" onPress={onRetry} />}
    </View>
  );
}
