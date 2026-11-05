import { ApiError } from '../../../types/api';
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { DrawerParamList } from '../../../navigation/navigationTypes';
import { BackButton } from '../../../navigation/components/BackButton';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
import { useMyListings } from '../hooks/useMyListings';
import { MyListing, MyListingStatus } from '../services/myListingsService';
import { MyListingCard } from '../components/MyListingCard';
export function MyListingsScreen({
  navigation,
}: DrawerScreenProps<DrawerParamList, 'MyListings'>) {
  const focused = useIsFocused(),
    { query, status, demo, select } = useMyListings();
  const [refreshing, setRefreshing] = useState(false);
  const back = useCallback(
    () =>
      navigation.navigate('MainTabs', {
        screen: 'HomeStack',
        params: { screen: 'Home' },
      }),
    [navigation],
  );
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'My Listings',
      headerTitleAlign: 'center',
      headerLeft: () => <BackButton onPress={back} />,
    });
  }, [navigation, back]);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        back();
        return true;
      });
      return () => sub.remove();
    }, [back]),
  );
  const denied =
    query.error instanceof ApiError &&
    ['unauthorized', 'forbidden'].includes(query.error.kind);
  const items = useMemo(() => {
    if (denied) return [];
    const seen = new Set<number>();
    return (query.data?.pages ?? [])
      .flatMap(page => page.data)
      .filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
  }, [query.data, denied]);
  const meta = denied ? undefined : query.data?.pages[0]?.meta;
  const open = useCallback(
    (id: number) =>
      navigation.navigate('MainTabs', {
        screen: 'ListingsStack',
        params: {
          screen: 'ListingDetails',
          params: { listingId: String(id), returnTo: 'MyListings' },
        },
      }),
    [navigation],
  );
  const renderItem = useCallback(
    ({ item }: { item: MyListing }) => (
      <MyListingCard item={item} onOpen={open} />
    ),
    [open],
  );
  const retry = () => {
    query.refetch().catch(() => {});
  };
  const header = (
    <View style={styles.header}>
      {demo && (
        <AppText color={colors.primary} variant="caption">
          UI demo - your sample listings
        </AppText>
      )}
      <View style={styles.segments} accessibilityRole="tablist">
        {(['active', 'completed', 'expired'] as MyListingStatus[]).map(
          value => {
            const count =
                meta?.counts?.[value] ??
                (value === status ? meta?.total : undefined),
              selected = value === status,
              label = value.charAt(0).toUpperCase() + value.slice(1);
            return (
              <Pressable
                key={value}
                cssInterop={false}
                accessibilityRole="tab"
                accessibilityLabel={label + ' listings'}
                accessibilityState={{ selected }}
                onPress={() => select(value)}
                style={styles.segment}
              >
                {selected && (
                  <LinearGradient
                    colors={[colors.primary, colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <AppText
                  color={selected ? colors.white : colors.navy}
                  style={styles.segmentText}
                >
                  {label + (count !== undefined ? ' (' + count + ')' : '')}
                </AppText>
              </Pressable>
            );
          },
        )}
      </View>
    </View>
  );
  return (
    <SafeScreen backgroundColor={colors.white}>
      {focused && <StatusBar barStyle="dark-content" />}
      <FlatList
        key={status}
        data={items}
        renderItem={renderItem}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        initialNumToRender={8}
        windowSize={7}
        ListHeaderComponent={header}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          try {
            await query.refetch();
          } finally {
            setRefreshing(false);
          }
        }}
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (
            query.hasNextPage &&
            !query.isFetching &&
            !query.isFetchNextPageError
          )
            query.fetchNextPage().catch(() => {});
        }}
        ListEmptyComponent={
          query.isPending ? (
            <View
              accessibilityLabel="Loading my listings"
              style={styles.skeletons}
            >
              {[1, 2, 3].map(value => (
                <View key={value} style={styles.skeleton}>
                  <View style={styles.line} />
                  <View style={styles.line} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.state}>
              <AppText color={colors.navy} variant="headingMD">
                {query.isError
                  ? 'Unable to load your listings'
                  : 'No ' + status + ' listings'}
              </AppText>
              <AppText accessibilityRole={query.isError ? 'alert' : undefined}>
                {query.isError
                  ? 'Your listings are unavailable. Check your connection or try again later.'
                  : 'Your ' + status + ' listings will appear here.'}
              </AppText>
              {query.isError && (
                <AppButton title="Retry my listings" onPress={retry} />
              )}
            </View>
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator
              accessibilityLabel="Loading more own listings"
              color={colors.primary}
            />
          ) : query.isError && items.length > 0 ? (
            <View style={styles.state}>
              <AppText accessibilityRole="alert">
                {query.isFetchNextPageError
                  ? 'Could not load more listings.'
                  : 'Could not refresh. Previously loaded listings are shown.'}
              </AppText>
              <AppButton
                title="Retry my listings"
                onPress={() => {
                  if (query.isFetchNextPageError)
                    query.fetchNextPage().catch(() => {});
                  else retry();
                }}
              />
            </View>
          ) : undefined
        }
      />
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 14,
    flexGrow: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  header: { paddingTop: 14, paddingBottom: 4, gap: 10 },
  segments: {
    flexDirection: 'row',
    padding: 3,
    gap: 3,
    borderRadius: 13,
    backgroundColor: colors.offWhite,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 9,
    borderRadius: 10,
    overflow: 'hidden',
  },
  segmentText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  state: { paddingVertical: 30, gap: 16 },
  skeletons: { gap: 14 },
  skeleton: {
    height: 120,
    padding: 16,
    gap: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  line: {
    height: 15,
    width: '70%',
    borderRadius: 8,
    backgroundColor: colors.lightGrey,
  },
});
