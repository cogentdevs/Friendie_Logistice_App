import React from 'react';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { useOnboardingNavigation } from '../hooks/useOnboardingNavigation';
import { colors } from '../../../theme';
const shield = require('../../../assets/03_verified_trust_shield.png');
export function VerifiedIntroScreen() {
  const actions = useOnboardingNavigation('Onboarding', 'GlobalReach');
  return (
    <OnboardingLayout
      title={'Safe, Verified &\nReliable'}
      description="Real profiles, reviews and a trusted community for your peace of mind."
      illustration={shield}
      activeDot={1}
      backgroundColor={colors.white}
      {...actions}
    />
  );
}
