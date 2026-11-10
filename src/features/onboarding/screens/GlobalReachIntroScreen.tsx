import React from 'react';
import { useCompleteOnboarding } from '../hooks/useCompleteOnboarding';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { useOnboardingBack } from '../hooks/useOnboardingNavigation';
import { colors } from '../../../theme';

export function GlobalReachIntroScreen() {
  useOnboardingBack('VerifiedReliable');
  const { complete, loading, error } = useCompleteOnboarding();
  return (
    <OnboardingLayout
      title={'Global Reach\nLocal Trust'}
      description="Find opportunities across multiple countries and major destinations."
      illustration={require('../../../assets/04_global_delivery_route.png')}
      backgroundColor={colors.white}
      activeDot={3}
      buttonTitle="Get Started"
      buttonIcon="check"
      loading={loading}
      error={error}
      onNext={complete}
    />
  );
}
