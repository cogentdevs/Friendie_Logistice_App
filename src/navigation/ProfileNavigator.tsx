import { ProfileScreen } from '../features/profile/screens/ProfileScreen';
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileStackParamList } from './navigationTypes';
import { stackOptions, backOptions } from './stackOptions';

import { EditProfileScreen } from '../features/profile/screens/ProfileScreens';
const Stack = createNativeStackNavigator<ProfileStackParamList>();
export function ProfileNavigator() {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        ...stackOptions,
        ...backOptions(navigation.goBack),
      })}
    >
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Edit profile' }}
      />
    </Stack.Navigator>
  );
}
