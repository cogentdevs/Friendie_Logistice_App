import React, { forwardRef, ReactNode } from 'react';
import { TextInput, TextInputProps, View, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { AppText } from './AppText';
interface Props extends TextInputProps {
  label: string;
  error?: string;
  hideLabel?: boolean;
  leftIcon?: ReactNode;
  rightAccessory?: ReactNode;
}
export const AppInput = forwardRef<React.ComponentRef<typeof TextInput>, Props>(
  function AppInputField(
    {
      label,
      error,
      hideLabel = false,
      leftIcon,
      rightAccessory,
      style,
      editable = true,
      ...props
    }: Props,
    ref,
  ) {
    return (
      <View style={styles.wrap}>
        {!hideLabel && (
          <AppText variant="bodySmall" color={colors.navy}>
            {label}
          </AppText>
        )}
        <View
          style={[
            styles.field,
            error ? styles.invalid : undefined,
            !editable ? styles.disabled : undefined,
          ]}
        >
          {leftIcon}
          <TextInput
            {...props}
            ref={ref}
            editable={editable}
            accessibilityLabel={props.accessibilityLabel ?? label}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, style]}
          />
          {rightAccessory}
        </View>
        {error && (
          <AppText
            accessibilityLiveRegion="polite"
            variant="caption"
            color={colors.danger}
          >
            {error}
          </AppText>
        )}
      </View>
    );
  },
);
const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    minHeight: 54,
  },
  input: {
    ...typography.body,
    color: colors.navy,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.md,
  },
  invalid: { borderColor: colors.danger },
  disabled: { backgroundColor: colors.lightGrey },
});
