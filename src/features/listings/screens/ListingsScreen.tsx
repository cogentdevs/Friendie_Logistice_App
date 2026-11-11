import { requireAuth as requestAuthentication } from '../../auth/services/authFlowCoordinator';
import { isListingDemoMode } from '../development/demoListings';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { SlidersHorizontal } from 'lucide-react-native';
import {
  HomeStackParamList,
  ListingsStackParamList,
} from '../../../navigation/navigationTypes';
import { BackButton } from '../../../navigation/components/BackButton';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
import { useListings } from '../hooks/useListings';
import { Listing } from '../services/listingsService';
import { ListingCard } from '../components/ListingCard';
import { useListingBookmarks } from '../store/bookmarkStore';
import { useSearchStore } from '../../search/store/searchStore';
import { useLocationStore } from '../../location/store/locationStore';
import { useBrowseFiltersStore } from '../store/browseFiltersStore';
import { useAuthStore } from '../../../store/authStore';
import { locationLabel, displayRange } from '../../search/types/search';

type Navigation = { setOptions: (options: Record<string, unknown>) => void };
function Results({
  browse = false,
  navigation,
  onBack,
  onFilters,
  onDetails,
}: {
  browse?: boolean;
  navigation: Navigation;
  onBack: () => void;
  onFilters: () => void;
  onDetails: (id: number) => void;
}) {
  const focused = useIsFocused();
  const query = useListings(focused, browse);
  const searchFilters = useSearchStore(state => state.filters),
    searchLocation = useLocationStore(state => state.selection);
  const browseFilters = useBrowseFiltersStore(state => state.filters),
    browseLocation = useBrowseFiltersStore(state => state.location);
  const filters = browse ? browseFilters : searchFilters;
  const location = browse ? browseLocation : searchLocation;
  const owner = useAuthStore(state => state.user?.id);
  const bookmarks = useListingBookmarks();
  const loadBookmarks = bookmarks.load;
  const [saving, setSaving] = useState<number[]>([]),
    [saveError, setSaveError] = useState(''),
    [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    loadBookmarks().catch(() =>
      setSaveError('Could not read saved listings on this device.'),
    );
  }, [owner, loadBookmarks]);
  const items = useMemo(() => {
    const seen = new Set<number>();
    return (query.data?.pages ?? [])
      .flatMap(page => page.data)
      .filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
  }, [query.data]);
  const total = query.data?.pages[0]?.meta.total;
  useLayoutEffect(() => {
    navigation.setOptions({
      title: total !== undefined ? 'Listings (' + total + ')' : 'Listings',
      headerTitleAlign: 'center',
      headerLeft: () => <BackButton onPress={onBack} />,
      headerRight: () => (
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          accessibilityLabel="Filter listings"
          onPress={onFilters}
          style={styles.icon}
        >
          <SlidersHorizontal size={23} color={colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation, total, onBack, onFilters]);
  const save = useCallback(async (id: number) => {
    if (useAuthStore.getState().status !== 'authenticated') {
      requestAuthentication({
        type: 'SAVE_LISTING',
        params: { listingId: String(id) },
      });
      return;
    }
    setSaving(value => [...value, id]);
    setSaveError('');
    try {
      await useListingBookmarks.getState().toggle(id);
    } catch {
      setSaveError(
        'Could not save this listing on your device. Please try again.',
      );
    } finally {
      setSaving(value => value.filter(valueId => valueId !== id));
    }
  }, []);
  const chips: { key: string; label: string; remove: () => void }[] = [];
  const update = browse
    ? useBrowseFiltersStore.getState().setFilters
    : useSearchStore.getState().setFilters;
  if (filters.destinationCountry)
    chips.push({
      key: 'destinationCountry',
      label: filters.destinationCountry.name,
      remove: () => update({ destinationCountry: undefined }),
    });
  if (filters.weightKg !== undefined)
    chips.push({
      key: 'weight',
      label: filters.weightKg + ' kg',
      remove: () => update({ weightKg: undefined }),
    });
  if (filters.from || filters.to)
    chips.push({
      key: 'route',
      label:
        (filters.from ? locationLabel(filters.from) : 'Any origin') +
        ' \u2192 ' +
        (filters.to ? locationLabel(filters.to) : 'Any destination'),
      remove: () =>
        update({
          from: undefined,
          to: undefined,
          origin: undefined,
          destination: undefined,
        }),
    });
  if (filters.destination || filters.origin)
    chips.push({
      key: 'legacyRoute',
      label: [filters.origin, filters.destination]
        .filter(Boolean)
        .join(' \u2192 '),
      remove: () => update({ origin: undefined, destination: undefined }),
    });
  if (location.mode === 'radius')
    chips.push({
      key: 'radius',
      label:
        'Within ' +
        location.filter.radiusKm +
        ' km (' +
        (filters.radiusTarget === 'destination' ? 'To' : 'From') +
        ')',
      remove: () =>
        browse
          ? useBrowseFiltersStore.getState().setLocation({ mode: 'worldwide' })
          : useLocationStore.getState().useWorldwide(),
    });
  if (filters.type)
    chips.push({
      key: 'type',
      label: filters.type === 'carry' ? 'Carry Parcel' : 'Send Parcel',
      remove: () => update({ type: undefined }),
    });
  if (filters.dates)
    chips.push({
      key: 'dates',
      label: displayRange(filters.dates),
      remove: () => update({ dates: undefined }),
    });
  if (filters.verifiedOnly)
    chips.push({
      key: 'verified',
      label: 'Verified only',
      remove: () => update({ verifiedOnly: false }),
    });
  if (filters.availableNow)
    chips.push({
      key: 'available',
      label: 'Available now',
      remove: () => update({ availableNow: false }),
    });
  if (filters.query)
    chips.push({
      key: 'query',
      label: filters.query,
      remove: () => update({ query: undefined }),
    });
  if (filters.category)
    chips.push({
      key: 'category',
      label: filters.category,
      remove: () => update({ category: undefined }),
    });
  const renderItem = useCallback(
    ({ item }: { item: Listing }) => (
      <ListingCard
        item={item}
        saved={bookmarks.owner === owner && bookmarks.ids.includes(item.id)}
        saving={saving.includes(item.id)}
        onSave={save}
        onOpen={onDetails}
      />
    ),
    [bookmarks.owner, bookmarks.ids, owner, saving, save, onDetails],
  );
  const retry = () => {
    query.refetch().catch(() => {});
  };
  const key = JSON.stringify([filters, location]);
  return (
    <SafeScreen backgroundColor={colors.white}>
      {focused && <StatusBar barStyle="dark-content" />}
      <FlatList
        key={key}
        data={items}
        renderItem={renderItem}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        initialNumToRender={8}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          try {
            await query.refetch();
          } finally {
            setRefreshing(false);
          }
        }}
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (
            query.hasNextPage &&
            !query.isFetching &&
            !query.isFetchNextPageError
          )
            query.fetchNextPage().catch(() => {});
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            {chips.length > 0 && (
              <View style={styles.chips}>
                {chips.map(chip => (
                  <Pressable
                    key={chip.key}
                    cssInterop={false}
                    accessibilityRole="button"
                    accessibilityLabel={'Remove filter ' + chip.label}
                    onPress={chip.remove}
                    style={styles.chip}
                  >
                    <AppText color={colors.primaryDark} style={styles.chipText}>
                      {chip.label + ' \u00d7'}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            )}
            <AppText variant="caption">
              {isListingDemoMode()
                ? 'Development demo - sample listings and prices'
                : 'Saved listings are stored on this device.'}
            </AppText>
            {!!saveError && (
              <AppText accessibilityRole="alert" color={colors.danger}>
                {saveError}
              </AppText>
            )}
          </View>
        }
        ListEmptyComponent={
          query.isPending ? (
            <View
              accessibilityLabel="Loading listings"
              style={styles.skeletons}
            >
              {[1, 2, 3].map(id => (
                <View key={id} style={styles.skeleton}>
                  <View style={styles.skeletonAvatar} />
                  <View style={styles.skeletonLine} />
                  <View style={styles.skeletonLine} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <AppText
                accessibilityRole="header"
                color={colors.navy}
                variant="headingMD"
              >
                {query.isError
                  ? 'Unable to load listings'
                  : 'No listings found'}
              </AppText>
              <AppText accessibilityRole={query.isError ? 'alert' : undefined}>
                {query.isError
                  ? 'Listing search is unavailable. Check your connection or try again later.'
                  : 'Try a different route, date or radius.'}
              </AppText>
              <AppButton
                title={query.isError ? 'Retry listings' : 'Change filters'}
                onPress={query.isError ? retry : onFilters}
              />
            </View>
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator
              accessibilityLabel="Loading more listings"
              color={colors.primary}
            />
          ) : query.isError && items.length > 0 ? (
            <View style={styles.empty}>
              <AppText accessibilityRole="alert">
                {query.isFetchNextPageError
                  ? 'Could not load more listings.'
                  : 'Could not refresh listings. Previously loaded results are shown.'}
              </AppText>
              <AppButton
                title="Retry listings"
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
export function ListingsScreen({
  navigation,
}: NativeStackScreenProps<ListingsStackParamList, 'Listings'>) {
  const back = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.getParent()?.navigate('HomeStack');
  }, [navigation]);
  const filters = useCallback(
    () => navigation.navigate('Filters'),
    [navigation],
  );
  const details = useCallback(
    (id: number) =>
      navigation.navigate('ListingDetails', { listingId: String(id) }),
    [navigation],
  );
  return (
    <Results
      browse
      navigation={navigation}
      onBack={back}
      onFilters={filters}
      onDetails={details}
    />
  );
}
export function HomeResultsScreen({
  navigation,
}: NativeStackScreenProps<HomeStackParamList, 'Results'>) {
  const back = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('Search');
  }, [navigation]);
  const filters = useCallback(
    () => navigation.navigate('Filters'),
    [navigation],
  );
  const details = useCallback(
    (id: number) =>
      navigation.navigate('ListingDetails', { listingId: String(id) }),
    [navigation],
  );
  return (
    <Results
      navigation={navigation}
      onBack={back}
      onFilters={filters}
      onDetails={details}
    />
  );
}
const styles = StyleSheet.create({
  icon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 12,
    flexGrow: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  header: { gap: 8, paddingTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: colors.softPink,
    maxWidth: '100%',
  },
  chipText: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  empty: { paddingVertical: 32, gap: 16 },
  skeletons: { gap: 12 },
  skeleton: {
    height: 160,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  skeletonAvatar: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: colors.lightGrey,
  },
  skeletonLine: {
    height: 14,
    width: '75%',
    borderRadius: 7,
    backgroundColor: colors.lightGrey,
  },
});
