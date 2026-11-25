import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { getListingReviews } from '../services/dealReviewsService';
export function ListingReviewsPanel({
  listingId,
  enabled,
}: {
  listingId: number;
  enabled: boolean;
}) {
  const query = useInfiniteQuery({
    queryKey: ['listingReviews', listingId],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      getListingReviews(listingId, pageParam, signal),
    enabled,
    retry: false,
    getNextPageParam: page =>
      page.pagination.current_page < page.pagination.last_page
        ? page.pagination.current_page + 1
        : undefined,
  });
  if (!enabled) return null;
  const summary = query.data?.pages[0];
  const seen = new Set<number>();
  const items = !query.isError
    ? (query.data?.pages.flatMap(page => page.items) ?? []).filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
    : [];
  return (
    <View>
      <AppText variant="headingMD">Verified reviews</AppText>
      {query.isPending && (
        <ActivityIndicator accessibilityLabel="Loading reviews" />
      )}
      {query.isError ? (
        <AppText accessibilityRole="alert">
          Reviews unavailable. Please refresh.
        </AppText>
      ) : (
        summary && (
          <AppText>
            Average rating: {summary.average_rating ?? 'Not rated'} / 5 ?{' '}
            {summary.review_count} reviews
          </AppText>
        )
      )}
      {!query.isPending && !query.isError && !items.length && (
        <AppText>No verified reviews yet.</AppText>
      )}
      {items.map(item => (
        <View key={item.id}>
          <AppText>{item.reviewer.display_name ?? 'Name unavailable'}</AppText>
          <AppText>Rating: {item.rating} / 5</AppText>
          <AppText>{item.review ?? 'Review text unavailable'}</AppText>
          <AppText>{item.date_time ?? ''}</AppText>
        </View>
      ))}
      <AppButton
        title="Refresh reviews"
        variant="secondary"
        disabled={query.isFetching}
        onPress={() => {
          query.refetch().then(result => {
            if (result.isError)
              Toast.show({ type: 'error', text1: 'Reviews unavailable' });
          });
        }}
      />
      {query.hasNextPage && (
        <AppButton
          title="Load more reviews"
          loading={query.isFetchingNextPage}
          disabled={query.isFetching}
          onPress={() => {
            query.fetchNextPage({ cancelRefetch: false }).catch(() => {});
          }}
        />
      )}
    </View>
  );
}
