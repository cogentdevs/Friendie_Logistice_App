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
        component={MyListingsScreen}
        options={{ title: 'My Listings', headerTitleAlign: 'center' }}
      />
      <Drawer.Screen
        name="SavedListings"
        component={SavedListingsScreen}
        options={{ title: 'Saved listings' }}
      />
      <Drawer.Screen
        name="MyReviews"
        component={MyReviewsScreen}
        options={{ headerShown: false }}
      />
      <Drawer.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <Drawer.Screen
        name="Tracking"
        component={TrackingScreen}
        options={{ title: 'Tracking' }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <Drawer.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
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
