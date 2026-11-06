import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { colors } from '../../../theme';
export function DashboardStatCard({
  label,
  count,
  loading,
  error,
  icon: Icon,
  onPress,
}: {
  label: string;
  count?: number | null;
  loading: boolean;
  error: boolean;
  icon: LucideIcon;
  onPress: () => void;
}) {
  const value = loading
    ? 'loading'
    : error || count == null
    ? 'unavailable'
    : String(count);
  return (
    <Pressable
      cssInterop={false}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      accessibilityHint={'Open ' + label}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.icon}>
        <Icon size={24} color={colors.primary} />
      </View>
      {loading ? (
        <View accessibilityLabel={'Loading ' + label} style={styles.skeleton} />
      ) : (
        <AppText color={colors.primary} style={styles.count}>
          {error || count == null ? '\u2014' : count}
        </AppText>
      )}
      <AppText color={colors.navy} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 150,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
    shadowColor: colors.navy,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.softPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { fontSize: 30, lineHeight: 38, fontWeight: '800' },
  label: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  skeleton: {
    width: 56,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.lightGrey,
  },
});
