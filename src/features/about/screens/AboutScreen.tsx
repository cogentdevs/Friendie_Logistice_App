import React from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { CompositeScreenProps, useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Globe2,
  MessageCircle,
  Package,
  Plane,
  Search,
  Star,
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
import { getNativeAppVersion } from '../services/appMetadata';
const stepIcons = [ClipboardList, Search, MessageCircle, Check];
const featureIcons = [Package, Globe2, Star];
export function AboutScreen({
  navigation,
}: CompositeScreenProps<
  DrawerScreenProps<DrawerParamList, 'About'>,
  NativeStackScreenProps<RootStackParamList>
>) {
  const focused = useIsFocused();
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
        <LinearGradient
          colors={[colors.palePink, colors.softPink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <BrandLogo width={190} variant="color" />
          <AppText
            color={colors.navy}
            accessibilityRole="header"
            style={styles.headline}
          >
            {aboutContent.headline}
          </AppText>
          <AppText style={styles.description}>
            {aboutContent.description}
          </AppText>
          <View style={styles.heroIcon}>
            <Plane size={23} color={colors.primary} />
          </View>
        </LinearGradient>
        {aboutContent.status === 'draft' && (
          <AppText variant="caption" color={colors.primary}>
            Draft company content � pending approval.
          </AppText>
        )}
        <View style={styles.mission}>
          <AppText
            accessibilityRole="header"
            color={colors.navy}
            style={styles.sectionTitle}
          >
            Our Mission
          </AppText>
          <AppText style={styles.body}>{aboutContent.mission}</AppText>
        </View>
        <AppText
          accessibilityRole="header"
          color={colors.navy}
          style={styles.sectionTitle}
        >
          How It Works
        </AppText>
        <View style={styles.group}>
          {aboutContent.steps.map((step, index) => {
            const Icon = stepIcons[index];
            return (
              <View key={step.title} style={styles.card}>
                <View style={styles.number}>
                  <AppText color={colors.primary} style={styles.numberText}>
                    {index + 1}
                  </AppText>
                </View>
                <View style={styles.cardContent}>
                  <View style={styles.stepHeading}>
                    <Icon size={21} color={colors.primary} />
                    <AppText color={colors.navy} style={styles.cardTitle}>
                      {step.title}
                    </AppText>
                  </View>
                  <AppText style={styles.body}>{step.text}</AppText>
                </View>
              </View>
            );
          })}
        </View>
        <AppText
          accessibilityRole="header"
          color={colors.navy}
          style={styles.sectionTitle}
        >
          Why Friendie Logistics?
        </AppText>
        <View style={styles.group}>
          {aboutContent.features.map((feature, index) => {
            const Icon = featureIcons[index];
            return (
              <View key={feature.title} style={styles.card}>
                <View style={styles.featureIcon}>
                  <Icon size={24} color={colors.primary} />
                </View>
                <View style={styles.cardContent}>
                  <AppText color={colors.navy} style={styles.cardTitle}>
                    {feature.title}
                  </AppText>
                  <AppText style={styles.body}>{feature.text}</AppText>
                </View>
              </View>
            );
          })}
        </View>
        <View style={styles.footer}>
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
              onPress={() => {
                openLegal(link.kind);
              }}
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
    maxWidth: 640,
    alignSelf: 'center',
    padding: 20,
    gap: 18,
    paddingBottom: 32,
  },
  hero: { borderRadius: 22, padding: 24, gap: 18, alignItems: 'center' },
  headline: {
    fontSize: 27,
    lineHeight: 35,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: { textAlign: 'center', lineHeight: 23 },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mission: { gap: 12, paddingVertical: 6 },
  sectionTitle: { fontSize: 21, lineHeight: 29, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 23 },
  group: { gap: 12 },
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    shadowColor: colors.navy,
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  number: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softPink,
  },
  numberText: { fontWeight: '800', fontSize: 16 },
  cardContent: { flex: 1, gap: 8 },
  stepHeading: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  cardTitle: { fontSize: 16, lineHeight: 23, fontWeight: '700', flexShrink: 1 },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.softPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 8,
  },
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
