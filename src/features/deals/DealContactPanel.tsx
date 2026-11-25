import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { useAuthStore } from '../../store/authStore';
import { navigationRef } from '../../navigation/navigationRef';
import { InitialMessageDialog } from '../listings/components/InitialMessageDialog';
import { LocationPinActions } from '../post-listing/components/LocationPinActions';
import { formatManualListingPin } from '../post-listing/types/manualListingPin';
import { useInitialConversation } from '../messages/hooks/useInitialConversation';
import { requireAuth } from '../auth/services/authFlowCoordinator';
import { dealErrorMessage, Deal, getDeals } from './dealsService';
import { useDealContact } from './useDealContact';

export function DealContactPanel({
  deal,
  focused,
}: {
  deal: Deal;
  focused: boolean;
}) {
  const access = useDealContact(deal.id, focused);
  // A local status may withhold access, but only the private API can grant it.
  const contact = ['accepted', 'confirmed'].includes(deal.status)
    ? access.contact
    : undefined;
  const clearContact = access.clear;
  useEffect(() => {
    if (!['accepted', 'confirmed'].includes(deal.status)) clearContact();
  }, [deal.status, clearContact]);
  const initial = useInitialConversation(
    { id: deal.carrier_listing_id },
    focused,
    'ListingsStack',
    deal.id,
  );
  const pin = (side: 'from' | 'to') => {
    const latitude = contact?.listing[`${side}_latitude`],
      longitude = contact?.listing[`${side}_longitude`];
    return typeof latitude === 'number' && typeof longitude === 'number'
      ? formatManualListingPin({ latitude, longitude })
      : '';
  };
  const from = pin('from'),
    to = pin('to');
  return (
    <View style={styles.panel}>
      <AppButton
        title="View authorized contact"
        variant="secondary"
        loading={access.loading}
        disabled={
          access.loading || !['accepted', 'confirmed'].includes(deal.status)
        }
        onPress={() => {
          access.load().catch(() => {});
        }}
      />
      {!['accepted', 'confirmed'].includes(deal.status) && (
        <AppText>
          Contact and messaging are unavailable for this deal state. Existing
          conversation history remains read-only.
        </AppText>
      )}
      {!!access.error && (
        <AppText accessibilityRole="alert">
          Contact and messaging access is unavailable or expired. Refresh the
          deal to check access.
        </AppText>
      )}
      {contact && (
        <>
          <AppText selectable>
            Phone: {contact.counterpart.phone?.trim() || 'Not provided'}
          </AppText>
          {!!from && (
            <>
              {' '}
              <AppText
                selectable
                accessibilityLabel="Counterpart From Location Pin"
              >
                From Location Pin: {from}
              </AppText>
              <LocationPinActions
                text={from}
                label="From Location Pin"
                isAuthorized={access.isAuthorized}
              />
            </>
          )}
          {!!to && (
            <>
              {' '}
              <AppText
                selectable
                accessibilityLabel="Counterpart To Location Pin"
              >
                To Location Pin: {to}
              </AppText>
              <LocationPinActions
                text={to}
                label="To Location Pin"
                isAuthorized={access.isAuthorized}
              />
            </>
          )}
          <AppButton title="Message deal participant" onPress={initial.open} />
        </>
      )}
      {deal.conversation_id != null && (
        <AppButton
          title="View conversation history"
          variant="secondary"
          onPress={() => {
            if (navigationRef.isReady())
              navigationRef.navigate('AppDrawer', {
                screen: 'MainTabs',
                params: {
                  screen: 'MessagesStack',
                  params: {
                    screen: 'Chat',
                    params: {
                      conversationId: String(deal.conversation_id),
                      returnToDeal: deal.id,
                    },
                  },
                },
              });
          }}
        />
      )}
      <InitialMessageDialog
        visible={initial.visible && !!contact}
        draft={initial.draft}
        busy={initial.busy}
        blocked={initial.blocked}
        onChange={initial.setDraft}
        onSend={initial.send}
        onCancel={initial.close}
      />
    </View>
  );
}

// Lists only participant-scoped backend deals; choosing a row never grants contact.
export function ListingDealActions({
  listingId,
  focused,
  openRequested = false,
}: {
  listingId: number;
  focused: boolean;
  openRequested?: boolean;
}) {
  const user = useAuthStore(state =>
    state.status === 'authenticated' ? state.user : null,
  );
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (openRequested && focused && user) setOpen(true);
  }, [openRequested, focused, user]);
  const query = useInfiniteQuery({
    queryKey: ['deals', user?.id, 'listing', listingId],
    enabled: open && focused && !!user,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => getDeals(pageParam, signal),
    retry: false,
    staleTime: 0,
    getNextPageParam: page =>
      page.pagination.current_page < page.pagination.last_page
        ? page.pagination.current_page + 1
        : undefined,
  });
  const seen = new Set<number>();
  const deals =
    user && open
      ? (query.data?.pages.flatMap(page => page.items) ?? []).filter(deal => {
          if (seen.has(deal.id)) return false;
          seen.add(deal.id);
          return (
            deal.sender_listing_id === listingId ||
            deal.carrier_listing_id === listingId
          );
        })
      : [];
  return (
    <View style={styles.panel}>
      <AppButton
        title="Contact & chat for this listing"
        variant="secondary"
        onPress={() => {
          if (!user) {
            requireAuth({
              type: 'START_CONVERSATION',
              params: { listingId: String(listingId) },
            });
            return;
          }
          setOpen(true);
        }}
      />
      {open && user && (
        <>
          {query.isPending && <AppText>Loading your deals...</AppText>}
          {query.isError && (
            <>
              <AppText>{dealErrorMessage(query.error)}</AppText>
              <AppButton
                title="Retry deals"
                onPress={() => {
                  query.refetch().then(result => {
                    if (result.isError)
                      Toast.show({
                        type: 'error',
                        text1: 'Deals unavailable',
                        text2: dealErrorMessage(result.error),
                      });
                  });
                }}
              />
            </>
          )}
          {!query.isPending && !query.isError && !deals.length && (
            <AppText>
              No related deals in the loaded pages. Contact and messaging
              require an authorized accepted or confirmed deal.
            </AppText>
          )}
          {deals.map(deal => (
            <AppButton
              key={deal.id}
              title={`Open deal ${deal.id} (${deal.status})`}
              onPress={() => {
                if (navigationRef.isReady())
                  navigationRef.navigate('AppDrawer', {
                    screen: 'DealDetails',
                    params: { dealId: deal.id },
                  });
              }}
            />
          ))}
          {query.hasNextPage && (
            <AppButton
              title="More related deals"
              disabled={query.isFetching}
              onPress={() => {
                query.fetchNextPage({ cancelRefetch: false }).catch(() => {});
              }}
            />
          )}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({ panel: { gap: 12 } });
