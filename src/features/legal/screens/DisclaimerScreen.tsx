import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ShieldAlert } from 'lucide-react-native';
import { RootStackParamList } from '../../../navigation/navigationTypes';
import { colors } from '../../../theme';
import { LegalDocumentReader } from '../components/LegalDocumentReader';
import { loadDisclaimer } from '../services/disclaimerService';
export function DisclaimerScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Disclaimer'>) {
  return (
    <LegalDocumentReader
      title="Disclaimer"
      loadDocument={loadDisclaimer}
      onBack={() => navigation.goBack()}
      retryLabel="Retry Disclaimer"
      introduction={{
        title: 'Important Information',
        text: 'Review the information below alongside our Terms & Conditions and Privacy Policy.',
        icon: <ShieldAlert size={28} color={colors.primary} />,
      }}
      draftNotice="No company-approved disclaimer is available in this app. The proposed sections below are draft placeholders, not legal provisions or liability waivers."
      draftDetail="No statements about permitted items or routes, verification, safety, delivery, customs clearance or company responsibility have been finalized here."
      relatedDocuments={[
        {
          label: 'Terms & Conditions',
          onPress: () => navigation.navigate('TermsConditions'),
        },
        {
          label: 'Privacy Policy',
          onPress: () => navigation.navigate('PrivacyPolicy'),
        },
        {
          label: 'Contact Us',
          onPress: () => navigation.navigate('ContactSupport'),
        },
      ]}
    />
  );
}
