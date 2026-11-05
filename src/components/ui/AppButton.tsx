import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
} from 'react-native';
import { colors, spacing, radius } from '../../theme';
import { AppText } from './AppText';
interface Props extends PressableProps {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
}
export function AppButton({
  title,
  loading,
  disabled,
  variant = 'primary',
  style,
  ...props
}: Props) {
  const inactive = disabled || loading;
  const color = variant === 'primary' ? colors.white : colors.primary;
  return (
    <Pressable
      {...props}
      cssInterop={false}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      style={state => [
        styles.base,
        variant === 'primary'
          ? styles.primary
          : variant === 'secondary'
          ? styles.secondary
          : undefined,
        { opacity: inactive ? 0.5 : state.pressed ? 0.8 : 1 },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} accessibilityLabel="Loading" />
      ) : (
        <AppText variant="button" color={color} style={styles.text}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    padding: spacing.md,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.softPink },
  text: { textAlign: 'center' },
});
