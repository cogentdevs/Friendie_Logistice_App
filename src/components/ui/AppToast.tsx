import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast, {
  BaseToast,
  ToastConfig,
  ToastConfigParams,
} from 'react-native-toast-message';
import { typography } from '../../theme/typography';

const variants = {
  success: { title: 'Success', color: '#4CAF50' },
  error: { title: 'Error', color: '#E53935' },
  warning: { title: 'Warning', color: '#F59E0B' },
  rejected: { title: 'Rejected', color: '#6B7280' },
  info: { title: 'Information', color: '#2196F3' },
} as const;
type NotificationType = keyof typeof variants;

// Compatibility delegate only; the library owns notification state and timers.
export function showToast(
  title: string,
  message: string,
  type: NotificationType = 'info',
) {
  Toast.show({ type, text1: title, text2: message });
}
function ToastCard({ text1, text2, type, hide }: ToastConfigParams<unknown>) {
  const { width } = useWindowDimensions();
  const variant = variants[type as NotificationType] ?? variants.info;
  // Keep existing operation context as description beneath the standard title.
  const description = [text1, text2]
    .filter(
      (value, index, values) =>
        value && value !== variant.title && values.indexOf(value) === index,
    )
    .join('\n');
  return (
    <BaseToast
      text1={variant.title}
      text2={description}
      text1NumberOfLines={0}
      text2NumberOfLines={0}
      onPress={() => hide()}
      touchableContainerProps={{
        accessibilityRole: 'button',
        accessibilityLabel: `${variant.title}. ${description}. Tap to dismiss`,
        accessibilityLiveRegion: 'polite',
      }}
      style={[
        styles.toast,
        { width: Math.max(0, width - 32), borderLeftColor: variant.color },
      ]}
      contentContainerStyle={styles.content}
      text1Style={styles.title}
      text2Style={styles.description}
    />
  );
}
const renderToast = (props: ToastConfigParams<unknown>) => (
  <ToastCard {...props} />
);
const config: ToastConfig = {
  success: renderToast,
  error: renderToast,
  warning: renderToast,
  rejected: renderToast,
  info: renderToast,
};
// Mounted once by AppProviders, above the existing navigation content.
export function AppToast() {
  const insets = useSafeAreaInsets();
  return (
    <Toast
      config={config}
      position="top"
      topOffset={insets.top + 12}
      visibilityTime={10000}
      swipeable={false}
      animationConfig={{ type: 'timing', duration: 0 }}
    />
  );
}
const styles = StyleSheet.create({
  toast: {
    height: 'auto',
    minHeight: 68,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 6,
    borderRadius: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  content: { paddingHorizontal: 16, paddingVertical: 12 },
  title: {
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: '#1B1B1B',
    marginBottom: 4,
  },
  description: {
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: '#858585',
  },
});
