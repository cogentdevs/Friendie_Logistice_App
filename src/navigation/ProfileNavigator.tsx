import { withAccountAccess } from './components/AccountAccessBoundary';
import { ProfileDashboardScreen } from '../features/dashboard/screens/ProfileDashboardScreen';
import { ProfileScreen } from '../features/profile/screens/ProfileScreen';
import React from 'react';
import { ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { GuestProfileScreen } from '../features/profile/screens/GuestProfileScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileStackParamList } from './navigationTypes';
import { stackOptions, backOptions } from './stackOptions';

import { EditProfileScreen } from '../features/profile/screens/EditProfileScreen';
function ProfileEntry(props: React.ComponentProps<typeof ProfileScreen>) {
  const status = useAuthStore(state => state.status);
  const user = useAuthStore(state => state.user);
  if (status === 'restoring')
    return <ActivityIndicator accessibilityLabel="Checking your session" />;
  return status === 'authenticated' && user ? (
    <ProfileScreen {...props} />
  ) : (
    <GuestProfileScreen />
  );
}
const AccountDashboard = withAccountAccess(ProfileDashboardScreen, {
  type: 'OPEN_ACCOUNT',
  params: { destination: 'ProfileDashboard' },
});
const AccountEditProfile = withAccountAccess(EditProfileScreen, {
  type: 'OPEN_ACCOUNT',
  params: { destination: 'EditProfile' },
});
const Stack = createNativeStackNavigator<ProfileStackParamList>();
function ProfileNavigatorContent() {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        ...stackOptions,
        ...backOptions(navigation.goBack),
      })}
    >
      <Stack.Screen
        name="Profile"
        component={ProfileEntry}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProfileDashboard"
        component={AccountDashboard}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditProfile"
        component={AccountEditProfile}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export const ProfileNavigator = ProfileNavigatorContent;
