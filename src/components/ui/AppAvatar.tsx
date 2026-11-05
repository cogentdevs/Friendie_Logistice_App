import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { colors } from '../../theme';
import { AppText } from './AppText';
export function AppAvatar({
  name,
  uri,
  size = 48,
}: {
  name: string;
  uri?: string;
  size?: number;
}) {
  const style = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };
  return uri ? (
    <Image
      accessibilityLabel={name + ' avatar'}
      source={{
        uri,
      }}
      style={style}
    />
  ) : (
    <View
      accessibilityLabel={name + ' avatar'}
      style={[style, styles.container]}
    >
      <AppText variant="headingMD" color={colors.primary}>
        {name
          .trim()
          .split(/\s+/)
          .map(part => part[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()}
      </AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.softPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
