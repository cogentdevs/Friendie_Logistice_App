import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { colors } from '../../../theme';
import { ReviewsTab } from '../types/reviews.types';
export function ReviewsTabBar({
  selected,
  onSelect,
}: {
  selected: ReviewsTab;
  onSelect: (tab: ReviewsTab) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.tabs}>
      {(
        [
          { id: 'visitors', label: 'Visitors Reviews' },
          { id: 'your', label: 'Your Reviews' },
        ] as const
      ).map(tab => (
        <Tab
          key={tab.id}
          label={tab.label}
          selected={selected === tab.id}
          onPress={() => onSelect(tab.id)}
        />
      ))}
    </View>
  );
}
function Tab({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const opacity = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    let active = true;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled())
      .then(reduced => {
        if (!active) return;
        if (reduced) opacity.setValue(selected ? 1 : 0);
        else
          Animated.timing(opacity, {
            toValue: selected ? 1 : 0,
            duration: 140,
            useNativeDriver: true,
          }).start();
      })
      .catch(() => {
        if (active) opacity.setValue(selected ? 1 : 0);
      });
    return () => {
      active = false;
      opacity.stopAnimation();
    };
  }, [opacity, selected]);
  return (
    <Pressable
      cssInterop={false}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.tab}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.selected, { opacity }]}
      />
      <AppText
        color={selected ? colors.white : colors.navy}
        style={styles.label}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    padding: 10,
    borderRadius: 12,
  },
  selected: { backgroundColor: colors.primary, borderRadius: 12 },
  label: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
});
