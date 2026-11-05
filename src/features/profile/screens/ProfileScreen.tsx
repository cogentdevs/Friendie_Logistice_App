import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { CompositeScreenProps, useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Check,
  CircleHelp,
  CreditCard,
  Heart,
  LogOut,
  Package,
  Settings,
  Star,
} from 'lucide-react-native';
import {
  DrawerParamList,
  ProfileStackParamList,
} from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { AppAvatar } from '../../../components/ui/AppAvatar';
import { colors } from '../../../theme';
import { useAuthStore } from '../../../store/authStore';
import { useProfile } from '../hooks/useProfile';
import { logoutSession } from '../../auth/services/sessionLogout';
import { ProfileMenuRow } from '../components/ProfileMenuRow';
type Props = CompositeScreenProps<
  NativeStackScreenProps<ProfileStackParamList, 'Profile'>,
  DrawerScreenProps<DrawerParamList, 'MainTabs'>
>;
export function ProfileScreen({ navigation }: Props) {
  const focused = useIsFocused(),
    insets = useSafeAreaInsets(),
    client = useQueryClient();
  const { query, demo } = useProfile(),
    sessionUser = useAuthStore(state => state.user);
  const identity = (!query.isError ? query.data : undefined) ?? sessionUser;
  const name = identity?.name.trim() || 'Traveller',
    verified = identity?.verified === true;
  const statistics = query.isError ? undefined : query.data?.statistics;
  const [avatarFailed, setAvatarFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const confirming = useRef(false),
    loggingOut = useRef(false);
  const uri = identity?.avatarUrl || undefined;
  const failedUri = useRef<string | undefined>(undefined);
  const avatarUnavailable = avatarFailed && failedUri.current === uri;
  const signOut = async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await logoutSession(client);
      if (!result.cacheCleared)
        Alert.alert(
          'Signed out',
          'Some local app data could not be removed. Please clear it before sharing this device.',
        );
    } catch {
      setError('Could not clear your secure session. Please try Logout again.');
    } finally {
      loggingOut.current = false;
      setBusy(false);
    }
  };
  const confirmLogout = () => {
    if (confirming.current || loggingOut.current) return;
    confirming.current = true;
    Alert.alert(
      'Logout?',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            confirming.current = false;
          },
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            confirming.current = false;
            signOut().catch(() => {});
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          confirming.current = false;
        },
      },
    );
  };
  const rows = [
    {
      label: 'My Listings',
      icon: Package,
      onPress: () => navigation.navigate('MyListings'),
    },
    {
      label: 'Saved Listings',
      icon: Heart,
      onPress: () => navigation.navigate('SavedListings'),
    },
    {
      label: 'My Reviews',
      icon: Star,
      onPress: () => navigation.navigate('MyReviews'),
    },
    {
      label: 'Payment Methods',
      icon: CreditCard,
      onPress: () =>
        Alert.alert(
          'Payment Methods unavailable',
          'Payment methods are not connected yet.',
        ),
    },
    {
      label: 'Notifications',
      icon: Bell,
      onPress: () => navigation.navigate('Notifications'),
    },
    {
      label: 'Help & Support',
      icon: CircleHelp,
      onPress: () => navigation.navigate('HelpSupport'),
    },
    { label: 'Logout', icon: LogOut, onPress: confirmLogout },
  ];
  const stats = [
    { label: 'Listings', value: statistics?.listings },
    { label: 'Reviews', value: statistics?.reviews },
    {
      label: 'Rating',
      value:
        statistics?.rating != null ? statistics.rating.toFixed(1) : undefined,
    },
  ];
  return (
    <SafeScreen backgroundColor={colors.white}>
      {focused && <StatusBar barStyle="light-content" />}
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 26 }]}
        >
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel="Profile Settings"
            onPress={() => navigation.navigate('Settings')}
            disabled={busy}
            style={[styles.settings, { top: insets.top + 8 }]}
          >
            <Settings size={24} color={colors.white} />
          </Pressable>
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel="Edit Profile"
            accessibilityHint={
              demo
                ? 'Open the profile editor preview'
                : 'Profile editing is not available yet'
            }
            accessibilityState={{ disabled: !demo || busy }}
            disabled={!demo || busy}
            onPress={() => navigation.navigate('EditProfile')}
            style={styles.identity}
          >
            <View style={styles.avatarBorder}>
              {uri && !avatarUnavailable ? (
                <Image
                  accessibilityLabel={name + ' avatar'}
                  source={{ uri }}
                  style={styles.avatar}
                  onError={() => {
                    failedUri.current = uri;
                    setAvatarFailed(true);
                  }}
                />
              ) : (
                <AppAvatar name={name} size={84} />
              )}{' '}
              {verified && (
                <View
                  accessibilityLabel="Verified profile"
                  style={styles.verified}
                >
                  <Check size={14} color={colors.white} />
                </View>
              )}
            </View>
            <AppText color={colors.white} style={styles.name}>
              {name}
            </AppText>
            {verified && (
              <AppText color={colors.white} style={styles.subtitle}>
                Verified Member
              </AppText>
            )}
          </Pressable>
        </LinearGradient>
        <View style={styles.body}>
          <View style={styles.statistics}>
            {stats.map((stat, index) => (
              <React.Fragment key={stat.label}>
                {index > 0 && <View style={styles.statDivider} />}
                <View style={styles.stat}>
                  <View style={styles.statValueRow}>
                    <AppText color={colors.navy} style={styles.statValue}>
                      {stat.value ?? '\u2014'}
                    </AppText>
                    {stat.label === 'Rating' && statistics?.rating != null && (
                      <Star
                        size={17}
                        color={colors.warning}
                        fill={colors.warning}
                      />
                    )}
                  </View>
                  <AppText variant="caption">{stat.label}</AppText>
                </View>
              </React.Fragment>
            ))}
          </View>
          {demo && (
            <AppText
              variant="caption"
              color={colors.primary}
              style={styles.notice}
            >
              UI demo - sample profile and statistics
            </AppText>
          )}
          {query.isPending && (
            <View accessibilityLabel="Loading profile" style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <AppText variant="caption">Loading profile...</AppText>
            </View>
          )}
          {query.isError && (
            <View style={styles.errorPanel}>
              <AppText accessibilityRole="alert">
                Profile details could not be loaded. Please try again.
              </AppText>
              <AppButton
                title="Retry profile"
                variant="ghost"
                onPress={() => {
                  query.refetch().catch(() => {});
                }}
              />
            </View>
          )}
          <View style={styles.menu}>
            {rows.map((row, index) => (
              <ProfileMenuRow
                key={row.label}
                {...row}
                disabled={busy}
                last={index === rows.length - 1}
              />
            ))}
          </View>
          {busy && (
            <ActivityIndicator
              accessibilityLabel="Signing out"
              color={colors.primary}
            />
          )}
          {!!error && (
            <AppText
              accessibilityRole="alert"
              color={colors.danger}
              style={styles.notice}
            >
              {error}
            </AppText>
          )}
        </View>
      </ScrollView>
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 16 },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 62,
    alignItems: 'center',
    minHeight: 245,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
  },
  settings: {
    position: 'absolute',
    right: 14,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  identity: { alignItems: 'center', gap: 9, maxWidth: '88%' },
  avatarBorder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  verified: {
    position: 'absolute',
    right: -1,
    bottom: 0,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: { fontSize: 13, lineHeight: 18 },
  body: {
    paddingHorizontal: 18,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: 8,
  },
  statistics: {
    marginTop: -37,
    minHeight: 76,
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.navy,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statValue: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 34,
    backgroundColor: colors.border,
  },
  menu: { paddingHorizontal: 6, paddingTop: 7 },
  notice: { paddingHorizontal: 6, paddingVertical: 3 },
  loading: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  errorPanel: { paddingHorizontal: 6, paddingTop: 8, gap: 4 },
});
