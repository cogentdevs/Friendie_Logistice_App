import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/navigationTypes';
import { ContactUsScreen } from './ContactUsScreen';
// Reuse the same form in the public root legal flow. onReturn prevents drawer navigation.
export function ContactSupportScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'ContactSupport'>) {
  return (
    <ContactUsScreen
      route={{ name: 'ContactUs', key: route.key }}
      navigation={
        navigation as unknown as React.ComponentProps<
          typeof ContactUsScreen
        >['navigation']
      }
      onReturn={() => navigation.goBack()}
    />
  );
}
