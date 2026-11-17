import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../../store/authStore';
import { isUiPreviewActive } from '../../../store/developmentStore';
import { requireAuth } from '../../auth/services/authFlowCoordinator';
import { isVerifiedPublicListing } from '../../listings/services/publicListingsService';
import { reviewKeys } from './useReviews';
import {
  ReviewDraft,
  reviewSubmission,
  submitReview,
  submitReviewErrorMessage,
} from '../services/submitReviewService';

const emptyDraft: ReviewDraft = { rating: null, review: '' };
export function useSubmitReview(
  listing: { id: number; ownerId: number } | undefined,
  focused: boolean,
) {
  const user = useAuthStore(state => state.user),
    status = useAuthStore(state => state.status);
  const client = useQueryClient();
  const [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false);
  const [draft, updateDraft] = useState<ReviewDraft>(emptyDraft);
  const draftRef = useRef(draft);
  const flight = useRef(false),
    generation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const session = useRef(user);
  const target = useRef(listing?.id);
  useEffect(() => {
    const epoch = ++generation.current;
    abort.current?.abort();
    setVisible(false);
    setBusy(false);
    if (session.current !== user || target.current !== listing?.id) {
      draftRef.current = emptyDraft;
      updateDraft(emptyDraft);
    }
    session.current = user;
    target.current = listing?.id;
    return () => {
      generation.current = epoch + 1;
      abort.current?.abort();
    };
  }, [user, status, listing?.id, focused]);
  const setDraft = (value: ReviewDraft) => {
    if (useAuthStore.getState().user !== user || status !== 'authenticated')
      return;
    draftRef.current = value;
    updateDraft(value);
  };
  const open = useCallback(() => {
    if (!listing || !isVerifiedPublicListing(listing) || isUiPreviewActive()) {
      Toast.show({
        type: 'info',
        text1: 'Reviews unavailable',
        text2: 'Select a real public listing and use a real account.',
      });
      return;
    }
    const account = useAuthStore.getState();
    if (account.status !== 'authenticated') {
      requireAuth({
        type: 'SUBMIT_REVIEW',
        params: { listingId: String(listing.id) },
      });
      return;
    }
    if (account.user?.id === listing.ownerId) {
      Toast.show({
        type: 'rejected',
        text1: 'Review not permitted',
        text2: 'You cannot review your own listing.',
      });
      return;
    }
    const previous = reviewSubmission(listing.id);
    if (previous?.state === 'confirmed' || previous?.state === 'duplicate') {
      Toast.show({
        type: 'info',
        text1: 'Review already submitted',
        text2: 'Check Your Reviews for the authoritative record.',
      });
      return;
    }
    if (previous && 'draft' in previous) {
      draftRef.current = previous.draft;
      updateDraft(previous.draft);
    }
    setVisible(true);
  }, [listing]);
  const submit = async () => {
    if (
      flight.current ||
      !listing ||
      !user ||
      status !== 'authenticated' ||
      useAuthStore.getState().user !== user ||
      useAuthStore.getState().status !== 'authenticated' ||
      !focused
    )
      return;
    flight.current = true;
    setBusy(true);
    const epoch = generation.current;
    const current = () =>
      generation.current === epoch &&
      useAuthStore.getState().status === 'authenticated' &&
      useAuthStore.getState().user === user;
    const snapshot = { ...draftRef.current };
    abort.current = new AbortController();
    let confirmed = false;
    try {
      await submitReview(listing, snapshot, abort.current.signal);
      confirmed = true;
      if (!current()) return;
      // Clear only the submitted values, never newer in-flight edits.
      if (
        draftRef.current.rating === snapshot.rating &&
        draftRef.current.review === snapshot.review
      ) {
        draftRef.current = emptyDraft;
        updateDraft(emptyDraft);
        setVisible(false);
      }
      const queryKey = reviewKeys.authored('user:' + user.id);
      await client.cancelQueries({ queryKey });
      if (!current()) return;
      await client.invalidateQueries({ queryKey, refetchType: 'active' });
      if (!current()) return;
      Toast.show({ type: 'success', text1: 'Review submitted successfully' });
    } catch (error) {
      if (!current()) return;
      if (confirmed) {
        Toast.show({
          type: 'warning',
          text1: 'Review submitted',
          text2: 'Refresh Your Reviews to load the latest data.',
        });
        return;
      }
      const state = reviewSubmission(listing.id)?.state;
      const uncertain = state === 'unknown';
      Toast.show({
        type: uncertain
          ? 'warning'
          : state === 'duplicate'
          ? 'rejected'
          : 'error',
        text1: uncertain
          ? 'Submission not confirmed'
          : 'Unable to submit review',
        text2: uncertain
          ? 'Your draft is saved. Check Your Reviews before submitting again.'
          : submitReviewErrorMessage(error),
      });
    } finally {
      flight.current = false;
      if (current()) setBusy(false);
    }
  };
  const state = reviewSubmission(listing?.id ?? 0)?.state;
  return {
    visible: visible && focused && status === 'authenticated',
    draft,
    setDraft,
    busy,
    blocked: !!state && !busy,
    notice:
      state === 'unknown'
        ? 'Submission is not confirmed. Your draft is saved. Check Your Reviews before submitting again.'
        : state === 'confirmed' || state === 'duplicate'
        ? 'You have already reviewed this listing.'
        : state === 'pending'
        ? 'A review submission is in progress.'
        : undefined,
    open,
    submit,
    close: () => {
      generation.current++;
      abort.current?.abort();
      setVisible(false);
      setBusy(false);
    },
  };
}
