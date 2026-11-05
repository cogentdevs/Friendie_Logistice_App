import { ChatScreen } from '../features/messages/screens/ChatScreen';
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MessagesStackParamList } from './navigationTypes';
import { stackOptions, backOptions } from './stackOptions';
import { NavigationHeader } from './components/NavigationHeader';
import { ConversationsScreen } from '../features/messages/screens/MessagesScreens';
const Stack = createNativeStackNavigator<MessagesStackParamList>();
export function MessagesNavigator() {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        ...stackOptions,
        ...backOptions(navigation.goBack),
      })}
    >
      <Stack.Screen
        name="Conversations"
        component={ConversationsScreen}
        options={({ navigation }) => ({
          title: 'Messages',
          headerLeft: () => <NavigationHeader navigation={navigation} />,
        })}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
    </Stack.Navigator>
  );
}
