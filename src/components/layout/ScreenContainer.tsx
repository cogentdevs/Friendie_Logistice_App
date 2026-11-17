import React, { PropsWithChildren } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
  ScrollViewProps,
} from 'react-native';
import { colors, spacing } from '../../theme';
export function ScreenContainer({
  children,
  scroll = true,
  style,
  backgroundColor = colors.offWhite,
  scrollRef,
  onLayout,
  onContentSizeChange,
  onScroll,
}: PropsWithChildren<{
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  scrollRef?: React.Ref<React.ComponentRef<typeof ScrollView>>;
  onLayout?: ScrollViewProps['onLayout'];
  onContentSizeChange?: ScrollViewProps['onContentSizeChange'];
  onScroll?: ScrollViewProps['onScroll'];
}>) {
  return scroll ? (
    <ScrollView
      ref={scrollRef}
      onLayout={onLayout}
      onContentSizeChange={onContentSizeChange}
      onScroll={onScroll}
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
