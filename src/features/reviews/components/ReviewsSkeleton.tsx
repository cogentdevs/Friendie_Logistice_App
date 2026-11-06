import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../../theme';
export function ReviewsSkeleton() {
  return (
    <View accessibilityLabel="Loading reviews" style={styles.group}>
      {[0, 1, 2].map(key => (
        <View key={key} style={styles.card}>
          <View style={styles.line} />
          <View style={styles.body} />
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  group: { gap: 14 },
  card: {
    padding: 18,
    gap: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  line: {
    width: '55%',
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.lightGrey,
  },
  body: { height: 72, borderRadius: 10, backgroundColor: colors.lightGrey },
});
