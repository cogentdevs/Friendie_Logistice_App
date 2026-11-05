import { isListingDemoMode } from '../../listings/development/demoListings';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  BackHandler,
  Keyboard,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  ArrowDownUp,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  History,
  MapPin,
  SlidersHorizontal,
} from 'lucide-react-native';
import {
  CompositeScreenProps,
  useFocusEffect,
  useIsFocused,
} from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HomeStackParamList,
  MainTabParamList,
} from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { AppText } from '../../../components/ui/AppText';
import { GradientButton } from '../../../components/ui/GradientButton';
import { RouteLocationPicker } from '../../location/components/RouteLocationPicker';
import { useLocationStore } from '../../location/store/locationStore';
import { LocationSelection } from '../../location/types/location';
import { getListings } from '../../listings/services/listingsService';
import { ApiError } from '../../../types/api';
import { colors, radius, spacing } from '../../../theme';
import { useSearchStore } from '../store/searchStore';
import { useRecentSearchStore } from '../store/recentSearchStore';
import {
  DateRange,
  RouteLocation,
  RouteSearch,
  displayRange,
  localDate,
  locationLabel,
  routeSearchSchema,
  sameLocation,
} from '../types/search';
import { SearchDatePicker } from '../components/SearchDatePicker';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'Search'>,
  BottomTabScreenProps<MainTabParamList, 'HomeStack'>
>;
export function SearchScreen({ navigation }: Props) {
  const focused = useIsFocused(),
    client = useQueryClient();
  const initial = useSearchStore(state => state.filters);
  const [type, setType] = useState<'send' | 'carry'>(initial.type ?? 'send');
  const [from, setFrom] = useState<RouteLocation | undefined>(initial.from);
  const [to, setTo] = useState<RouteLocation | undefined>(initial.to);
  const [dates, setDates] = useState<DateRange | undefined>(initial.dates);
  const [picker, setPicker] = useState<'from' | 'to' | 'dates' | null>(null);
  const [error, setError] = useState(''),
    [historyError, setHistoryError] = useState('');
  const [historyBusy, setHistoryBusy] = useState(false);
  const submitting = useRef(false);
  const [submittingBusy, setSubmittingBusy] = useState(false);
  const lastApplied = useRef(initial);
  const history = useRecentSearchStore(state => state.items),
    ready = useRecentSearchStore(state => state.ready);
  const search = useMutation({
    mutationFn: ({
      snapshot,
      location,
    }: {
      snapshot: RouteSearch;
      location: LocationSelection;
    }) =>
      client.fetchQuery({
        queryKey: ['searchListings', snapshot, location],
        retry: false,
        staleTime: 0,
        queryFn: ({ signal }) =>
          getListings(
            1,
            {
              query: snapshot.query,
              category: snapshot.category,
              verifiedOnly: snapshot.verifiedOnly,
              availableNow: snapshot.availableNow,
              radiusTarget: snapshot.radiusTarget,
              type: snapshot.type,
              from: snapshot.from,
              to: snapshot.to,
              dates: snapshot.dates,
            },
            location,
            signal,
          ),
      }),
  });
  const openFilters = useCallback(() => {
    Keyboard.dismiss();
    useSearchStore.getState().setFilters({ type, from, to, dates });
    navigation.navigate('Filters');
  }, [navigation, type, from, to, dates]);
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          accessibilityLabel="Open advanced filters"
          onPress={openFilters}
          style={styles.clear}
        >
          <SlidersHorizontal size={22} color={colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation, openFilters]);
  const { reset: resetSearch } = search;
  const clearFeedback = () => {
    setError('');
    resetSearch();
  };
  const loadHistory = useCallback(async () => {
    setHistoryError('');
    try {
      await useRecentSearchStore.getState().hydrate();
    } catch {
      setHistoryError('Could not load recent searches. Tap Retry.');
    }
  }, []);
  useEffect(() => {
    if (!useRecentSearchStore.getState().ready) loadHistory();
  }, [loadHistory]);
  useFocusEffect(
    useCallback(() => {
      const filters = useSearchStore.getState().filters;
      if (lastApplied.current !== filters) {
        lastApplied.current = filters;
        setType(filters.type ?? 'send');
        setFrom(filters.from);
        setTo(filters.to);
        setDates(filters.dates);
        setError('');
        resetSearch();
      }
    }, [resetSearch]),
  );
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          const state = navigation.getState();
          if (
            state.routes.some(route => route.name === 'Home') &&
            state.index > 0
          )
            return false;
          navigation.replace('Home');
          return true;
        },
      );
      return () => subscription.remove();
    }, [navigation]),
  );
  const restore = (snapshot: RouteSearch) => {
    Keyboard.dismiss();
    const value = routeSearchSchema.parse(snapshot);
    setType(value.type);
    setFrom(value.from);
    setTo(value.to);
    setDates(value.dates);
    clearFeedback();
    useSearchStore.getState().setFilters({
      type: value.type,
      from: value.from,
      to: value.to,
      dates: value.dates,
      query: value.query,
      category: value.category,
      verifiedOnly: value.verifiedOnly,
      availableNow: value.availableNow,
      radiusTarget: value.radiusTarget,
      origin: undefined,
      destination: undefined,
    });
  };
  const submit = async () => {
    if (submitting.current) return;
    Keyboard.dismiss();
    clearFeedback();
    if (!from || !to) {
      setError('Select both From and To locations.');
      return;
    }
    if (sameLocation(from, to)) {
      setError('Choose different From and To locations.');
      return;
    }
    if (dates && dates.start < localDate(new Date())) {
      setError('Choose today or a future date.');
      return;
    }
    const parsed = routeSearchSchema.safeParse({
      type,
      from,
      to,
      dates,
      query: initial.query,
      category: initial.category,
      verifiedOnly: initial.verifiedOnly,
      availableNow: initial.availableNow,
      radiusTarget: initial.radiusTarget,
    });
    if (!parsed.success) {
      setError('Check your route and date range.');
      return;
    }
    submitting.current = true;
    setSubmittingBusy(true);
    const snapshot = parsed.data;
    const location = useLocationStore.getState().selection;
    useSearchStore.getState().setFilters({
      type,
      from: snapshot.from,
      to: snapshot.to,
      dates: snapshot.dates,
      query: snapshot.query,
      category: snapshot.category,
      origin: undefined,
      destination: undefined,
    });
    const submittedFilters = useSearchStore.getState().filters;
    try {
      await useRecentSearchStore.getState().add(snapshot);
      setHistoryError('');
    } catch {
      setHistoryError(
        'Could not save this recent search. Device storage may be unavailable.',
      );
    }
    try {
      const firstPage = await search.mutateAsync({
        snapshot,
        location,
      });
      client.setQueryData(
        isListingDemoMode()
          ? ['listings', submittedFilters, location, 'demo']
          : ['listings', submittedFilters, location],
        {
          pages: [firstPage],
          pageParams: [1],
        },
      );
      navigation.navigate('Results');
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'Unable to search listings. Check your connection and try again.',
      );
      navigation.navigate('Results');
    } finally {
      submitting.current = false;
      setSubmittingBusy(false);
    }
  };
  const busy = submittingBusy || search.isPending;
  return (
    <SafeScreen
      edges={['left', 'right', 'bottom']}
      backgroundColor={colors.white}
    >
      {focused && <StatusBar barStyle="dark-content" />}
      <ScreenContainer backgroundColor={colors.white} style={styles.content}>
        <View accessibilityRole="tablist" style={styles.segments}>
          {(['send', 'carry'] as const).map(value => (
            <Pressable
              key={value}
              cssInterop={false}
              accessibilityRole="tab"
              accessibilityLabel={
                value === 'send' ? 'Send Parcel' : 'Carry Parcel'
              }
              accessibilityState={{ selected: type === value, disabled: busy }}
              disabled={busy}
              onPress={() => {
                setType(value);
                clearFeedback();
              }}
              style={styles.segment}
            >
              {type === value ? (
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.segmentFill}
                >
                  <AppText color={colors.white} style={styles.segmentText}>
                    {value === 'send' ? 'Send Parcel' : 'Carry Parcel'}
                  </AppText>
                </LinearGradient>
              ) : (
                <View style={styles.segmentFill}>
                  <AppText color={colors.navy} style={styles.segmentText}>
                    {value === 'send' ? 'Send Parcel' : 'Carry Parcel'}
                  </AppText>
                </View>
              )}
            </Pressable>
          ))}
        </View>
        <View style={styles.route}>
          {(
            [
              { key: 'from', title: 'From', value: from },
              { key: 'to', title: 'To', value: to },
            ] as const
          ).map(field => (
            <Pressable
              key={field.key}
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel={'Select ' + field.title + ' location'}
              accessibilityHint={
                field.value
                  ? locationLabel(field.value)
                  : 'Choose country, city and area'
              }
              disabled={busy}
              onPress={() => {
                Keyboard.dismiss();
                setPicker(field.key);
              }}
              style={({ pressed }) => [
                styles.field,
                styles.routeField,
                pressed && styles.pressed,
              ]}
            >
              <MapPin color={colors.primary} size={22} />
              <View style={styles.fieldCopy}>
                <AppText variant="caption">{field.title}</AppText>
                <AppText color={colors.navy} style={styles.locationText}>
                  {field.value
                    ? locationLabel(field.value)
                    : field.key === 'to' && initial.destination
                    ? initial.destination + ' - select city'
                    : 'Select location'}
                </AppText>
              </View>
            </Pressable>
          ))}
          <View pointerEvents="box-none" style={styles.swapArea}>
            <Pressable
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel="Swap From and To"
              disabled={busy}
              accessibilityState={{ disabled: busy }}
              onPress={() => {
                setFrom(to);
                setTo(from);
                clearFeedback();
              }}
              style={({ pressed }) => [styles.swap, pressed && styles.pressed]}
            >
              <ArrowDownUp size={22} color={colors.primary} />
            </Pressable>
          </View>
        </View>
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          accessibilityLabel="Choose travel or delivery dates"
          accessibilityHint={displayRange(dates)}
          disabled={busy}
          onPress={() => {
            Keyboard.dismiss();
            setPicker('dates');
          }}
          style={({ pressed }) => [styles.field, pressed && styles.pressed]}
        >
          <CalendarDays size={22} color={colors.primary} />
          <View style={styles.fieldCopy}>
            <AppText variant="caption">Travel / Delivery Date</AppText>
            <AppText style={styles.dateText}>
              {dates ? displayRange(dates) : 'Select date range'}
            </AppText>
          </View>
          <ChevronRight size={20} color={colors.navy} />
        </Pressable>
        {!!initial.query && !from && (
          <AppText variant="caption">
            Search: {initial.query}. Select a route to continue.
          </AppText>
        )}
        <View style={styles.searchAction}>
          {!!error && (
            <AppText
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              color={colors.danger}
            >
              {error}
            </AppText>
          )}
          <GradientButton
            title="Search Listings"
            icon="none"
            loading={busy}
            onPress={submit}
          />
        </View>
        <View style={styles.historyHeader}>
          <AppText
            accessibilityRole="header"
            color={colors.navy}
            style={styles.heading}
          >
            Recent Searches
          </AppText>
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel="Clear recent searches"
            accessibilityState={{
              disabled: !ready || !history.length || historyBusy || busy,
            }}
            disabled={!ready || !history.length || historyBusy || busy}
            style={styles.clear}
            onPress={() =>
              Alert.alert(
                'Clear recent searches?',
                'This removes the saved search history on this device.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                      setHistoryBusy(true);
                      try {
                        await useRecentSearchStore.getState().clear();
                        setHistoryError('');
                      } catch {
                        setHistoryError(
                          'Could not clear recent searches. Please try again.',
                        );
                      } finally {
                        setHistoryBusy(false);
                      }
                    },
                  },
                ],
              )
            }
          >
            <AppText
              color={
                !ready || !history.length ? colors.textMuted : colors.primary
              }
              style={styles.clearText}
            >
              {historyBusy ? 'Clearing...' : 'Clear'}
            </AppText>
          </Pressable>
        </View>
        {!!historyError && (
          <View>
            <AppText accessibilityRole="alert" color={colors.danger}>
              {historyError}
            </AppText>
            {!ready && (
              <Pressable
                cssInterop={false}
                accessibilityRole="button"
                accessibilityLabel="Retry recent searches"
                onPress={loadHistory}
                style={styles.clear}
              >
                <AppText color={colors.primary}>Retry</AppText>
              </Pressable>
            )}
          </View>
        )}
        {!ready && !historyError && (
          <AppText accessibilityLiveRegion="polite">
            Loading recent searches...
          </AppText>
        )}
        {ready && !history.length && (
          <AppText style={styles.empty}>
            Your recent searches will appear here.
          </AppText>
        )}
        {history.map((item, index) => (
          <Pressable
            key={JSON.stringify(item)}
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel={
              'Restore recent search ' +
              (index + 1) +
              ': ' +
              locationLabel(item.from) +
              ' to ' +
              locationLabel(item.to)
            }
            disabled={busy || historyBusy}
            onPress={() => restore(item)}
            style={({ pressed }) => [styles.recent, pressed && styles.pressed]}
          >
            <History size={22} color={colors.primary} />
            <View style={styles.fieldCopy}>
              <View style={styles.recentRoute}>
                <AppText color={colors.navy} style={styles.recentCity}>
                  {item.from.city.name}
                </AppText>
                <ArrowRight size={15} color={colors.primary} />
                <AppText color={colors.navy} style={styles.recentCity}>
                  {item.to.city.name}
                </AppText>
              </View>
              <AppText variant="caption">
                {item.type === 'send' ? 'Send Parcel' : 'Carry Parcel'} -{' '}
                {displayRange(item.dates)}
              </AppText>
              <AppText variant="caption">
                {item.from.country.code} to {item.to.country.code}
              </AppText>
            </View>
          </Pressable>
        ))}
      </ScreenContainer>
      {(picker === 'from' || picker === 'to') && (
        <RouteLocationPicker
          title={picker === 'from' ? 'From location' : 'To location'}
          value={picker === 'from' ? from : to}
          countryHint={picker === 'to' ? initial.destination : undefined}
          onClose={() => setPicker(null)}
          onSelect={value => {
            if (picker === 'from') setFrom(value);
            else setTo(value);
            clearFeedback();
            setPicker(null);
          }}
        />
      )}
      {picker === 'dates' && (
        <SearchDatePicker
          value={dates}
          onClose={() => setPicker(null)}
          onApply={value => {
            setDates(value);
            clearFeedback();
            setPicker(null);
          }}
        />
      )}
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  content: {
    maxWidth: 560,
    paddingHorizontal: 18,
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  segments: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: colors.offWhite,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: { flex: 1, minWidth: 0 },
  segmentFill: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  segmentText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  route: { gap: spacing.md },
  field: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingRight: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.offWhite,
  },
  routeField: { paddingRight: spacing.xxxl + spacing.lg },
  fieldCopy: { flex: 1, minWidth: 0, gap: 2 },
  locationText: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  dateText: { fontSize: 12, lineHeight: 18 },
  swapArea: {
    position: 'absolute',
    top: '50%',
    right: spacing.sm,
    marginTop: -24,
  },
  swap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  searchAction: { marginTop: spacing.sm, gap: spacing.md },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  heading: { fontSize: 16, lineHeight: 23, fontWeight: '700' },
  clear: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  clearText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  recent: {
    padding: spacing.md,
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.offWhite,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  recentRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  recentCity: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    flexShrink: 1,
  },
  empty: { fontSize: 14, lineHeight: 21 },
  pressed: { opacity: 0.65 },
});
