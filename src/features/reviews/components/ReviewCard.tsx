import React, { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { AppAvatar } from '../../../components/ui/AppAvatar';
import { AppText } from '../../../components/ui/AppText';
import { colors } from '../../../theme';
import { Review, ReviewsTab } from '../types/reviews.types';
export const ReviewCard = memo(function ReviewCardContent({
  item,
  tab,
  onListing,
}: {
  item: Review;
  tab: ReviewsTab;
  onListing: (id: number) => void;
}) {
  const [failedUri, setFailedUri] = useState<string>();
  const name = item.person.name?.trim() || 'Name unavailable';
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppAvatar
          name={name}
          uri={
            failedUri === item.person.avatarUrl
              ? undefined
              : item.person.avatarUrl
          }
          size={46}
          onError={() => setFailedUri(item.person.avatarUrl)}
        />
        <View style={styles.identity}>
          <AppText variant="caption">
            {tab === 'visitors' ? 'Reviewer' : 'Reviewed member'}
          </AppText>
          <AppText color={colors.navy} style={styles.name}>
            {name}
          </AppText>
        </View>
      </View>
      <View
        accessible
        accessibilityLabel={'Rating ' + item.rating + ' out of 5'}
        style={styles.stars}
      >
        {[1, 2, 3, 4, 5].map(value => (
          <Star
            key={value}
            accessible={false}
            size={18}
            color={colors.warning}
            fill={value <= item.rating ? colors.warning : colors.white}
          />
        ))}
      </View>
      <AppText variant="caption">{item.date ?? 'Date unavailable'}</AppText>
      <AppText style={styles.comment}>
        {item.comment?.trim() || 'No written feedback.'}
      </AppText>
      {item.listing && (
        <View style={styles.listing}>
          <AppText color={colors.secondary} style={styles.comment}>
            {item.listing.title || 'Related listing'}
          </AppText>
          {item.listing.canOpen && (
            <Pressable
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel={'View listing ' + item.listing.id}
              style={styles.link}
              onPress={() => onListing(item.listing!.id)}
            >
              <AppText color={colors.primary}>View Listing</AppText>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
});
const styles = StyleSheet.create({
  card: {
    padding: 18,
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    shadowColor: colors.navy,
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  identity: { flex: 1, gap: 4 },
  name: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  stars: { flexDirection: 'row', gap: 4 },
  comment: { fontSize: 14, lineHeight: 23 },
  listing: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: 12,
    gap: 4,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 10,
  },
});
