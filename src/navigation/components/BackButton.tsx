import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { colors } from '../../theme';
export function BackButton({
  onPress
}: {
  onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onPress} style={styles.container}>
      <ArrowLeft color={colors.navy} />
    </Pressable>;
}
const styles = StyleSheet.create({
  container: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
