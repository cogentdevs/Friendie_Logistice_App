import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { DrawerActions, ParamListBase, NavigationProp } from '@react-navigation/native';
import { Menu } from 'lucide-react-native';
import { colors } from '../../theme';
export function NavigationHeader({
  navigation
}: {
  navigation: NavigationProp<ParamListBase>;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Open menu" onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={styles.container}>
      <Menu color={colors.navy} />
    </Pressable>;
}
const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
