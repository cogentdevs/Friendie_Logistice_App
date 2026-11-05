import React, { PropsWithChildren } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { colors, spacing } from '../../theme';
export function ScreenContainer({
  children,
  scroll = true,
  style,
  backgroundColor = colors.offWhite,
}: PropsWithChildren<{
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
}>) {
  return scroll ? (
    <ScrollView
      style={[styles.root, { backgroundColor }]}
      contentContainerStyle={[styles.content, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.root, { backgroundColor }, styles.content, style]}>
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.offWhite },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
});
