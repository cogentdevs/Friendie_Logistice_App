import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { DrawerParamList } from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
import { ApiError } from '../../../types/api';
import {
  useReviewScope,
  useVisitorReviews,
  useYourReviews,
  useReviewsSummary,
} from '../hooks/useReviews';
import { Review, ReviewsTab } from '../types/reviews.types';
import { ReviewsTabBar } from '../components/ReviewsTabBar';
import { ReviewCard } from '../components/ReviewCard';
import { ReviewsEmptyState } from '../components/ReviewsEmptyState';
import { ReviewsRatingSummary } from '../components/ReviewsRatingSummary';
import { ReviewsSkeleton } from '../components/ReviewsSkeleton';
export function MyReviewsScreen({
  navigation,
  route,
}: DrawerScreenProps<DrawerParamList, 'MyReviews'>) {
  const focused = useIsFocused(),
    { demo } = useReviewScope();
  const tab: ReviewsTab =
    route.params?.initialTab === 'your' ? 'your' : 'visitors';
  const received = useVisitorReviews(tab === 'visitors'),
    authored = useYourReviews(tab === 'your'),
    summary = useReviewsSummary(tab === 'visitors');
  const query = tab === 'visitors' ? received : authored;
  const denied =
    query.error instanceof ApiError &&
    ['unauthorized', 'forbidden'].includes(query.error.kind);
  const items = useMemo(() => {
    if (denied) return [];
    const seen = new Set<number>();
    return (query.data?.pages ?? [])
      .flatMap(page => page.items)
      .filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
  }, [query.data, denied]);
  const back = useCallback(
    () =>
      navigation.navigate(
        'MainTabs',
        route.params?.returnTo === 'Home'
          ? { screen: 'HomeStack', params: { screen: 'Home' } }
          : {
              screen: 'ProfileStack',
              params: {
                screen:
                  route.params?.returnTo === 'Dashboard'
                    ? 'ProfileDashboard'
                    : 'Profile',
              },
            },
      ),
    [navigation, route.params?.returnTo],
  );
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          back();
          return true;
        },
      );
      return () => subscription.remove();
    }, [back]),
  );
  const select = (value: ReviewsTab) => {
    navigation.setParams({ initialTab: value });
  };
  const refresh = () => {
    query.refetch({ cancelRefetch: false }).catch(() => {});
    if (tab === 'visitors')
      summary.refetch({ cancelRefetch: false }).catch(() => {});
  };
  const openListing = useCallback(
    (id: number) =>
      navigation.navigate('MainTabs', {
        screen: 'ListingsStack',
        params: {
          screen: 'ListingDetails',
          params: { listingId: String(id), returnTo: 'MyReviews' },
        },
      }),
    [navigation],
  );
  const renderItem = useCallback(
    ({ item }: { item: Review }) => (
      <ReviewCard item={item} tab={tab} onListing={openListing} />
    ),
    [tab, openListing],
  );
  return (
    <SafeScreen
      edges={['top', 'bottom', 'left', 'right']}
      backgroundColor={colors.white}
    >
      {focused && <StatusBar barStyle="dark-content" />}
      <View style={styles.header}>
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          accessibilityLabel="Back from My Reviews"
          style={styles.back}
          onPress={back}
        >
          <ArrowLeft size={24} color={colors.navy} />
        </Pressable>
        <AppText
          accessibilityRole="header"
          color={colors.navy}
          style={styles.title}
        >
          My Reviews
        </AppText>
      </View>
      <View style={styles.tabs}>
        <ReviewsTabBar selected={tab} onSelect={select} />
      </View>
      <FlatList
        key={tab}
        data={items}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={refresh}
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (
            query.hasNextPage &&
            !query.isFetching &&
            !query.isFetchNextPageError
          )
            query.fetchNextPage({ cancelRefetch: false }).catch(() => {});
        }}
        ListHeaderComponent={
          <View style={styles.group}>
            {demo && (
              <AppText variant="caption" color={colors.primary}>
                UI preview - empty review datasets, not live account data.
              </AppText>
            )}
            {tab === 'visitors' && (
              <>
                <ReviewsRatingSummary
                  loading={summary.isPending}
                  summary={summary.isError ? undefined : summary.data}
                />
                {summary.isError && (
                  <AppButton
                    title="Retry review summary"
                    variant="secondary"
                    onPress={() => {
                      summary.refetch({ cancelRefetch: false }).catch(() => {});
                    }}
                  />
                )}
              </>
            )}
          </View>
        }
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          query.isPending ? (
            <ReviewsSkeleton />
          ) : query.isError ? (
            <View style={styles.feedback}>
              <AppText accessibilityRole="alert" color={colors.navy}>
                {denied
                  ? 'Sign in or check your access to these reviews.'
                  : 'Unable to load reviews'}
              </AppText>
              <AppText>
                {query.error instanceof ApiError
                  ? query.error.message
                  : 'Check your connection and try again.'}
              </AppText>
              <AppButton
                title="Retry reviews"
                onPress={() => {
                  query.refetch({ cancelRefetch: false }).catch(() => {});
                }}
              />
            </View>
          ) : (
            <ReviewsEmptyState tab={tab} />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator
              accessibilityLabel="Loading more reviews"
              color={colors.primary}
            />
          ) : query.isFetchNextPageError ? (
            <View style={styles.feedback}>
              <AppText accessibilityRole="alert">
                More reviews could not be loaded.
              </AppText>
              <AppButton
                title="Retry more reviews"
                onPress={() => {
                  query.fetchNextPage({ cancelRefetch: false }).catch(() => {});
                }}
              />
            </View>
          ) : query.isRefetchError && items.length > 0 ? (
            <View style={styles.feedback}>
              <AppText accessibilityRole="alert">
                Could not refresh reviews. Showing previously loaded records.
              </AppText>
              <AppButton title="Retry reviews" onPress={refresh} />
            </View>
          ) : undefined
        }
      />
    </SafeScreen>
  );
}
function Separator() {
  return <View style={styles.separator} />;
}
const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  back: {
    position: 'absolute',
    left: 10,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabs: { padding: 18, width: '100%', maxWidth: 680, alignSelf: 'center' },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 28,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  group: { gap: 12, marginBottom: 16 },
  feedback: { paddingVertical: 24, gap: 14 },
  separator: { height: 14 },
});
