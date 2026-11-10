import { useCompleteOnboarding } from './useCompleteOnboarding';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import {
  StackActions,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/navigationTypes';

type Previous = 'Welcome' | 'Onboarding' | 'VerifiedReliable';
type Next = 'VerifiedReliable' | 'GlobalReach';
export function useOnboardingBack(previous: Previous) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          const state = navigation.getState();
          const previousIndex = state.routes.findIndex(
            route => route.name === previous,
          );
          if (previousIndex >= 0 && previousIndex < state.index) {
            navigation.dispatch(StackActions.popTo(previous));
          } else if (previous === 'Welcome') {
            navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
          } else {
            // Direct entries rebuild the preceding onboarding history.
            navigation.reset({
              index: previous === 'VerifiedReliable' ? 2 : 1,
              routes: [
                { name: 'Welcome' },
                { name: 'Onboarding' },
                ...(previous === 'VerifiedReliable'
                  ? [{ name: 'VerifiedReliable' as const }]
                  : []),
              ],
            });
          }
          return true;
        },
      );
      return () => subscription.remove();
    }, [navigation, previous]),
  );
  return navigation;
}
export function useOnboardingNavigation(previous: Previous, next: Next) {
  const navigation = useOnboardingBack(previous);
  const { complete, loading, error } = useCompleteOnboarding();
  return {
    loading,
    error,
    onSkip: complete,
    onNext: () => {
      if (!loading) navigation.navigate(next);
    },
  };
}
