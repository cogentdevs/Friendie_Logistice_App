import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { AppText } from '../../../components/ui/AppText';
import { GradientButton } from '../../../components/ui/GradientButton';
import { colors, spacing } from '../../../theme';

type Props = {
  title: string;
  description: string;
  illustration: ImageSourcePropType;
  activeDot: number;
  backgroundColor?: string;
  onSkip?: () => void;
  buttonTitle?: string;
  buttonIcon?: 'arrow' | 'check';
  loading?: boolean;
  error?: string | null;
  onNext: () => void;
};
export function OnboardingLayout({
  title,
  description,
  illustration,
  activeDot,
  backgroundColor = colors.offWhite,
  onSkip,
  onNext,
  buttonTitle = 'Next',
  buttonIcon = 'arrow',
  loading = false,
  error,
}: Props) {
  const focused = useIsFocused();
  const { width, height } = useWindowDimensions();
  const artworkWidth = Math.min(Math.max(width - spacing.xl * 2, 0), 392);
  const artworkHeight = Math.min(
    artworkWidth * 0.95,
    Math.max(180, height * 0.43),
  );
  return (
    <SafeScreen
      edges={['top', 'bottom', 'left', 'right']}
      backgroundColor={backgroundColor}
    >
      {focused && <StatusBar barStyle="dark-content" />}
      <ScreenContainer style={styles.content} backgroundColor={backgroundColor}>
        <View className="w-full" style={styles.topBar}>
          {onSkip && (
            <Pressable
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
              onPress={onSkip}
              style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
            >
              <AppText color={colors.primaryDark} style={styles.skipText}>
                Skip
              </AppText>
            </Pressable>
          )}
        </View>
        <Image
          source={illustration}
          resizeMode="contain"
          accessible={false}
          accessibilityIgnoresInvertColors
          style={[
            styles.illustration,
            { width: artworkWidth, height: artworkHeight },
          ]}
        />
        <View style={styles.copy}>
          <AppText
            accessibilityRole="header"
            color={colors.navy}
            style={styles.heading}
          >
            {title}
          </AppText>
          <AppText style={styles.description}>{description}</AppText>
        </View>
        <View style={styles.progressArea}>
          <View
            accessible
            accessibilityLabel={`Introduction, page ${activeDot + 1} of 4`}
            style={styles.dots}
          >
            {[0, 1, 2, 3].map(index => (
              <View
                key={index}
                style={[styles.dot, index === activeDot && styles.activeDot]}
              />
            ))}
          </View>
        </View>
        {error && (
          <AppText
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            color={colors.danger}
            style={styles.error}
          >
            {error}
          </AppText>
        )}
        <GradientButton
          title={buttonTitle}
          icon={buttonIcon}
          loading={loading}
          onPress={onNext}
        />
      </ScreenContainer>
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  error: { textAlign: 'center', marginBottom: spacing.md },
  content: { maxWidth: 440, gap: 0, paddingTop: 0, paddingBottom: spacing.xl },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', minHeight: 48 },
  skip: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: spacing.md,
  },
  skipText: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  pressed: { opacity: 0.65 },
  illustration: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    maxWidth: '100%',
  },
  copy: { alignItems: 'center', gap: spacing.md },
  heading: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 340,
  },
  progressArea: {
    flexGrow: 1,
    minHeight: 76,
    justifyContent: 'flex-end',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
    opacity: 0.55,
  },
  activeDot: { width: 12, backgroundColor: colors.primary, opacity: 1 },
});
