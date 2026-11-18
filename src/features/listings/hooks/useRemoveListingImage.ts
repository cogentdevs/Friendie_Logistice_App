import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isPublicHomeQuery } from '../../../services/api/publicHomeCache';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../../store/authStore';
import { useListingDraft } from '../../post-listing/store/listingDraftStore';
import { refreshEditListingImage } from '../../post-listing/services/updateListingService';
import { OwnListingRecord } from '../types/myListingsApi.types';
import { isVerifiedOwnedListing } from '../services/ownListingDetailsService';
import {
  canRemoveListingImage,
  hasUploadedListingImage,
  removeListingImage,
} from '../services/listingImageDeleteService';
import { listingImageOperation } from '../../post-listing/services/listingImageOperations';
export function useRemoveListingImage(
  record: OwnListingRecord | undefined,
  focused: boolean,
) {
  const user = useAuthStore(state => state.user),
    status = useAuthStore(state => state.status);
  useListingDraft(state => state.imageRecovery);
  const client = useQueryClient();
  const [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [, update] = useState(0);
  const live = useRef(false);
  const flight = useRef(false),
    abort = useRef<AbortController | null>(null),
    epoch = useRef(0);
  const selected = useRef<OwnListingRecord | undefined>(undefined);
  const id = record?.id;
  useEffect(() => {
    const generation = ++epoch.current;
    live.current = focused;
    selected.current = undefined;
    setVisible(false);
    setBusy(false);
    return () => {
      live.current = false;
      selected.current = undefined;
      epoch.current = generation + 1;
      abort.current?.abort();
    };
  }, [user, status, id, focused]);
  const available =
    !!record &&
    isVerifiedOwnedListing(record) &&
    hasUploadedListingImage(record);
  const enabled = !!record && canRemoveListingImage(record) && focused && !busy;
  const close = () => {
    if (!flight.current) {
      selected.current = undefined;
      setVisible(false);
    }
  };
  const open = () => {
    if (live.current && enabled && useAuthStore.getState().user === user) {
      selected.current = record;
      setVisible(true);
    }
  };
  const confirm = async () => {
    if (
      !live.current ||
      !visible ||
      !record ||
      !enabled ||
      flight.current ||
      !user
    )
      return;
    const selection = selected.current;
    if (!selection || selection.image_url !== record.image_url) {
      setVisible(false);
      return;
    }
    flight.current = true;
    setBusy(true);
    const generation = epoch.current;
    const controller = new AbortController();
    abort.current = controller;
    const current = () =>
      useAuthStore.getState().user === user &&
      useAuthStore.getState().status === 'authenticated';
    const active = () =>
      current() && epoch.current === generation && !controller.signal.aborted;
    let saved = false;
    try {
      const result = await removeListingImage(selection, controller.signal);
      saved = true;
      if (!current()) return;
      const predicate = (query: { queryKey: readonly unknown[] }) => {
        const key = query.queryKey;
        return (
          (key[0] === 'ownListingDetails' &&
            key[1] === user.id &&
            key[2] === String(record.id)) ||
          (key[0] === 'myListings.read' && key[1] === 'user:' + user.id) ||
          (((key[0] === 'listingDetails' && key[1] === String(record.id)) ||
            key[0] === 'listings' ||
            isPublicHomeQuery(query)) &&
            !key.includes('demo'))
        );
      };
      await client.cancelQueries({ predicate });
      if (!current()) return;
      // These image-only patches contain only server-confirmed data and retain
      // every other cached detail field and all draft/diff values.
      client.setQueryData(
        ['ownListingDetails', user.id, String(record.id)],
        (old: unknown) =>
          old &&
          typeof old === 'object' &&
          'backend' in old &&
          (old.backend as OwnListingRecord).image_url === selection.image_url
            ? {
                ...old,
                coverImageUrl: result.imageUrl,
                backend: {
                  ...(old.backend as OwnListingRecord),
                  image_url: result.imageUrl,
                },
              }
            : old,
      );
      refreshEditListingImage(
        String(record.id),
        result.imageUrl,
        selection.image_url,
      );
      await client.invalidateQueries({ predicate });
      if (!active()) return;
      setVisible(false);
      Toast.show({
        type: result.reconciled ? 'info' : 'success',
        text1: result.reconciled
          ? 'The listing now uses its default image.'
          : 'Listing image removed successfully.',
      });
    } catch {
      if (!active()) return;
      const uncertain = listingImageOperation(record.id)?.state === 'unknown';
      Toast.show({
        type: uncertain || saved ? 'warning' : 'error',
        text1: saved
          ? 'Image removed; please refresh your listing.'
          : uncertain
          ? 'Image removal status could not be confirmed.'
          : 'Could not remove the listing image.',
        text2: uncertain
          ? 'Retry is disabled while the outcome is uncertain. No automatic retry was made.'
          : saved
          ? 'The server confirmed removal.'
          : 'Your listing remains intact. Please check your connection and account access.',
      });
      setVisible(false);
    } finally {
      flight.current = false;
      if (active()) {
        setBusy(false);
        update(value => value + 1);
      }
    }
  };
  return {
    available,
    enabled,
    visible:
      visible &&
      available &&
      focused &&
      selected.current?.image_url === record?.image_url,
    busy,
    open,
    close,
    confirm,
  };
}
