import { DealReviewPanel } from '../reviews/components/DealReviewPanel';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { DrawerScreenProps } from '@react-navigation/drawer';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { SafeScreen } from '../../components/layout/SafeScreen';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { AppBadge } from '../../components/ui/AppBadge';
import { colors } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { DrawerParamList } from '../../navigation/navigationTypes';
import {
  Deal,
  DealAction,
  actOnDeal,
  getDeal,
  getDeals,
  dealErrorMessage,
  refreshDealData,
  UncertainDealError,
} from './dealsService';
import { ApiError } from '../../types/api';
import { DealContactPanel } from './DealContactPanel';

export function DealCapacity({ deal }: { deal: Deal }) {
  return (
    <>
      {(['sender', 'carrier'] as const).map(side => (
        <View key={side} style={styles.row}>
          <AppText>{side === 'sender' ? 'Sender' : 'Carrier'}</AppText>
          {deal.capacity[side] ? (
            <>
              <AppBadge
                label={
                  deal.capacity[side].available ? 'Available' : 'Not Available'
                }
              />
              <AppText>{deal.capacity[side].remaining_kg} KG remaining</AppText>
            </>
          ) : (
            <AppText>Capacity unavailable</AppText>
          )}
        </View>
      ))}
    </>
  );
}
function RequestsScreen({
  navigation,
  outgoing,
}: {
  navigation: DrawerScreenProps<DrawerParamList>['navigation'];
  outgoing: boolean;
}) {
  const focused = useIsFocused();
  const user = useAuthStore(state =>
    state.status === 'authenticated' ? state.user : null,
  );
  const query = useInfiniteQuery({
    queryKey: ['deals', user?.id],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => getDeals(pageParam, signal),
    enabled: focused && !!user,
    retry: false,
    getNextPageParam: page =>
      page.pagination.current_page < page.pagination.last_page
        ? page.pagination.current_page + 1
        : undefined,
    refetchOnMount: 'always',
    refetchInterval: focused ? 30000 : false,
  });
  const seen = new Set<number>();
  const items = user
    ? (query.data?.pages.flatMap(page => page.items) ?? []).filter(deal => {
        if (seen.has(deal.id)) return false;
        seen.add(deal.id);
        return (deal.initiated_by === user.id) === outgoing;
      })
    : [];
  const retry = async () => {
    const result = await query.refetch();
    if (result.isError)
      Toast.show({
        type: 'error',
        text1: 'Requests unavailable',
        text2: dealErrorMessage(result.error),
      });
  };
  return (
    <SafeScreen>
      <ScrollView contentContainerStyle={styles.content}>
        {!user ? (
          <AppText>Sign in to view requests.</AppText>
        ) : (
          <>
            <AppButton
              title={outgoing ? 'Incoming Requests' : 'Outgoing Requests'}
              variant="secondary"
              onPress={() =>
                navigation.navigate(
                  outgoing ? 'IncomingRequests' : 'OutgoingRequests',
                )
              }
            />
            {query.isPending && (
              <ActivityIndicator
                accessibilityLabel="Loading requests"
                color={colors.primary}
              />
            )}
            {query.isError && (
              <AppText accessibilityRole="alert">
                {dealErrorMessage(query.error)}
              </AppText>
            )}
            <AppButton
              title="Refresh requests"
              variant="secondary"
              disabled={query.isFetching}
              onPress={() => {
                retry().catch(() => {});
              }}
            />
            {!query.isPending && !query.isError && !items.length && (
              <AppText>
                No {outgoing ? 'outgoing' : 'incoming'} requests in the loaded
                pages.
              </AppText>
            )}
            {items.map(deal => (
              <View key={deal.id} style={styles.card}>
                <AppText variant="headingMD">Request #{deal.id}</AppText>
                <AppBadge label={deal.status} />
                <AppText>{deal.agreed_kg} KG</AppText>
                <DealCapacity deal={deal} />
                {deal.acceptance_expires_at && (
                  <AppText>
                    Acceptance expires: {deal.acceptance_expires_at} UTC
                  </AppText>
                )}
                <AppButton
                  title={`View deal ${deal.id}`}
                  onPress={() =>
                    navigation.navigate('DealDetails', { dealId: deal.id })
                  }
                />
              </View>
            ))}
            {query.hasNextPage && (
              <AppButton
                title="Load more requests"
                loading={query.isFetchingNextPage}
                disabled={query.isFetching}
                onPress={() => {
                  query.fetchNextPage({ cancelRefetch: false }).catch(() => {});
                }}
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeScreen>
  );
}
export function IncomingRequestsScreen(
  props: DrawerScreenProps<DrawerParamList, 'IncomingRequests'>,
) {
  return <RequestsScreen navigation={props.navigation} outgoing={false} />;
}
export function OutgoingRequestsScreen(
  props: DrawerScreenProps<DrawerParamList, 'OutgoingRequests'>,
) {
  return <RequestsScreen navigation={props.navigation} outgoing />;
}
export function DealDetailsScreen({
  route,
}: DrawerScreenProps<DrawerParamList, 'DealDetails'>) {
  const user = useAuthStore(state =>
    state.status === 'authenticated' ? state.user : null,
  );
  // Remount the mutation controller for every account/deal; old responses cannot affect a new one.
  return (
    <DealDetailsContent
      key={`${user?.id ?? 'guest'}:${route.params.dealId}`}
      owner={user}
      dealId={route.params.dealId}
    />
  );
}
function DealDetailsContent({
  owner,
  dealId,
}: {
  owner: ReturnType<typeof useAuthStore.getState>['user'];
  dealId: number;
}) {
  const focused = useIsFocused(),
    client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const active = useRef(focused);
  active.current = focused;
  useEffect(
    () => () => {
      active.current = false;
    },
    [],
  );
  const query = useQuery({
    queryKey: ['deal', owner?.id, dealId],
    queryFn: ({ signal }) => getDeal(dealId, signal),
    enabled: focused && !!owner,
    retry: false,
    staleTime: 0,
    refetchInterval: focused ? 30000 : false,
  });
  const deal = owner && !query.isError ? query.data : undefined;
  const act = async (action: DealAction) => {
    if (flight.current || !deal || !focused) return;
    flight.current = true;
    setBusy(true);
    try {
      const updated = await actOnDeal(deal, action);
      if (useAuthStore.getState().user !== owner || !active.current) return;
      await refreshDealData(client, updated);
      if (useAuthStore.getState().user !== owner || !active.current) return;
      Toast.show({ type: 'success', text1: 'Request updated' });
    } catch (error) {
      if (
        useAuthStore.getState().user !== owner ||
        !active.current ||
        (error instanceof ApiError && error.kind === 'cancelled')
      )
        return;
      Toast.show({
        type: error instanceof UncertainDealError ? 'warning' : 'error',
        text1: 'Check request status',
        text2: dealErrorMessage(error),
      });
      await refreshDealData(client, deal);
      await query.refetch();
    } finally {
      flight.current = false;
      setBusy(false);
    }
  };
  return (
    <SafeScreen>
      <ScrollView contentContainerStyle={styles.content}>
        {!owner ? (
          <AppText>Sign in to view this deal.</AppText>
        ) : (
          <>
            {query.isPending && (
              <ActivityIndicator
                accessibilityLabel="Loading deal"
                color={colors.primary}
              />
            )}
            {query.isError && (
              <AppText accessibilityRole="alert">
                {dealErrorMessage(query.error)}
              </AppText>
            )}
            <AppButton
              title="Refresh deal"
              variant="secondary"
              disabled={query.isFetching || busy}
              onPress={() => {
                query.refetch().then(result => {
                  if (result.isError)
                    Toast.show({
                      type: 'error',
                      text1: 'Deal unavailable',
                      text2: dealErrorMessage(result.error),
                    });
                });
              }}
            />
            {deal && (
              <View style={styles.card}>
                <AppText variant="headingMD">Deal #{deal.id}</AppText>
                <AppBadge label={deal.status} />
                <AppText>Sender listing #{deal.sender_listing_id}</AppText>
                <AppText>Carrier listing #{deal.carrier_listing_id}</AppText>
                <AppText>Agreed: {deal.agreed_kg} KG</AppText>
                <DealCapacity deal={deal} />
                <DealReviewPanel
                  key={`review:${owner.id}:${deal.id}`}
                  deal={deal}
                  focused={focused}
                />
                <DealHistorySummary deal={deal} />
                <DealContactPanel
                  key={`${owner.id}:${deal.id}`}
                  deal={deal}
                  focused={focused}
                />
                {deal.acceptance_expires_at && (
                  <AppText>
                    Acceptance expires: {deal.acceptance_expires_at} UTC
                  </AppText>
                )}
                {deal.allowed_actions
                  .filter(action => action !== 'cancel' || !deal.picked_up_at)
                  .map(action => (
                    <AppButton
                      key={action}
                      title={
                        action === 'pickup'
                          ? 'Mark as Picked Up'
                          : action === 'complete'
                          ? 'Complete Delivery'
                          : action.charAt(0).toUpperCase() + action.slice(1)
                      }
                      disabled={busy || query.isFetching}
                      loading={busy}
                      onPress={() => {
                        act(action).catch(() => {});
                      }}
                    />
                  ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeScreen>
  );
}
export function DealHistorySummary({ deal }: { deal: Deal }) {
  return (
    <>
      {(['sender', 'carrier'] as const).map(side => {
        const snapshot = deal.history?.[side],
          route = snapshot?.listing.route;
        const location = (
          countryName: string | null | undefined,
          cityName: string | null | undefined,
          country: number | null | undefined,
          city: number | null | undefined,
        ) =>
          `${countryName?.trim() || `Country ${country ?? 'unavailable'}`} / ${
            cityName?.trim() || `City ${city ?? 'unavailable'}`
          }`;
        return (
          <View key={side} style={styles.row}>
            <AppText>
              {side === 'sender' ? 'Sender' : 'Carrier'}:{' '}
              {snapshot?.user.display_name ?? 'Name unavailable'} (#
              {side === 'sender' ? deal.sender_user_id : deal.carrier_user_id})
            </AppText>
            <AppText>
              {snapshot?.listing.title ?? 'Listing title unavailable'}
            </AppText>
            <AppText>
              Snapshot weight:{' '}
              {snapshot?.listing.weight_kg == null
                ? 'Unavailable'
                : `${snapshot.listing.weight_kg} KG`}
            </AppText>
            <AppText>
              From:{' '}
              {location(
                route?.from_country_name,
                route?.from_city_name,
                route?.from_country_id,
                route?.from_city_id,
              )}
            </AppText>
            <AppText>
              To:{' '}
              {location(
                route?.to_country_name,
                route?.to_city_name,
                route?.to_country_id,
                route?.to_city_id,
              )}
            </AppText>
          </View>
        );
      })}
      {(
        [
          'created_at',
          'accepted_at',
          'confirmed_at',
          'picked_up_at',
          'completed_at',
        ] as const
      ).map(field =>
        deal[field] ? (
          <AppText key={field}>
            {field.replace(/_/g, ' ')}: {deal[field]}
          </AppText>
        ) : null,
      )}
    </>
  );
}
export function DealHistoryScreen({
  navigation,
}: DrawerScreenProps<DrawerParamList, 'DealHistory'>) {
  const focused = useIsFocused();
  const owner = useAuthStore(state =>
    state.status === 'authenticated' ? state.user : null,
  );
  const [status, setStatus] = useState<'pending' | 'completed'>('pending');
  const query = useInfiniteQuery({
    queryKey: ['deals', owner?.id, 'history', status],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => getDeals(pageParam, signal, status),
    enabled: focused && !!owner,
    retry: false,
    getNextPageParam: page =>
      page.pagination.current_page < page.pagination.last_page
        ? page.pagination.current_page + 1
        : undefined,
    refetchOnMount: 'always',
    refetchInterval: focused ? 30000 : false,
  });
  const seen = new Set<number>();
  const items =
    owner && !query.isError
      ? (query.data?.pages.flatMap(page => page.items) ?? []).filter(deal => {
          if (seen.has(deal.id)) return false;
          seen.add(deal.id);
          return true;
        })
      : [];
  return (
    <SafeScreen>
      <ScrollView contentContainerStyle={styles.content}>
        {!owner ? (
          <AppText>Sign in to view history.</AppText>
        ) : (
          <>
            {(['pending', 'completed'] as const).map(tab => (
              <AppButton
                key={tab}
                title={tab === 'pending' ? 'Pending' : 'Completed'}
                variant={status === tab ? 'primary' : 'secondary'}
                onPress={() => setStatus(tab)}
              />
            ))}
            {query.isPending && (
              <ActivityIndicator
                accessibilityLabel="Loading history"
                color={colors.primary}
              />
            )}
            {query.isError && (
              <AppText accessibilityRole="alert">
                {dealErrorMessage(query.error)}
              </AppText>
            )}
            <AppButton
              title="Refresh history"
              variant="secondary"
              disabled={query.isFetching}
              onPress={() => {
                query.refetch().then(result => {
                  if (result.isError && useAuthStore.getState().user === owner)
                    Toast.show({
                      type: 'error',
                      text1: 'History unavailable',
                      text2: dealErrorMessage(result.error),
                    });
                });
              }}
            />
            {!query.isPending && !query.isError && !items.length && (
              <AppText>No {status} deliveries.</AppText>
            )}
            {items.map(deal => (
              <View key={deal.id} style={styles.card}>
                <AppText variant="headingMD">Deal #{deal.id}</AppText>
                <AppBadge label={deal.status} />
                <AppText>Agreed: {deal.agreed_kg} KG</AppText>
                <DealHistorySummary deal={deal} />
                <AppButton
                  title={`View deal ${deal.id}`}
                  onPress={() =>
                    navigation.navigate('DealDetails', { dealId: deal.id })
                  }
                />
              </View>
            ))}
            {query.hasNextPage && (
              <AppButton
                title="Load more history"
                loading={query.isFetchingNextPage}
                disabled={query.isFetching}
                onPress={() => {
                  query.fetchNextPage({ cancelRefetch: false }).catch(() => {});
                }}
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  row: { gap: 6 },
});
