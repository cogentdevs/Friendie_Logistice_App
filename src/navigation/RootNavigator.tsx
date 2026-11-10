import { useQueryClient } from '@tanstack/react-query';
import { clearPrivateAccountMemory } from '../features/auth/services/sessionLogout';
import { DisclaimerScreen } from '../features/legal/screens/DisclaimerScreen';
import { ContactSupportScreen } from '../features/support/screens/ContactSupportScreen';
import { TermsConditionsScreen } from '../features/legal/screens/TermsConditionsScreen';
import { PrivacyPolicyScreen } from '../features/legal/screens/PrivacyPolicyScreen';
import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  cancelAuthentication,
  coordinateAuthentication,
} from '../features/auth/services/authFlowCoordinator';
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
import { useBootstrap } from '../app/AppBootstrap';
import { appConfig, isUiPreviewAllowed } from '../constants/appConfig';
import { colors } from '../theme';
import { SafeScreen } from '../components/layout/SafeScreen';
import { AppButton } from '../components/ui/AppButton';
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
  const {
    ready,
    status: startupStatus,
    error,
    retry,
    continueWithoutPreferences,
  } = useBootstrap();
  const status = useAuthStore(state => state.status);
  const owner = useAuthStore(state => state.user?.id);
  const client = useQueryClient();
  const previousOwner = useRef(owner);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  useLayoutEffect(() => {
    // Guest -> member preserves the public origin. Logout/account switch drops private history.
    if (previousOwner.current && previousOwner.current !== owner) {
      cancelAuthentication();
      clearPrivateAccountMemory(client);
      setSessionEpoch(value => value + 1);
    }
    previousOwner.current = owner;
    coordinateAuthentication();
  }, [owner, status, client]);
  const navigationChanged = () => {
    coordinateAuthentication();
    flushPendingNotification();
  };
  const previewActive = useDevelopmentStore(state => state.previewActive);
  const loginRequested = useDevelopmentStore(state => state.authEntryRequested);
  const preview = isUiPreviewAllowed() && previewActive;
  const needsOnboarding =
    startupStatus === 'onboardingRequired' &&
    !preview &&
    !(__DEV__ && appConfig.navigationPreview);
  const explicitLogin =
    loginRequested && status !== 'authenticated' && !preview;
  const flowKey =
    loginRequested && !preview
      ? 'requested-auth-' + sessionEpoch
      : needsOnboarding
      ? 'onboarding'
      : preview
      ? 'preview'
      : 'main-' + sessionEpoch;
  if (error)
    return (
      <SafeScreen edges={['top', 'bottom', 'left', 'right']}>
        <ErrorState message={error} onRetry={retry} />
        <AppButton
          title="Continue without saved preferences"
          onPress={continueWithoutPreferences}
        />
      </SafeScreen>
    );
  if (!ready) return <SplashScreen />;
  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      theme={theme}
      onReady={navigationChanged}
      onStateChange={navigationChanged}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Group navigationKey={flowKey}>
          {needsOnboarding && !explicitLogin && (
            <>
              <Stack.Screen name="Welcome" component={WelcomeScreen} />
              <Stack.Screen
                name="Onboarding"
                component={SendCarryIntroScreen}
              />
              <Stack.Screen
                name="VerifiedReliable"
                component={VerifiedIntroScreen}
              />
              <Stack.Screen
                name="GlobalReach"
                component={GlobalReachIntroScreen}
              />
            </>
          )}
          {explicitLogin && (
            <Stack.Screen name="AuthStack" component={AuthNavigator} />
          )}
          <Stack.Screen name="AppDrawer" component={DrawerNavigator} />
          {!explicitLogin && (
            <Stack.Screen name="AuthStack" component={AuthNavigator} />
          )}
        </Stack.Group>
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        <Stack.Screen
          name="TermsConditions"
          component={TermsConditionsScreen}
        />
        <Stack.Screen name="Disclaimer" component={DisclaimerScreen} />
        <Stack.Screen name="ContactSupport" component={ContactSupportScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
