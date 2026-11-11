import React from 'react';
import { ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigationTypes';
import { useAuthStore } from '../../store/authStore';
import {
  isStaticTestingPreviewActive,
  useDevelopmentStore,
} from '../../store/developmentStore';
import { SafeScreen } from '../../components/layout/SafeScreen';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { colors } from '../../theme';
import { requireAuth } from '../../features/auth/services/authFlowCoordinator';
import type { PendingAction } from '../../features/auth/types/pendingAction.types';
// Route-level privacy boundary: never mount private queries/forms for a guest or preview session.
export function withAccountAccess<P extends object>(
  Screen: React.ComponentType<P>,
  action: PendingAction | ((props: P) => PendingAction) = {
    type: 'OPEN_PROFILE',
  },
) {
  return function AccountScreen(props: P) {
    const status = useAuthStore(state => state.status);
    const user = useAuthStore(state => state.user);
    const preview = useDevelopmentStore(state => state.previewActive);
    const navigation =
      useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    if (
      (status === 'authenticated' && user) ||
      (preview && isStaticTestingPreviewActive())
    )
      return <Screen {...props} />;
    return (
      <SafeScreen
        edges={['top', 'left', 'right', 'bottom']}
        backgroundColor={colors.white}
      >
        <ScreenContainer backgroundColor={colors.white}>
          {status === 'restoring' ? (
            <ActivityIndicator
              accessibilityLabel="Checking your session"
              color={colors.primary}
            />
          ) : (
            <>
              <AppText variant="headingMD" color={colors.navy}>
                Account access
              </AppText>
              <AppText>
                Sign in to access this account feature. You can continue
                browsing public listings as a guest.
              </AppText>
              <AppButton
                title="Sign In"
                onPress={() =>
                  requireAuth(
                    typeof action === 'function' ? action(props) : action,
                  )
                }
              />
            </>
          )}
          <AppButton
            title="Browse Home"
            variant="secondary"
            onPress={() =>
              navigation.navigate('AppDrawer', {
                screen: 'MainTabs',
                params: { screen: 'HomeStack', params: { screen: 'Home' } },
              })
            }
          />
        </ScreenContainer>
      </SafeScreen>
    );
  };
}
