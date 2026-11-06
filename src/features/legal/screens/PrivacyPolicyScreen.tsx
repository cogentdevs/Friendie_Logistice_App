import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/navigationTypes';
import { LegalDocumentReader } from '../components/LegalDocumentReader';
import { loadPrivacyPolicy } from '../services/privacyPolicyService';
export function PrivacyPolicyScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>) {
  return (
    <LegalDocumentReader
      title="Privacy Policy"
      loadDocument={loadPrivacyPolicy}
      onBack={() => navigation.goBack()}
      retryLabel="Retry privacy policy"
      draftNotice="No approved privacy policy is available in this app. The headings below are an editorial outline, not legal terms or privacy commitments."
      draftDetail="Location visibility, including whether precise coordinates are shared with other users, remains unverified. This preview does not establish those practices."
    />
  );
}
