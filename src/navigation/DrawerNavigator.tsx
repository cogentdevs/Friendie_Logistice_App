import { withAccountAccess } from './components/AccountAccessBoundary';
import { ContactUsScreen } from '../features/support/screens/ContactUsScreen';
import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { DrawerParamList } from './navigationTypes';
import { BottomTabNavigator } from './BottomTabNavigator';
import { CustomDrawerContent } from './components/CustomDrawerContent';
import { colors } from '../theme';
import { MyListingsScreen } from '../features/listings/screens/MyListingsScreen';
import { SavedListingsScreen } from '../features/saved/screens/SavedListingsScreen';
import { MyReviewsScreen } from '../features/reviews/screens/MyReviewsScreen';
import { NotificationsScreen } from '../features/notifications/screens/NotificationsScreen';
import { TrackingScreen } from '../features/tracking/screens/TrackingScreen';
import { ChangePasswordScreen } from '../features/settings/screens/ChangePasswordScreen';
import { SettingsScreen } from '../features/settings/screens/SettingsScreen';
import { HelpSupportScreen } from '../features/settings/screens/HelpSupportScreen';
import { AboutScreen } from '../features/about/screens/AboutScreen';
const AccountMyListingsScreen = withAccountAccess(MyListingsScreen, {
  type: 'OPEN_ACCOUNT',
  params: { destination: 'MyListings' },
});
const AccountSavedListingsScreen = withAccountAccess(SavedListingsScreen, {
  type: 'OPEN_ACCOUNT',
  params: { destination: 'SavedListings' },
});
const AccountMyReviewsScreen = withAccountAccess(MyReviewsScreen, {
  type: 'OPEN_ACCOUNT',
  params: { destination: 'MyReviews' },
});
const AccountNotificationsScreen = withAccountAccess(NotificationsScreen, {
  type: 'OPEN_ACCOUNT',
  params: { destination: 'Notifications' },
});
const AccountTrackingScreen = withAccountAccess(TrackingScreen, {
  type: 'OPEN_ACCOUNT',
  params: { destination: 'Tracking' },
});
const AccountSettingsScreen = withAccountAccess(SettingsScreen, {
  type: 'OPEN_ACCOUNT',
  params: { destination: 'Settings' },
});
const AccountChangePasswordScreen = withAccountAccess(ChangePasswordScreen, {
  type: 'OPEN_ACCOUNT',
  params: { destination: 'ChangePassword' },
});
const Drawer = createDrawerNavigator<DrawerParamList>();
export function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={CustomDrawerContent}
      screenOptions={{
        headerTintColor: colors.navy,
        headerStyle: { backgroundColor: colors.white },
        drawerActiveTintColor: colors.primary,
        drawerActiveBackgroundColor: colors.softPink,
        drawerType: 'front',
      }}
    >
      <Drawer.Screen
        name="MainTabs"
        component={BottomTabNavigator}
        options={{ headerShown: false }}
      />
      <Drawer.Screen
        name="MyListings"
        component={AccountMyListingsScreen}
        options={{ title: 'My Listings', headerTitleAlign: 'center' }}
      />
      <Drawer.Screen
        name="SavedListings"
        component={AccountSavedListingsScreen}
        options={{ title: 'Saved listings' }}
      />
      <Drawer.Screen
        name="MyReviews"
        component={AccountMyReviewsScreen}
        options={{ headerShown: false }}
      />
      <Drawer.Screen
        name="Notifications"
        component={AccountNotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <Drawer.Screen
        name="Tracking"
        component={AccountTrackingScreen}
        options={{ title: 'Tracking' }}
      />
      <Drawer.Screen
        name="Settings"
        component={AccountSettingsScreen}
        options={{ headerShown: false }}
      />
      <Drawer.Screen
        name="ChangePassword"
        component={AccountChangePasswordScreen}
        options={{ headerShown: false, swipeEnabled: false }}
      />
      <Drawer.Screen
        name="HelpSupport"
        component={HelpSupportScreen}
        options={{ title: 'Help & Support' }}
      />
      <Drawer.Screen
        name="ContactUs"
        component={ContactUsScreen}
        options={{ headerShown: false, swipeEnabled: false }}
      />
      <Drawer.Screen
        name="About"
        component={AboutScreen}
        options={{ headerShown: false }}
      />
    </Drawer.Navigator>
  );
}
