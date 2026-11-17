import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../../store/authStore';
import { isUiPreviewActive } from '../../../store/developmentStore';
import { ApiError } from '../../../types/api';
import { requireAuth } from '../../auth/services/authFlowCoordinator';
import { useListingDraft } from '../store/listingDraftStore';
import {
  createListing,
  createListingErrorMessage,
  listingSubmission,
} from '../services/createListingService';
import { validateListingImage } from '../services/listingImageSelection';
import {
  uploadListingImage,
  listingImageAttempt,
  listingImageErrorMessage,
} from '../services/listingImageUploadService';
import { getOwnListingDetails } from '../../listings/services/ownListingDetailsService';
import type { ListingImageRecovery } from '../store/listingDraftStore';

export function useCreateListing(
  focused: boolean,
  onCreated: (id: number) => void,
) {
  const user = useAuthStore(state => state.user),
    status = useAuthStore(state => state.status);
  const client = useQueryClient();
  const recovery = useListingDraft(state => state.imageRecovery);
  const [busy, setBusy] = useState(false),
    [errors, setErrors] = useState<Record<string, string[]>>({});
  const flight = useRef(false),
    generation = useRef(0),
    abort = useRef<AbortController | null>(null);
  useEffect(() => {
    const epoch = ++generation.current;
    setBusy(false);
    setErrors({});
    return () => {
      generation.current = epoch + 1;
      abort.current?.abort();
      const saved = useListingDraft.getState().imageRecovery;
      if (useAuthStore.getState().user === user && saved?.phase === 'ready')
        useListingDraft.getState().recoverImage({ ...saved, phase: 'failed' });
    };
  }, [user, status, focused]);
  const upload = async (
    context: ListingImageRecovery,
    current: () => boolean,
    visible: () => boolean,
  ) => {
    useListingDraft.getState().recoverImage({ ...context, phase: 'uploading' });
    try {
      const imageUrl = await uploadListingImage(
        context.listing,
        context.image,
        abort.current?.signal,
      );
      if (!current()) return false;
      useListingDraft
        .getState()
        .recoverImage({ ...context, phase: 'uploaded', imageUrl });
      const keys = [
        ['myListings.read', 'user:' + user!.id],
        ['ownListingDetails', user!.id, String(context.listing.id)],
      ];
      await Promise.all(
        keys.map(queryKey => client.cancelQueries({ queryKey })),
      );
      if (!current()) return false;
      await Promise.all(
        keys.map(queryKey =>
          client.invalidateQueries({ queryKey, refetchType: 'active' }),
        ),
      );
      if (!current()) return false;
      const publicQueries = {
        predicate: (query: { queryKey: readonly unknown[] }) => {
          const key = query.queryKey;
          return (
            !key.includes('demo') &&
            !key.includes('static-testing') &&
            (key[0] === 'listings' ||
              (key[0] === 'listingDetails' &&
                key[1] === String(context.listing.id)) ||
              (key[0] === 'home' && key[1] === 'latest' && key[2] === 'api'))
          );
        },
      };
      await client.cancelQueries(publicQueries);
      if (!current()) return false;
      await client.invalidateQueries({
        ...publicQueries,
        refetchType: 'active',
      });
      return visible();
    } catch (error) {
      if (!current()) return false;
      const state = listingImageAttempt(context.listing.id)?.state;
      // A confirmed upload stays confirmed even if a subsequent cache refresh fails.
      if (state === 'uploaded') {
        if (visible())
          Toast.show({
            type: 'warning',
            text1: 'Image uploaded',
            text2: 'Refresh your listing to load the latest image.',
          });
        return false;
      }
      const phase = state === 'failed' ? 'failed' : 'unknown';
      useListingDraft.getState().recoverImage({ ...context, phase });
      if (phase === 'unknown' && !abort.current?.signal.aborted) {
        try {
          const observed = await getOwnListingDetails(
            String(context.listing.id),
            abort.current?.signal,
          );
          if (current())
            useListingDraft.getState().recoverImage({
              ...context,
              phase,
              observedImageUrl: observed.coverImageUrl,
            });
        } catch {
          /* A failed reconciliation never authorizes another multipart POST. */
        }
      }
      if (visible())
        Toast.show({
          type: phase === 'unknown' ? 'warning' : 'error',
          text1:
            phase === 'unknown'
              ? 'Listing created; image status uncertain'
              : 'Listing created; image not uploaded',
          text2:
            phase === 'unknown'
              ? 'Your image and listing ID are saved. Check the listing image. Retry is disabled because delivery is uncertain.'
              : listingImageErrorMessage(error),
        });
      return false;
    }
  };
  const finish = (context: ListingImageRecovery) => {
    const unchanged =
      JSON.stringify(useListingDraft.getState().values) ===
      JSON.stringify(context.draft);
    useListingDraft.getState().recoverImage(undefined);
    if (unchanged) useListingDraft.getState().discard();
    Toast.show({
      type: 'success',
      text1: 'Listing image uploaded successfully',
      text2: 'Your listing remains Pending approval.',
    });
    if (unchanged) onCreated(context.listing.id);
  };
  const retryImage = async () => {
    if (
      !recovery ||
      recovery.phase !== 'failed' ||
      flight.current ||
      !focused ||
      !user ||
      useAuthStore.getState().user !== user ||
      useAuthStore.getState().status !== 'authenticated'
    )
      return;
    flight.current = true;
    setBusy(true);
    const epoch = generation.current;
    const current = () =>
      useAuthStore.getState().user === user &&
      useAuthStore.getState().status === 'authenticated';
    const visible = () => current() && generation.current === epoch;
    abort.current = new AbortController();
    try {
      if ((await upload(recovery, current, visible)) && visible())
        finish(recovery);
    } finally {
      flight.current = false;
      if (visible()) setBusy(false);
    }
  };
  const submit = async () => {
    if (
      flight.current ||
      recovery ||
      !focused ||
      useAuthStore.getState().user !== user
    )
      return;
    if (isUiPreviewActive()) {
      Toast.show({
        type: 'info',
        text1: 'Create listing unavailable',
        text2: 'Use a real customer account to create listings.',
      });
      return;
    }
    if (status !== 'authenticated' || !user) {
      requireAuth({
        type: 'POST_LISTING',
        params: { listingType: useListingDraft.getState().values.type },
      });
      return;
    }
    flight.current = true;
    setBusy(true);
    setErrors({});
    const epoch = generation.current,
      snapshot = useListingDraft.getState().values;
    const current = () =>
      useAuthStore.getState().status === 'authenticated' &&
      useAuthStore.getState().user === user;
    const visible = () => current() && generation.current === epoch;
    abort.current = new AbortController();
    let confirmed = false;
    try {
      if (snapshot.image) await validateListingImage(snapshot.image);
      if (!visible()) return;
      const row = await createListing(snapshot, abort.current.signal);
      confirmed = true;
      if (!current()) return;
      const context: ListingImageRecovery | undefined = snapshot.image
        ? {
            listing: row,
            image: snapshot.image,
            draft: snapshot,
            phase: 'ready',
          }
        : undefined;
      if (context) useListingDraft.getState().recoverImage(context);
      const keys = [
        ['myListings.read', 'user:' + user.id],
        ['profileDashboard', 'user:' + user.id, 'summary'],
      ];
      await Promise.all(
        keys.map(queryKey => client.cancelQueries({ queryKey })),
      );
      if (!current()) return;
      await Promise.all(
        keys.map(queryKey =>
          client.invalidateQueries({ queryKey, refetchType: 'active' }),
        ),
      );
      if (!visible()) return;
      if (context) {
        if ((await upload(context, current, visible)) && visible())
          finish(context);
        return;
      }
      const unchanged =
        JSON.stringify(useListingDraft.getState().values) ===
        JSON.stringify(snapshot);
      if (unchanged) useListingDraft.getState().discard();
      Toast.show({
        type: 'success',
        text1: 'Listing created',
        text2: 'Your listing is Pending approval.',
      });
      if (unchanged) onCreated(row.id);
    } catch (error) {
      if (!visible()) return;
      if (confirmed) {
        const saved = useListingDraft.getState().imageRecovery;
        if (saved?.phase === 'ready')
          useListingDraft
            .getState()
            .recoverImage({ ...saved, phase: 'failed' });
        Toast.show({
          type: 'warning',
          text1: 'Listing created',
          text2: 'Refresh My Listings and Dashboard to load the latest data.',
        });
        return;
      }
      if (error instanceof ApiError && error.status === 422 && error.fields)
        setErrors(error.fields);
      const uncertain = listingSubmission()?.state === 'unknown';
      Toast.show({
        type: uncertain ? 'warning' : 'error',
        text1: uncertain
          ? 'Creation not confirmed'
          : 'Unable to create listing',
        text2: uncertain
          ? 'Your draft is saved. Check My Listings before creating another listing. Do not resubmit this request.'
          : createListingErrorMessage(error),
      });
    } finally {
      flight.current = false;
      if (visible()) setBusy(false);
    }
  };
  return {
    busy,
    errors,
    submit,
    retryImage,
    recovery,
    held: listingSubmission()?.state,
  };
}
