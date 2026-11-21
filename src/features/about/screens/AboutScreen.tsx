import React, { PropsWithChildren } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { CompositeScreenProps, useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  MessageCircle,
  CreditCard,
  Check,
} from 'lucide-react-native';
import {
  DrawerParamList,
  RootStackParamList,
} from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { AppText } from '../../../components/ui/AppText';
import { BrandLogo } from '../../../components/common/BrandLogo';
import { colors } from '../../../theme';
import { aboutContent } from '../content/aboutContent';
import { aboutAssets, aboutLocations } from '../content/aboutAssets';
import { getNativeAppVersion } from '../services/appMetadata';

const valueIcons = [LockKeyhole, MessageCircle, CreditCard, Check];
function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <AppText
          accessibilityRole="header"
          variant="headingLG"
          color={colors.navy}
        >
          {title}
        </AppText>
        <View style={styles.accent} />
      </View>
      {children}
    </View>
  );
}

export function AboutScreen({
  navigation,
}: CompositeScreenProps<
  DrawerScreenProps<DrawerParamList, 'About'>,
  NativeStackScreenProps<RootStackParamList>
>) {
  const focused = useIsFocused();
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 600 && fontScale <= 1.3;
  const locationColumns = width >= 360 && fontScale <= 1.3;
  const version = getNativeAppVersion();
  const openLegal = (kind: 'privacy' | 'terms') =>
    navigation.navigate(
      kind === 'privacy' ? 'PrivacyPolicy' : 'TermsConditions',
    );
  return (
    <SafeScreen
      edges={['top', 'bottom', 'left', 'right']}
      backgroundColor={colors.white}
    >
      {focused && <StatusBar barStyle="dark-content" />}
      <View style={styles.header}>
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          accessibilityLabel="Back from About Us"
          style={styles.back}
          onPress={() =>
            navigation.canGoBack()
              ? navigation.goBack()
              : navigation.navigate('MainTabs', {
                  screen: 'HomeStack',
                  params: { screen: 'Home' },
                })
          }
        >
          <ArrowLeft size={24} color={colors.navy} />
        </Pressable>
        <AppText
          accessibilityRole="header"
          color={colors.navy}
          style={styles.title}
        >
          About Us
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="About Friendie Logistics">
          <AppText style={styles.body}>{aboutContent.introduction}</AppText>
          <Image
            source={aboutAssets.introduction}
            accessibilityLabel="Friendie Logistics air, sea and road transport illustration"
            style={styles.aboutImage}
            resizeMode="contain"
          />
        </Section>
        <View style={styles.storyPanel}>
          <Section title="What We Do">
            <AppText style={styles.body}>{aboutContent.whatWeDo}</AppText>
          </Section>
          <Section title="Our Vision">
            <AppText style={styles.body}>{aboutContent.vision}</AppText>
          </Section>
        </View>
        <Section title="Our Values">
          <View style={styles.grid}>
            {aboutContent.values.map((value, index) => {
              const Icon = valueIcons[index];
              return (
                <View
                  key={value.title}
                  style={[styles.valueCard, wide ? styles.half : styles.full]}
                >
                  <View style={styles.valueIcon}>
                    <Icon size={24} color={colors.primary} />
                  </View>
                  <AppText variant="headingMD" color={colors.navy}>
                    {value.title}
                  </AppText>
                  <AppText style={styles.body}>{value.text}</AppText>
                </View>
              );
            })}
          </View>
        </Section>
        <Section title="Get Involved">
          <AppText style={styles.body}>{aboutContent.closing}</AppText>
          <AppText style={styles.body}>{aboutContent.getInvolved}</AppText>
          <View style={styles.steps}>
            {aboutContent.steps.map((step, index) => (
              <View key={step} style={styles.step}>
                <AppText color={colors.primary} style={styles.stepNumber}>
                  {String(index + 1).padStart(2, '0')}
                </AppText>
                <AppText color={colors.navy} style={styles.stepTitle}>
                  {step}
                </AppText>
              </View>
            ))}
          </View>
        </Section>
        <Section title="Locations">
          <View style={styles.grid}>
            {aboutLocations.map(location => (
              <View
                key={location.label}
                style={[
                  styles.locationCard,
                  locationColumns ? styles.half : styles.full,
                ]}
              >
                <Image
                  source={location.image}
                  resizeMode="contain"
                  accessibilityLabel={location.label + ' location photograph'}
                  style={styles.locationImage}
                />
                <AppText color={colors.navy} style={styles.locationLabel}>
                  {location.label}
                </AppText>
              </View>
            ))}
          </View>
        </Section>
        <Section title="Client Testimonials">
          <View style={styles.grid}>
            {aboutContent.testimonials.map((item, index) => (
              <View
                key={item.name}
                style={[styles.testimonial, wide ? styles.half : styles.full]}
              >
                <Image
                  source={aboutAssets.quote}
                  style={styles.quote}
                  resizeMode="contain"
                  accessible={false}
                  importantForAccessibility="no"
                />
                <AppText style={styles.body}>{item.text}</AppText>
                <View style={styles.author}>
                  <Image
                    source={
                      index === 0
                        ? aboutAssets.alex
                        : aboutAssets.otherTestimonial
                    }
                    accessibilityLabel={
                      item.name + ' website testimonial portrait'
                    }
                    style={styles.avatar}
                    resizeMode="contain"
                  />
                  <View style={styles.authorText}>
                    <AppText color={colors.navy} style={styles.authorName}>
                      {item.name}
                    </AppText>
                    <AppText variant="bodySmall">{item.role}</AppText>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </Section>
        <View style={styles.footer}>
          <View style={styles.footerBrand}>
            <BrandLogo width={150} variant="color" />
          </View>
          <AppText variant="caption" style={styles.version}>
            {version ? 'App version ' + version : 'App version unavailable'}
          </AppText>
          {[
            { label: 'Privacy Policy', kind: 'privacy' as const },
            { label: 'Terms & Conditions', kind: 'terms' as const },
          ].map(link => (
            <Pressable
              cssInterop={false}
              key={link.kind}
              accessibilityRole="link"
              accessibilityLabel={link.label}
              accessibilityState={{ disabled: false }}
              style={styles.link}
              onPress={() => openLegal(link.kind)}
            >
              <AppText color={colors.primary} style={styles.linkText}>
                {link.label}
              </AppText>
              <ArrowRight size={18} color={colors.primary} />
            </Pressable>
          ))}
          <Pressable
            cssInterop={false}
            accessibilityRole="link"
            accessibilityLabel="Disclaimer"
            style={styles.link}
            onPress={() => navigation.navigate('Disclaimer')}
          >
            <AppText color={colors.primary} style={styles.linkText}>
              Disclaimer
            </AppText>
            <ArrowRight size={18} color={colors.primary} />
          </Pressable>
          <Pressable
            cssInterop={false}
            accessibilityRole="link"
            accessibilityLabel="Contact Us"
            style={styles.link}
            onPress={() => navigation.navigate('ContactUs')}
          >
            <AppText color={colors.primary} style={styles.linkText}>
              Contact Us
            </AppText>
            <ArrowRight size={18} color={colors.primary} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  back: {
    position: 'absolute',
    left: 10,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 20,
    gap: 32,
    paddingBottom: 32,
  },
  section: { gap: 18 },
  sectionHeading: { gap: 10 },
  accent: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  body: { lineHeight: 26 },
  aboutImage: {
    width: '100%',
    height: undefined,
    aspectRatio: 640 / 426,
    borderRadius: 18,
  },
  storyPanel: {
    padding: 20,
    gap: 28,
    backgroundColor: colors.offWhite,
    borderRadius: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  half: { width: '47%' },
  full: { width: '100%' },
  valueCard: {
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.white,
    gap: 12,
  },
  valueIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softPink,
  },
  steps: { gap: 12, paddingTop: 6 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 18,
    borderRadius: 16,
    backgroundColor: colors.softPink,
  },
  stepNumber: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  stepTitle: { flex: 1, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  locationCard: {
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  locationImage: { width: '100%', height: undefined, aspectRatio: 320 / 250 },
  locationLabel: { padding: 14, fontWeight: '600' },
  testimonial: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: colors.offWhite,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 18,
  },
  quote: { width: 28, height: 25, tintColor: colors.primary },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  authorText: { flex: 1, gap: 2 },
  authorName: { fontWeight: '700' },
  footer: {
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 8,
  },
  footerBrand: { alignItems: 'center', paddingBottom: 8 },
  version: { textAlign: 'center', marginBottom: 6 },
  link: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  linkText: { flexShrink: 1, fontWeight: '600' },
});
