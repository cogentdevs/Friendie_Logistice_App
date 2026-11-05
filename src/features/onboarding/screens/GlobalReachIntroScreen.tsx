import React, { useRef, useState } from 'react';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { useOnboardingBack } from '../hooks/useOnboardingNavigation';
import { useUIStore } from '../../../store/uiStore';
import { colors } from '../../../theme';

export function GlobalReachIntroScreen() {
  useOnboardingBack('VerifiedReliable');
  const saving = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = async () => {
    if (saving.current) return;
    saving.current = true;
    setLoading(true);
    setError(null);
    try {
      await useUIStore.getState().completeOnboarding();
      // RootNavigator selects Login or the real authenticated entry from session state.
    } catch {
      setError(
        'Could not save your preference. Check device storage and tap Get Started to retry.',
      );
    } finally {
      saving.current = false;
      setLoading(false);
    }
  };
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
