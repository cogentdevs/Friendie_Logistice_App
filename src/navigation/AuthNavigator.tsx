import { useAuthFlowStore } from '../features/auth/store/authFlowStore';
import { useEffect } from 'react';
import { cancelAuthentication } from '../features/auth/services/authFlowCoordinator';
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './navigationTypes';
import { stackOptions } from './stackOptions';
import { ResetPasswordScreen } from '../features/auth/screens/AuthScreens';
import { ForgotPasswordScreen } from '../features/auth/screens/ForgotPasswordScreen';
import { RegisterScreen } from '../features/auth/screens/RegisterScreen';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
const Stack = createNativeStackNavigator<AuthStackParamList>();
export function AuthNavigator() {
  useEffect(() => {
    const flowId = useAuthFlowStore.getState().flow?.id;
    return () => {
      // A stale unmount must never cancel a newer auth flow.
      if (
        flowId !== undefined &&
        useAuthFlowStore.getState().flow?.id === flowId
      )
        cancelAuthentication();
    };
  }, []);
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{ title: 'Reset password' }}
      />
    </Stack.Navigator>
  );
}
