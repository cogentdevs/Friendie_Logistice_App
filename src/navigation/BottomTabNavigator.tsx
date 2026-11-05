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
      <Tab.Screen name="PostListingStack" component={PostNavigator} />
      <Tab.Screen name="MessagesStack" component={MessagesNavigator} />
      <Tab.Screen name="ProfileStack" component={ProfileNavigator} />
    </Tab.Navigator>
  );
}
