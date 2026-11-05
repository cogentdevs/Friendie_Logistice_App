import React from 'react';
import { Image, StyleSheet } from 'react-native';

// Original supplied brand assets; contain preserves their artwork proportions.
const logo = require('../../assets/logo.png');
const colorLogo = require('../../assets/logo1.png');
export function BrandLogo({
  width = 220,
  variant = 'color',
}: {
  width?: number;
  variant?: 'white' | 'color';
}) {
  const aspectRatio = variant === 'color' ? 749 / 333 : 132 / 49;
  return (
    <Image
      source={variant === 'color' ? colorLogo : logo}
      resizeMode="contain"
      accessibilityLabel="Friendie Logistics"
      accessibilityRole="image"
      accessibilityIgnoresInvertColors
      style={[styles.logo, { width, height: width / aspectRatio, aspectRatio }]}
    />
  );
}
const styles = StyleSheet.create({
  logo: { maxWidth: '100%', aspectRatio: 132 / 49 },
});
