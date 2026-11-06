import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/navigationTypes';
import { LegalDocumentReader } from '../components/LegalDocumentReader';
import { loadTermsConditions } from '../services/termsConditionsService';
export function TermsConditionsScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'TermsConditions'>) {
  return (
    <LegalDocumentReader
      title="Terms & Conditions"
      loadDocument={loadTermsConditions}
      onBack={() => navigation.goBack()}
      retryLabel="Retry Terms & Conditions"
      draftNotice="No approved Terms & Conditions are available in this app. These proposed headings are an editorial outline, not binding contractual provisions."
      draftDetail="The effective date, fees, responsibilities, dispute rules and governing law require approved company content. Reading this preview does not record consent or change your acceptance status."
      showContents
      relatedDocument={{
        label: 'Privacy Policy',
        onPress: () => navigation.navigate('PrivacyPolicy'),
      }}
    />
  );
}
