import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { ChevronRight, LucideIcon } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { colors } from '../../../theme';
export function ProfileMenuRow({
  label,
  icon: Icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      cssInterop={false}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        styles.divider,
        (pressed || disabled) && styles.inactive,
      ]}
    >
      <Icon size={22} color={colors.primary} />
      <AppText color={colors.navy} style={styles.label}>
        {label}
      </AppText>
      <ChevronRight size={19} color={colors.secondary} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  label: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '500' },
  inactive: { opacity: 0.55 },
});
