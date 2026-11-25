import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { DrawerScreenProps } from '@react-navigation/drawer';
import Toast from 'react-native-toast-message';
import { DrawerParamList } from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { AppBadge } from '../../../components/ui/AppBadge';
import { colors } from '../../../theme';
import { useAuthStore } from '../../../store/authStore';
import {
  DealNotification,
  getNotifications,
  markNotificationRead,
  notificationError,
} from '../notificationsService';
import { useNotificationCounts } from '../useNotificationCounts';
export function NotificationsScreen({
  navigation,
}: DrawerScreenProps<DrawerParamList, 'Notifications'>) {
  const owner = useAuthStore(state =>
      state.status === 'authenticated' ? state.user : null,
    ),
    focused = useIsFocused(),
    client = useQueryClient();
  const counts = useNotificationCounts(focused);
  const active = useRef(focused);
  active.current = focused;
  const flight = useRef(false),
    alive = useRef(true);
  const [busy, setBusy] = useState<number>();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const query = useInfiniteQuery({
    queryKey: ['notifications', owner?.id, 'feed'],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => getNotifications(pageParam, signal),
    enabled: !!owner && focused,
    retry: false,
    refetchOnMount: 'always',
    refetchInterval: focused && owner ? 30000 : false,
    getNextPageParam: page =>
      page.pagination.current_page < page.pagination.last_page
        ? page.pagination.current_page + 1
        : undefined,
  });
  const seen = new Set<number>();
  const items =
    owner && !query.isError
      ? (query.data?.pages.flatMap(page => page.items) ?? []).filter(item => {
          if (!item.visible || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        })
      : [];
  const open = async (item: DealNotification) => {
    if (flight.current || !owner || !focused) return;
    flight.current = true;
    setBusy(item.id);
    const current = () =>
      alive.current &&
      active.current &&
      useAuthStore.getState().user === owner &&
      useAuthStore.getState().status === 'authenticated';
    try {
      await markNotificationRead(item.id);
      if (!current()) return;
      await client.cancelQueries({ queryKey: ['notifications', owner.id] });
      if (!current()) return;
      await client.invalidateQueries({ queryKey: ['notifications', owner.id] });
      if (current())
        navigation.navigate('DealDetails', { dealId: item.deal_id });
    } catch (error) {
      if (current())
        Toast.show({
          type: 'error',
          text1: 'Notification unavailable',
          text2: notificationError(error),
        });
    } finally {
      flight.current = false;
      if (alive.current) setBusy(undefined);
    }
  };
  return (
    <SafeScreen>
      <ScrollView contentContainerStyle={styles.content}>
        {!owner ? (
          <AppText>Sign in to view notifications.</AppText>
        ) : (
          <>
            <AppText variant="headingMD">Notifications</AppText>
            {counts.data && !counts.isError && (
              <AppText>
                {counts.data.unread_count} unread ?{' '}
                {counts.data.pending_task_count} pending tasks
              </AppText>
            )}
            {query.isPending && (
              <ActivityIndicator
                color={colors.primary}
                accessibilityLabel="Loading notifications"
              />
            )}
            {query.isError && (
              <AppText accessibilityRole="alert">
                {notificationError(query.error)}
              </AppText>
            )}
            <AppButton
              title="Refresh notifications"
              variant="secondary"
              disabled={query.isFetching || busy !== undefined}
              onPress={() => {
                Promise.all([query.refetch(), counts.refetch()]).then(
                  results => {
                    if (
                      results.some(result => result.isError) &&
                      useAuthStore.getState().user === owner
                    )
                      Toast.show({
                        type: 'error',
                        text1: 'Notifications unavailable',
                      });
                  },
                );
              }}
            />
            {!query.isPending && !query.isError && !items.length && (
              <AppText>No notifications.</AppText>
            )}
            {items.map(item => (
              <View key={item.id} style={styles.card}>
                <AppText variant="headingMD">
                  {item.event.replace(/_/g, ' ')}
                </AppText>
                <AppBadge
                  label={
                    item.is_pending_task
                      ? 'Pending task'
                      : item.is_read
                      ? 'Read'
                      : 'Unread'
                  }
                />
                <AppText>
                  {item.summary.parcel_title ?? 'Parcel details unavailable'}
                </AppText>
                <AppText>
                  {item.summary.weight_kg} KG ? {item.deal_status}
                </AppText>
                <AppText>
                  From:{' '}
                  {item.summary.route.from_country_name ??
                    'Country unavailable'}{' '}
                  / {item.summary.route.from_city_name ?? 'City unavailable'}
                </AppText>
                <AppText>
                  To:{' '}
                  {item.summary.route.to_country_name ?? 'Country unavailable'}{' '}
                  / {item.summary.route.to_city_name ?? 'City unavailable'}
                </AppText>
                <AppText>{item.created_at}</AppText>
                <AppButton
                  title={'View deal ' + item.deal_id}
                  loading={busy === item.id}
                  disabled={busy !== undefined}
                  onPress={() => {
                    open(item).catch(() => {});
                  }}
                />
              </View>
            ))}
            {query.hasNextPage && (
              <AppButton
                title="Load more notifications"
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
    padding: 16,
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
});
