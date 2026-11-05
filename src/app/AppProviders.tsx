import React, { PropsWithChildren, useEffect } from 'react';
import { AppState, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../types/api';
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      retry: (count, error) =>
        !(
          error instanceof ApiError &&
          ['unauthorized', 'forbidden', 'validation', 'not-found'].includes(
            error.kind,
          )
        ) && count < 2,
    },
    mutations: { retry: false },
  },
});
export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (Platform.OS !== 'web') focusManager.setFocused(state === 'active');
    });
    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      if (state.status === 'guest' && previous.status === 'authenticated')
        queryClient.clear();
    });
    return () => {
      subscription.remove();
      unsubscribe();
    };
  }, []);
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
const styles = StyleSheet.create({ root: { flex: 1 } });
