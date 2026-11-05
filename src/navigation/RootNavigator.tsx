import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './navigationTypes';
import { AuthNavigator } from './AuthNavigator';
import { DrawerNavigator } from './DrawerNavigator';
import { linking } from './linking';
import { navigationRef, flushPendingNotification } from './navigationRef';
import { SplashScreen } from '../features/onboarding/screens/SplashScreen';
import { WelcomeScreen } from '../features/onboarding/screens/WelcomeScreen';
import { GlobalReachIntroScreen } from '../features/onboarding/screens/GlobalReachIntroScreen';
import { VerifiedIntroScreen } from '../features/onboarding/screens/VerifiedIntroScreen';
import { SendCarryIntroScreen } from '../features/onboarding/screens/SendCarryIntroScreen';
import { useAuthStore } from '../store/authStore';
import { useDevelopmentStore } from '../store/developmentStore';
import { useUIStore } from '../store/uiStore';
import { useBootstrap } from '../app/AppBootstrap';
import { appConfig } from '../constants/appConfig';
import { colors } from '../theme';
import { SafeScreen } from '../components/layout/SafeScreen';
import { ErrorState } from '../components/ui/ErrorState';
const Stack = createNativeStackNavigator<RootStackParamList>();
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.offWhite,
    card: colors.white,
    text: colors.navy,
    border: colors.border,
    notification: colors.primary,
  },
};
export function RootNavigator() {
  const { ready, error, retry } = useBootstrap();
  const status = useAuthStore(state => state.status);
  const onboarded = useUIStore(state => state.onboardingComplete);
  const previewActive = useDevelopmentStore(state => state.previewActive);
  const loginRequested = useDevelopmentStore(state => state.authEntryRequested);
  const appAllowed =
    status === 'authenticated' ||
    (__DEV__ &&
      !loginRequested &&
      (appConfig.navigationPreview ||
        (appConfig.uiPreviewEnabled && previewActive)));
  if (error)
    return (
      <SafeScreen edges={['top', 'bottom', 'left', 'right']}>
        <ErrorState message={error} onRetry={retry} />
      </SafeScreen>
    );
  if (!ready) return <SplashScreen />;
  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      theme={theme}
      onReady={flushPendingNotification}
      onStateChange={flushPendingNotification}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!ready ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : appAllowed ? (
          <Stack.Screen name="AppDrawer" component={DrawerNavigator} />
        ) : !onboarded && !loginRequested ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Onboarding" component={SendCarryIntroScreen} />
            <Stack.Screen
              name="VerifiedReliable"
              component={VerifiedIntroScreen}
            />
            <Stack.Screen
              name="GlobalReach"
              component={GlobalReachIntroScreen}
            />
            <Stack.Screen name="AuthStack" component={AuthNavigator} />
          </>
        ) : (
          <Stack.Screen name="AuthStack" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
