import React from 'react';
import { Text, TextProps } from 'react-native';
import { colors, typography } from '../../theme';
export interface AppTextProps extends TextProps {
  variant?: keyof typeof typography;
  color?: string;
}
export function AppText({
  variant = 'body',
  color = colors.text,
  style,
  ...props
}: AppTextProps) {
  return <Text {...props} style={[typography[variant], { color }, style]} />;
}
