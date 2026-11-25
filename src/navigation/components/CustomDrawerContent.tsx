import { requireAuth } from '../../features/auth/services/authFlowCoordinator';
import { pendingActionSchema } from '../../features/auth/types/pendingAction.types';
import { LogoutConfirmationModal } from '../../features/auth/components/LogoutConfirmationModal';
import React from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
import {
  Package,
  Heart,
  Star,
  Mail,
  ShieldAlert,
  Settings,
  LockKeyhole,
  ClipboardList,
  Info,
  Home,
} from 'lucide-react-native';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Profile } from '../../features/profile/services/profileService';
import { colors, spacing } from '../../theme';
import { useDevelopmentStore } from '../../store/developmentStore';
import { useAuthStore } from '../../store/authStore';
import { appConfig } from '../../constants/appConfig';
import { logoutSession } from '../../features/auth/services/sessionLogout';
import { AppAvatar } from '../../components/ui/AppAvatar';
import { profileAvatarUri } from '../../features/profile/components/profileAvatarUri';
import { AppBadge } from '../../components/ui/AppBadge';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
const entries = [
  { name: 'MainTabs', label: 'Home', icon: Home },
  { name: 'MyListings', label: 'My Listings', icon: Package },
  { name: 'DealHistory', label: 'My Work History', icon: ClipboardList },
  { name: 'IncomingRequests', label: 'Incoming Requests', icon: ClipboardList },
  { name: 'OutgoingRequests', label: 'Outgoing Requests', icon: ClipboardList },
  { name: 'SavedListings', label: 'Saved Listings', icon: Heart },
  { name: 'MyReviews', label: 'My Reviews', icon: Star },
  { name: 'Settings', label: 'Settings', icon: Settings },
  { name: 'About', label: 'About', icon: Info },
  { name: 'ContactSupport', label: 'Contact Us', icon: Mail },
  { name: 'PrivacyPolicy', label: 'Privacy Policy', icon: LockKeyhole },
  { name: 'TermsConditions', label: 'Terms & Conditions', icon: ClipboardList },
  { name: 'Disclaimer', label: 'Disclaimer', icon: ShieldAlert },
];
export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const user = useAuthStore(state =>
    state.status === 'authenticated' ? state.user : null,
  );
  const previewActive = useDevelopmentStore(state => state.previewActive);
  // Observe ProfileScreen's owner-scoped cache without initiating any fetch.
  const { data: cachedProfile } = useQuery<Profile>({
    queryKey: ['profile', user?.id ?? 'guest'],
    queryFn: skipToken,
  });
  const profile = user && cachedProfile?.id === user.id ? cachedProfile : null;
  const displayName =
    profile?.name?.trim() ||
    user?.name ||
    (previewActive ? 'UI Preview' : 'Guest');
  const avatarUrl = profileAvatarUri(
    profile ? profile.avatarUrl ?? undefined : user?.avatarUrl || undefined,
  );
  const [failedAvatar, setFailedAvatar] = React.useState<string>();
  const avatarKey = `${user?.id ?? 'guest'}:${avatarUrl ?? ''}`;
  const verified = (profile?.verified ?? user?.verified) === true;
  const queryClient = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [logoutVisible, setLogoutVisible] = React.useState(false);
  const logoutFlight = React.useRef(false);
  const signOut = async () => {
    if (logoutFlight.current) return;
    logoutFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await logoutSession(queryClient);
      if (!result.cacheCleared)
        Alert.alert('Signed out', 'Some local app data could not be removed.');
    } catch {
      setError('Could not clear your secure session. Please try again.');
    } finally {
      logoutFlight.current = false;
      setBusy(false);
      setLogoutVisible(false);
    }
  };
  return (
    <DrawerContentScrollView {...props}>
      <View style={styles.identity}>
        <AppAvatar
          key={avatarKey}
          fallback="person"
          name={displayName}
          uri={failedAvatar === avatarKey ? undefined : avatarUrl}
          onError={() => setFailedAvatar(avatarKey)}
          size={64}
        />
        <AppText variant="headingMD" color={colors.navy}>
          {displayName}
        </AppText>
        {user && (
          <AppBadge label={verified ? 'Verified' : 'Verification pending'} />
        )}
        {(appConfig.navigationPreview || previewActive) && (
          <AppText variant="caption">Development preview</AppText>
        )}
      </View>
      {entries.map(({ name, label, icon: Icon }) => (
        <DrawerItem
          key={name}
          label={label}
          focused={props.state.routes[props.state.index].name === name}
          activeTintColor={colors.primary}
          activeBackgroundColor={colors.softPink}
          inactiveTintColor={colors.secondary}
          icon={({ color, size }) => <Icon color={color} size={size} />}
          onPress={() => {
            props.navigation.closeDrawer();
            const protectedAction = pendingActionSchema.safeParse({
              type: 'OPEN_ACCOUNT',
              params: { destination: name },
            });
            if (protectedAction.success) {
              requireAuth(protectedAction.data);
              return;
            }
            if (name === 'MainTabs') {
              props.navigation.navigate('MainTabs', {
                screen: 'HomeStack',
                params: { screen: 'Home' },
              });
              return;
            }
            if (name === 'MyReviews')
              props.navigation.navigate('MyReviews', {
                initialTab: 'visitors',
                returnTo: 'Home',
              });
            else props.navigation.navigate(name);
          }}
        />
      ))}
      <View style={styles.footer}>
        {previewActive && (
          <AppButton
            title="Exit UI preview"
            variant="secondary"
            onPress={() => useDevelopmentStore.getState().exitPreview()}
          />
        )}
        {user && (
          <AppButton
            title="Logout"
            variant="secondary"
            disabled={!user}
            loading={busy}
            onPress={() => {
              if (!logoutFlight.current) setLogoutVisible(true);
            }}
          />
        )}
        {error && <AppText variant="caption">{error}</AppText>}
      </View>
      <LogoutConfirmationModal
        visible={logoutVisible}
        busy={busy}
        onCancel={() => {
          if (!logoutFlight.current) setLogoutVisible(false);
        }}
        onConfirm={() => {
          signOut().catch(() => {});
        }}
      />
    </DrawerContentScrollView>
  );
}
const styles = StyleSheet.create({
  identity: { padding: spacing.xl, gap: spacing.md },
  footer: { padding: spacing.lg, gap: spacing.sm },
});
