import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { colors } from '../../../theme';
import { ReviewsSummary } from '../types/reviews.types';
export function ReviewsRatingSummary({
  summary,
  loading = false,
}: {
  summary?: ReviewsSummary;
  loading?: boolean;
}) {
  if (loading)
    return (
      <View
        accessibilityLabel="Loading review summary"
        style={[styles.card, styles.skeleton]}
      />
    );
  const rating = summary?.averageRating,
    total = summary?.total;
  return (
    <View style={styles.card}>
      <AppText color={colors.navy} style={styles.title}>
        Received Reviews
      </AppText>
      <AppText color={colors.primary} style={styles.average}>
        {rating == null ? 'Rating unavailable' : rating.toFixed(1) + ' / 5'}
      </AppText>
      {rating != null && (
        <View
          accessible
          accessibilityLabel={'Average rating ' + rating + ' out of 5'}
          style={styles.stars}
        >
          {[1, 2, 3, 4, 5].map(value => (
            <Star
              accessible={false}
              key={value}
              size={20}
              color={colors.warning}
              fill={value <= Math.round(rating) ? colors.warning : colors.white}
            />
          ))}
        </View>
      )}
      <AppText>
        {total == null
          ? 'Total reviews unavailable'
          : total + ' received reviews'}
      </AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  skeleton: { minHeight: 140, backgroundColor: colors.lightGrey },
  card: {
    padding: 20,
    gap: 10,
    borderRadius: 18,
    backgroundColor: colors.softPink,
  },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  average: { fontSize: 24, lineHeight: 33, fontWeight: '800' },
  stars: { flexDirection: 'row', gap: 5 },
});
