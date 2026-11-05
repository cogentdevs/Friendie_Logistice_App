import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/navigationTypes';
import { BrandLogo } from '../../../components/common/BrandLogo';
import { AppText } from '../../../components/ui/AppText';
import { colors, radius, spacing } from '../../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;
const illustration = require('../../../assets/01_globe_airplane_parcels.png');
export function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const availableHeight = height - insets.top - insets.bottom;
  const compact = availableHeight < 650;
  const brandPaddingTop = compact ? 32 : availableHeight * 0.13;
  const contentWidth = Math.min(width - 48 - insets.left - insets.right, 440);
  return (
    <LinearGradient
      colors={[colors.primaryDark, colors.primary]}
      start={{ x: 0.25, y: 0 }}
      end={{ x: 0.75, y: 1 }}
      style={styles.root}
    >
      <StatusBar barStyle="light-content" />
      <View
        pointerEvents="none"
        accessible={false}
        style={StyleSheet.absoluteFill}
      >
        <View style={styles.topCurve} />
        <View style={styles.bottomCurve} />
      </View>
      <ScrollView
        style={styles.root}
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom + spacing.xxl,
            paddingLeft: insets.left + 24,
            paddingRight: insets.right + 24,
          },
        ]}
      >
        <View
          className="w-full items-center"
          style={[
            styles.content,
            {
              maxWidth: contentWidth,
            },
          ]}
        >
          <View style={[styles.brand, { paddingTop: brandPaddingTop }]}>
            <BrandLogo
              variant="white"
              width={Math.min(contentWidth * 0.8, 240)}
            />
          </View>
          <View style={[styles.heading, compact && styles.compactHeading]}>
            <AppText
              color={colors.white}
              accessibilityRole="header"
              style={styles.title}
            >
              Find, Send or Receive
            </AppText>
            <AppText color={colors.white} style={styles.subtitle}>
              with Trusted Travellers
            </AppText>
          </View>
          <View style={styles.artwork}>
            <Image
              source={illustration}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              accessible={false}
              style={{
                width: contentWidth,
                height: Math.min(contentWidth * 0.95, compact ? 190 : 330),
              }}
            />
          </View>
          <View
            accessible
            accessibilityLabel="Welcome, page 1 of 4"
            style={styles.pagination}
          >
            {[0, 1, 2, 3].map(index => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === 0 ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            ))}
          </View>
          <View style={styles.actions}>
            <Pressable
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel="Get Started"
              onPress={() => navigation.navigate('Onboarding')}
              style={({ pressed }) => [
                styles.startButton,
                pressed && styles.pressed,
              ]}
            >
              <AppText color={colors.navy} variant="button">
                Get Started
              </AppText>
              <ArrowRight color={colors.navy} size={22} strokeWidth={2} />
            </Pressable>
            <View style={styles.footer}>
              <AppText color={colors.white} style={styles.footerText}>
                Already have an account?
              </AppText>
              <Pressable
                cssInterop={false}
                accessibilityRole="button"
                accessibilityLabel="Sign In"
                hitSlop={4}
                onPress={() =>
                  navigation.replace('AuthStack', { screen: 'Login' })
                }
                style={({ pressed }) => [
                  styles.signIn,
                  pressed && styles.pressed,
                ]}
              >
                <AppText color={colors.white} style={styles.signInText}>
                  Sign In
                </AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center' },
  content: {
    flexGrow: 1,
    minHeight: 540,
    width: '100%',
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  topCurve: {
    position: 'absolute',
    width: 620,
    height: 620,
    borderRadius: 310,
    backgroundColor: colors.primaryDark,
    opacity: 0.28,
    top: -320,
    left: -230,
    transform: [{ scaleX: 1.4 }],
  },
  bottomCurve: {
    position: 'absolute',
    width: 600,
    height: 600,
    borderRadius: 300,
    borderWidth: 70,
    borderColor: colors.primaryDark,
    opacity: 0.16,
    bottom: -330,
    right: -230,
  },
  brand: { alignItems: 'center' },
  heading: { alignItems: 'center', gap: spacing.xs, marginTop: 38 },
  compactHeading: { marginTop: 24 },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: { fontSize: 20, lineHeight: 28, textAlign: 'center' },
  artwork: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  pagination: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    minHeight: 12,
  },
  dot: { height: 7, borderRadius: 4, backgroundColor: colors.white },
  activeDot: { width: 12 },
  inactiveDot: { width: 7, opacity: 0.4 },
  actions: { width: '100%' },
  startButton: {
    backgroundColor: colors.white,
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  pressed: { opacity: 0.8 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: spacing.sm,
    marginTop: spacing.xs,
  },
  footerText: { fontSize: 13, lineHeight: 20 },
  signIn: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  signInText: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
});
