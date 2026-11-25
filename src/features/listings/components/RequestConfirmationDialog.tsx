import { AvailabilityFields, availabilityRequestReason } from '../services/listingAvailability';
import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../../store/authStore';
import { ApiError } from '../../../types/api';
import {
  createDeal,
  dealErrorMessage,
  requestCandidates,
  verifyCandidate,
  refreshDealData,
  UncertainDealError,
  Deal,
} from '../../deals/dealsService';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
export function RequestConfirmationDialog({
  visible,
  onCancel,
  target,
  onCreated,
}: {
  visible: boolean;
  onCancel: () => void;
  target?: object;
  onCreated?: (deal: Deal) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.overlay}>
        <View pointerEvents="none" style={styles.backdrop} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View accessibilityViewIsModal style={styles.card}>
            <AppText
              accessibilityRole="header"
              variant="headingMD"
              color={colors.navy}
            >
              Send Request?
            </AppText>
            {visible && target ? (
              <RequestForm target={target} onCreated={onCreated} />
            ) : (
              <AppText>Select a real available listing to request.</AppText>
            )}
            <AppButton
              title="Cancel request"
              variant="secondary"
              onPress={onCancel}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
function RequestForm({
  target,
  onCreated,
}: {
  target: object;
  onCreated?: (deal: Deal) => void;
}) {
  const owner = useAuthStore(state =>
    state.status === 'authenticated' ? state.user : null,
  );
  const targetReason = availabilityRequestReason(target as AvailabilityFields, owner?.id);
  const targetBlocked = !owner || !!targetReason;
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState<object>(),
    [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState(false);
  const flight = useRef(false),
    controller = useRef(new AbortController()),
    selection = useRef(0);
  const client = useQueryClient();
  useEffect(() => {
    const abort = controller.current;
    return () => {
      abort.abort();
    };
  }, []);
  const query = useQuery({
    queryKey: ['dealCandidates', owner?.id, target, page],
    queryFn: ({ signal }) => requestCandidates(target, page, signal),
    enabled: !!owner,
    retry: false,
    structuralSharing: false,
  });
  const choose = async (value: number) => {
    const generation = ++selection.current;
    setSelected(undefined);
    setBusy(true);
    try {
      const result = await verifyCandidate(
        target,
        value,
        controller.current.signal,
      );
      if (
        !controller.current.signal.aborted &&
        generation === selection.current &&
        useAuthStore.getState().user === owner
      )
        setSelected(result);
    } catch (error) {
      if (
        !controller.current.signal.aborted &&
        useAuthStore.getState().user === owner
      )
        Toast.show({
          type: 'error',
          text1: 'Listing unavailable',
          text2: dealErrorMessage(error),
        });
    } finally {
      if (
        !controller.current.signal.aborted &&
        generation === selection.current
      )
        setBusy(false);
    }
  };
  const send = async () => {
    if (flight.current || !selected || blocked || busy || targetBlocked) return;
    flight.current = true;
    setBusy(true);
    try {
      const deal = await createDeal(
        target,
        selected,
        controller.current.signal,
      );
      if (
        controller.current.signal.aborted ||
        useAuthStore.getState().user !== owner
      )
        return;
      await refreshDealData(client, deal);
      if (
        !controller.current.signal.aborted &&
        useAuthStore.getState().user === owner
      )
        onCreated?.(deal);
    } catch (error) {
      if (
        controller.current.signal.aborted ||
        useAuthStore.getState().user !== owner ||
        (error instanceof ApiError && error.kind === 'cancelled')
      )
        return;
      await refreshDealData(client);
      if (error instanceof UncertainDealError) setBlocked(true);
      Toast.show({
        type: error instanceof UncertainDealError ? 'warning' : 'error',
        text1: 'Request not confirmed',
        text2: dealErrorMessage(error),
      });
    } finally {
      flight.current = false;
      if (!controller.current.signal.aborted) setBusy(false);
    }
  };
  return (
    <>
      <AppText>
        Select your complementary listing on the same route. The backend checks
        current capacity when you submit.
      </AppText>
      {query.isPending && <AppText>Loading your listings...</AppText>}
      {query.isError && (
        <>
          <AppText accessibilityRole="alert">
            {dealErrorMessage(query.error)}
          </AppText>
          <AppButton
            title="Retry listings"
            variant="secondary"
            onPress={() => {
              query.refetch().catch(() => {});
            }}
          />
        </>
      )}
      {query.data?.items.map(item => (
        <AppButton
          key={item.id}
          title={`${item.title || `Listing #${item.id}`} (${item.weight} KG)`}
          variant="secondary"
          disabled={busy || blocked}
          onPress={() => {
            choose(item.id).catch(() => {});
          }}
        />
      ))}
      {query.data && !query.data.items.length && (
        <AppText>
          No matching listings on this page. Create a complementary listing on
          the same route if needed.
        </AppText>
      )}
      {page > 1 && (
        <AppButton
          title="Previous listings"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setSelected(undefined);
            setPage(page - 1);
          }}
        />
      )}
      {query.data && page < query.data.pagination.last_page && (
        <AppButton
          title="More listings"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setSelected(undefined);
            setPage(page + 1);
          }}
        />
      )}
      {selected && <AppText>Listing verified and selected.</AppText>}
      {!!targetReason && <AppText accessibilityRole="alert">{targetReason}</AppText>}
      {blocked && (
        <AppText accessibilityRole="alert">
          Submission uncertain. Check Outgoing Requests. Do not resend.
        </AppText>
      )}
      <AppButton
        title="Send Request"
        disabled={!selected || busy || blocked || targetBlocked}
        loading={busy}
        onPress={() => {
          send().catch(() => {});
        }}
      />
    </>
  );
}
const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center' },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.secondary,
    opacity: 0.5,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: 20,
    padding: 22,
    backgroundColor: colors.white,
    gap: 16,
  },
});
