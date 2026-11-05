import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { ArrowRight, Check } from 'lucide-react-native';
import { AppText } from './AppText';
import { colors, radius, spacing } from '../../theme';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: 'arrow' | 'check' | 'none';
};
export function GradientButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon = 'arrow',
}: Props) {
  const Icon = icon === 'check' ? Check : ArrowRight;
  const inactive = disabled || loading;
  return (
    <Pressable
      cssInterop={false}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        (pressed || inactive) && styles.inactive,
      ]}
    >
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <AppText variant="button" color={colors.white}>
          {title}
        </AppText>
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : icon !== 'none' ? (
          <Icon size={22} color={colors.white} strokeWidth={2} />
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  gradient: {
    minHeight: 52,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  inactive: { opacity: 0.55 },
});
