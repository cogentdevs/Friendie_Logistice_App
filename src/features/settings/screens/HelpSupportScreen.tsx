import React from 'react';
import { StyleSheet, View } from 'react-native';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { DrawerParamList } from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
export function HelpSupportScreen({
  navigation,
}: DrawerScreenProps<DrawerParamList, 'HelpSupport'>) {
  return (
    <SafeScreen backgroundColor={colors.white}>
      <View style={styles.content}>
        <AppText color={colors.navy}>
          Have a question or need assistance?
        </AppText>
        <AppButton
          title="Contact Us"
          onPress={() => navigation.navigate('ContactUs')}
        />
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({ content: { padding: 20, gap: 16 } });
