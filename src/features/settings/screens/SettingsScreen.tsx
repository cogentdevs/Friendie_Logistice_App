import React, { useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { CompositeScreenProps, useIsFocused } from '@react-navigation/native';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Info,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  ShieldAlert,
  UserRound,
  LucideIcon,
} from 'lucide-react-native';
import {
  DrawerParamList,
  RootStackParamList,
} from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { AppText } from '../../../components/ui/AppText';
import { colors } from '../../../theme';
import { useAuthStore } from '../../../store/authStore';
import {
  isUiPreviewActive,
  useDevelopmentStore,
} from '../../../store/developmentStore';
import { useLocationStore } from '../../location/store/locationStore';
import { getNativeAppVersion } from '../../about/services/appMetadata';
import { logoutSession } from '../../auth/services/sessionLogout';
import { LogoutConfirmationModal } from '../../auth/components/LogoutConfirmationModal';
type Props = CompositeScreenProps<
  DrawerScreenProps<DrawerParamList, 'Settings'>,
  NativeStackScreenProps<RootStackParamList>
>;
export function SettingsScreen({ navigation }: Props) {
  const focused = useIsFocused(),
    client = useQueryClient();
  const status = useAuthStore(s => s.status);
  useDevelopmentStore(s => s.previewActive);
  const selection = useLocationStore(s => s.selection);
  const version = getNativeAppVersion();
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const flight = useRef(false);
  const canLogout = status === 'authenticated' || isUiPreviewActive();
  const locationSummary =
    selection.mode === 'worldwide'
      ? 'Worldwide - no radius restriction'
      : (selection.filter.source === 'gps'
          ? 'GPS search center'
          : 'Manual search center') +
        ' - ' +
        selection.filter.radiusKm +
        ' km';
  const back = () =>
    navigation.canGoBack()
      ? navigation.goBack()
      : navigation.navigate('MainTabs', {
          screen: 'HomeStack',
          params: { screen: 'Home' },
        });
  const logout = async () => {
    if (flight.current || !canLogout) return;
    flight.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await logoutSession(client);
      setConfirm(false);
      if (!result.cacheCleared)
        Alert.alert('Signed out', 'Some local app data could not be removed.');
    } catch {
      setError('Could not clear your secure session. Please try Logout again.');
      setConfirm(false);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  };
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
          accessibilityLabel="Back from Settings"
          disabled={busy}
          accessibilityState={{ disabled: busy }}
          style={styles.back}
          onPress={back}
        >
          <ArrowLeft size={24} color={colors.navy} />
        </Pressable>
        <AppText
          accessibilityRole="header"
          color={colors.navy}
          style={styles.title}
        >
          Settings
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Account">
          <SettingsRow
            label="Edit Profile"
            icon={UserRound}
            disabled={busy}
            onPress={() =>
              navigation.navigate('MainTabs', {
                screen: 'ProfileStack',
                params: { screen: 'EditProfile', initial: false },
              })
            }
          />
          <SettingsRow
            label="Change Password"
            icon={LockKeyhole}
            disabled={busy}
            onPress={() =>
              navigation.navigate('ChangePassword', { returnTo: undefined })
            }
          />
        </Section>
        <Section title="Preferences" pink>
          <SettingsRow
            label="Notification Preferences"
            icon={Bell}
            disabled
            description="Unavailable: notification preference controls are not connected."
          />
          <SettingsRow
            label="Location Preferences"
            icon={MapPin}
            disabled={busy}
            description={
              locationSummary +
              '. Manage saved search location and radius in Filters.'
            }
            onPress={() =>
              navigation.navigate('MainTabs', {
                screen: 'ListingsStack',
                params: { screen: 'Filters', initial: false },
              })
            }
          />
        </Section>
        <Section title="Privacy & Legal">
          <SettingsRow
            label="Privacy Policy"
            icon={LockKeyhole}
            disabled={busy}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          />
          <SettingsRow
            label="Terms & Conditions"
            icon={ClipboardList}
            disabled={busy}
            onPress={() => navigation.navigate('TermsConditions')}
          />
          <SettingsRow
            label="Disclaimer"
            icon={ShieldAlert}
            disabled={busy}
            onPress={() => navigation.navigate('Disclaimer')}
          />
        </Section>
        <Section title="Information">
          <SettingsRow
            label="About Us"
            icon={Info}
            disabled={busy}
            onPress={() => navigation.navigate('About')}
          />
          <SettingsRow
            label="Contact Us"
            icon={Mail}
            disabled={busy}
            onPress={() => navigation.navigate('ContactSupport')}
          />
          <SettingsRow
            label="Help & Support"
            icon={CircleHelp}
            disabled={busy}
            onPress={() => navigation.navigate('HelpSupport')}
          />
        </Section>
        <Section title="Account actions">
          <SettingsRow
            label="Logout"
            icon={LogOut}
            disabled={busy || !canLogout}
            description={
              !canLogout
                ? 'Sign in to manage your session.'
                : busy
                ? 'Signing out...'
                : undefined
            }
            onPress={() => {
              if (!flight.current) setConfirm(true);
            }}
          />
        </Section>
        {!!error && (
          <AppText accessibilityRole="alert" color={colors.danger}>
            {error}
          </AppText>
        )}
        <AppText variant="caption" style={styles.version}>
          {version ? 'App version ' + version : 'App version unavailable'}
        </AppText>
      </ScrollView>
      <LogoutConfirmationModal
        visible={confirm}
        busy={busy}
        onCancel={() => {
          if (!flight.current) setConfirm(false);
        }}
        onConfirm={() => {
          logout().catch(() => {});
        }}
      />
    </SafeScreen>
  );
}
function Section({
  title,
  children,
  pink = false,
}: {
  title: string;
  children: React.ReactNode;
  pink?: boolean;
}) {
  return (
    <View style={styles.section}>
      <AppText
        accessibilityRole="header"
        color={colors.navy}
        style={styles.sectionTitle}
      >
        {title}
      </AppText>
      <View style={[styles.card, pink && styles.pink]}>{children}</View>
    </View>
  );
}
function SettingsRow({
  label,
  icon: Icon,
  description,
  disabled = false,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  description?: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      cssInterop={false}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Icon size={22} color={colors.primary} />
      <View style={styles.rowText}>
        <AppText
          color={disabled ? colors.secondary : colors.navy}
          style={styles.label}
        >
          {label}
        </AppText>
        {description && (
          <AppText variant="caption" style={styles.description}>
            {description}
          </AppText>
        )}
      </View>
      {!disabled && <ChevronRight size={19} color={colors.secondary} />}
    </Pressable>
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
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    padding: 20,
    gap: 24,
    paddingBottom: 32,
  },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
    paddingLeft: 4,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
  },
  pink: { backgroundColor: colors.palePink },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowText: { flex: 1, gap: 5 },
  label: { fontSize: 15, lineHeight: 23, fontWeight: '600' },
  description: { lineHeight: 20 },
  pressed: { opacity: 0.65 },
  version: { textAlign: 'center', paddingVertical: 6 },
});
