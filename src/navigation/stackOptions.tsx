import React from 'react';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { colors, typography } from '../theme';
import { BackButton } from './components/BackButton';
export const stackOptions: NativeStackNavigationOptions = {
  headerTintColor: colors.navy,
  headerStyle: { backgroundColor: colors.white },
  headerTitleStyle: typography.headingMD,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.offWhite },
};
export const backOptions = (
  goBack: () => void,
): NativeStackNavigationOptions => ({
  headerLeft: () => <BackButton onPress={goBack} />,
});
