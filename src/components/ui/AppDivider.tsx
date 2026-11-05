import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme';
export function AppDivider() {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
      }}
    />
  );
}
