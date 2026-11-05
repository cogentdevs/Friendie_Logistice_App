import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';
import { AppText } from '../ui/AppText';
import { AppButton } from '../ui/AppButton';
export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.container}>
      <AppText variant="headingMD" color={colors.navy}>
        {title}
      </AppText>
      {action && onAction && (
        <AppButton variant="ghost" title={action} onPress={onAction} />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
