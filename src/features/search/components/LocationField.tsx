import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { colors } from '../../../theme';

export function LocationField({
  label,
  value,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  value?: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      cssInterop={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.field}
    >
      <MapPin size={20} color={colors.primary} />
      <View style={styles.content}>
        <AppText variant="caption">{label}</AppText>
        <AppText color={value ? colors.navy : colors.textMuted}>
          {value ?? 'Select country, city or area'}
        </AppText>
      </View>
      <ChevronRight size={18} color={colors.secondary} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  field: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  content: { flex: 1, minWidth: 0, gap: 3 },
});
