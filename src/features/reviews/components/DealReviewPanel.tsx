import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { AppButton } from '../../../components/ui/AppButton';
import { AppText } from '../../../components/ui/AppText';
import { useAuthStore } from '../../../store/authStore';
import { ApiError } from '../../../types/api';
import { Deal } from '../../deals/dealsService';
import { SubmitReviewDialog } from './SubmitReviewDialog';
import {
  dealReviewState,
  submitDealReview,
} from '../services/dealReviewsService';
import { ReviewDraft } from '../services/submitReviewService';
import { reviewKeys } from '../hooks/useReviews';
export function DealReviewPanel({
  deal,
  focused,
}: {
  deal: Deal;
  focused: boolean;
}) {
  const owner = useAuthStore(state =>
      state.status === 'authenticated' ? state.user : null,
    ),
    client = useQueryClient();
  const [draft, setDraft] = useState<ReviewDraft>({ rating: null, review: '' }),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false);
  const flight = useRef(false),
    active = useRef(focused);
  active.current = focused;
  useEffect(
    () => () => {
      active.current = false;
    },
    [],
  );
  if (
    !owner ||
    deal.status !== 'completed' ||
    ![deal.sender_user_id, deal.carrier_user_id].includes(owner.id)
  )
    return null;
  const state = dealReviewState(deal.id);
  const blocked = !!state && !busy;
  const submit = async () => {
    if (
      flight.current ||
      !active.current ||
      blocked ||
      useAuthStore.getState().user !== owner
    )
      return;
    flight.current = true;
    setBusy(true);
    const snapshot = { ...draft };
    const current = () =>
      active.current &&
      useAuthStore.getState().user === owner &&
      useAuthStore.getState().status === 'authenticated';
    try {
      await submitDealReview(deal.id, snapshot);
      if (!current()) return;
      setVisible(false);
      setDraft({ rating: null, review: '' });
      const predicates = (query: { queryKey: readonly unknown[] }) =>
        query.queryKey[0] === 'listingReviews' ||
        (query.queryKey[0] === reviewKeys.authored('user:' + owner.id)[0] &&
          query.queryKey[1] === 'user:' + owner.id);
      await client.cancelQueries({ predicate: predicates });
      if (!current()) return;
      await client.invalidateQueries({ predicate: predicates });
      if (current()) Toast.show({ type: 'success', text1: 'Review submitted' });
    } catch (error) {
      if (current() && dealReviewState(deal.id) === 'confirmed') {
        Toast.show({
          type: 'warning',
          text1: 'Review submitted',
          text2: 'Refresh reviews to load the latest data.',
        });
        return;
      }
      if (current())
        Toast.show({
          type: dealReviewState(deal.id) === 'unknown' ? 'warning' : 'error',
          text1:
            dealReviewState(deal.id) === 'unknown'
              ? 'Submission not confirmed'
              : 'Review unavailable',
          text2:
            error instanceof ApiError && error.status === 409
              ? 'This deal cannot receive another review. Check My Reviews.'
              : dealReviewState(deal.id) === 'unknown'
              ? 'Your draft is preserved. Do not resend until the outcome is confirmed.'
              : 'Check your rating and review, or refresh the deal.',
        });
    } finally {
      flight.current = false;
      if (current()) setBusy(false);
    }
  };
  return (
    <>
      <AppButton
        title="Give Review"
        variant="secondary"
        disabled={blocked || busy}
        onPress={() => setVisible(true)}
      />
      {blocked && (
        <AppText>
          {state === 'unknown'
            ? 'Review submission is not confirmed. Your draft is preserved.'
            : 'Review already submitted or unavailable.'}
        </AppText>
      )}
      <SubmitReviewDialog
        visible={visible && focused}
        draft={draft}
        busy={busy}
        blocked={blocked}
        onChange={value => {
          if (!flight.current) setDraft(value);
        }}
        onSubmit={() => {
          submit().catch(() => {});
        }}
        onCancel={() => {
          if (!flight.current) setVisible(false);
        }}
      />
    </>
  );
}
