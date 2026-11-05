import React from 'react';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { useOnboardingNavigation } from '../hooks/useOnboardingNavigation';
const traveller = require('../../../assets/02_traveler_suitcase.png');
export function SendCarryIntroScreen() {
  const actions = useOnboardingNavigation('Welcome', 'VerifiedReliable');
  return (
    <OnboardingLayout
      title={'Send & Carry\nwith People You Trust'}
      description="Connect with verified travellers to send items or carry goods globally."
      illustration={traveller}
      activeDot={0}
      {...actions}
    />
  );
}
