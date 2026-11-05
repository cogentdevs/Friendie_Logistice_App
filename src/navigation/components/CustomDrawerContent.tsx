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
  Bell,
  MapPin,
  Settings,
  CircleHelp,
  Info,
  Home,
} from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { colors, spacing } from '../../theme';
import { useDevelopmentStore } from '../../store/developmentStore';
import { useAuthStore } from '../../store/authStore';
import { appConfig } from '../../constants/appConfig';
import { logoutSession } from '../../features/auth/services/sessionLogout';
import { AppAvatar } from '../../components/ui/AppAvatar';
import { AppBadge } from '../../components/ui/AppBadge';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
const entries = [
  { name: 'MainTabs', label: 'Home', icon: Home },
  { name: 'MyListings', label: 'My Listings', icon: Package },
  { name: 'SavedListings', label: 'Saved Listings', icon: Heart },
  { name: 'MyReviews', label: 'My Reviews', icon: Star },
  { name: 'Notifications', label: 'Notifications', icon: Bell },
  { name: 'Tracking', label: 'Tracking', icon: MapPin },
  { name: 'Settings', label: 'Settings', icon: Settings },
  { name: 'HelpSupport', label: 'Help & Support', icon: CircleHelp },
  { name: 'About', label: 'About', icon: Info },
];
export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const user = useAuthStore(state => state.user);
  const previewActive = useDevelopmentStore(state => state.previewActive);
  const queryClient = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  return (
    <DrawerContentScrollView {...props}>
      <View style={styles.identity}>
        <AppAvatar
          name={user?.name ?? 'Navigation Preview'}
          uri={user?.avatarUrl}
          size={64}
        />
        <AppText variant="headingMD" color={colors.navy}>
          {user?.name ?? 'Navigation Preview'}
        </AppText>
        {user && (
          <AppBadge
            label={user.verified ? 'Verified' : 'Verification pending'}
          />
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
          onPress={() => props.navigation.navigate(name)}
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
        <AppButton
          title="Logout"
          variant="secondary"
          disabled={!user}
          loading={busy}
          onPress={() =>
            Alert.alert('Logout?', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                  if (busy) return;
                  setBusy(true);
                  setError('');
                  try {
                    const result = await logoutSession(queryClient);
                    if (!result.cacheCleared)
                      Alert.alert(
                        'Signed out',
                        'Some local app data could not be removed.',
                      );
                  } catch {
                    setError(
                      'Could not clear your secure session. Please try again.',
                    );
                  } finally {
                    setBusy(false);
                  }
                },
              },
            ])
          }
        />
        {error && <AppText variant="caption">{error}</AppText>}
      </View>
    </DrawerContentScrollView>
  );
}
const styles = StyleSheet.create({
  identity: { padding: spacing.xl, gap: spacing.md },
  footer: { padding: spacing.lg, gap: spacing.sm },
});
