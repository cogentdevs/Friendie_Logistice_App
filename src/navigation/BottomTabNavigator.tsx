import { useAuthStore } from '../store/authStore';
import { requireAuth } from '../features/auth/services/authFlowCoordinator';
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from './navigationTypes';
import { CustomTabBar } from './components/CustomTabBar';
import { HomeNavigator } from './HomeNavigator';
import { ListingsNavigator } from './ListingsNavigator';
import { PostNavigator } from './PostNavigator';
import { MessagesNavigator } from './MessagesNavigator';
import { ProfileNavigator } from './ProfileNavigator';
const Tab = createBottomTabNavigator<MainTabParamList>();
export function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={props => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="HomeStack" component={HomeNavigator} />
      <Tab.Screen name="ListingsStack" component={ListingsNavigator} />
      <Tab.Screen
        name="PostListingStack"
        component={PostNavigator}
        listeners={{
          tabPress: event => {
            event.preventDefault();
            requireAuth({ type: 'POST_LISTING' });
          },
        }}
      />
      <Tab.Screen
        name="MessagesStack"
        component={MessagesNavigator}
        listeners={{
          tabPress: event => {
            event.preventDefault();
            requireAuth({ type: 'OPEN_MESSAGES' });
          },
        }}
      />
      <Tab.Screen
        name="ProfileStack"
        component={ProfileNavigator}
        listeners={({ navigation }) => ({
          tabPress: event => {
            if (useAuthStore.getState().status !== 'authenticated') {
              event.preventDefault();
              navigation.navigate('ProfileStack', { screen: 'Profile' });
            }
          },
        })}
      />
    </Tab.Navigator>
  );
}
