import React from 'react';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { LoadingIndicator } from '../../../components/ui/LoadingIndicator';
export function SplashScreen() {
  return (
    <SafeScreen edges={['top', 'bottom', 'left', 'right']}>
      <LoadingIndicator label="Starting Friendie Logistics..." />
    </SafeScreen>
  );
}
