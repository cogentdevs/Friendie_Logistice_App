import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isPublicHomeQuery } from '../../../services/api/publicHomeCache';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../../store/authStore';
import { ApiError } from '../../../types/api';
import { editContext, updateListing } from '../services/updateListingService';
import { useEditListingDraft } from '../store/editListingDraftStore';
import { listingPinErrors } from '../services/listingPinPayload';
export function useUpdateListing(
  id: string | undefined,
  focused: boolean,
  onSaved: (id: number) => void,
) {
  const client = useQueryClient(),
    user = useAuthStore(state => state.user);
  const [busy, setBusy] = useState(false),
    [held, setHeld] = useState(false),
    [errors, setErrors] = useState<Record<string, string[]>>({});
  const flight = useRef(false),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    setBusy(false);
    setHeld(false);
    setErrors({});
    return () => controller.current?.abort();
  }, [id, user, focused]);
  const submit = async () => {
    if (
      !id ||
      !focused ||
      flight.current ||
      !user ||
      useEditListingDraft.getState().listingId !== id
    )
      return;
    const context = editContext(id);
    if (!context || context.user !== user) return;
    flight.current = true;
    setBusy(true);
    setErrors({});
    const abort = new AbortController();
    controller.current = abort;
    const current = () =>
      useAuthStore.getState().user === user &&
      useAuthStore.getState().status === 'authenticated';
    const visible = () =>
      current() &&
      !abort.signal.aborted &&
      useEditListingDraft.getState().listingId === id;
    const snapshot = useEditListingDraft.getState().values;
    try {
      const row = await updateListing(context, snapshot, abort.signal);
      if (!current()) return;
      if (!row) {
        if (visible())
          Toast.show({ type: 'info', text1: 'No changes to save.' });
        return;
      }
      // Cancel older readers before invalidating; never overwrite a server DTO
      // with form values or collapse infinite-query pages/filters.
      const predicate = (query: { queryKey: readonly unknown[] }) => {
        const key = query.queryKey;
        return (
          (key[0] === 'profileDashboard' &&
            key[1] === 'user:' + user.id &&
            row.status !== context.original.status) ||
          (key[0] === 'myListings.read' && key[1] === 'user:' + user.id) ||
          (key[0] === 'ownListingDetails' &&
            key[1] === user.id &&
            key[2] === id) ||
          (((key[0] === 'listingDetails' && key[1] === id) ||
            key[0] === 'listings' ||
            isPublicHomeQuery(query)) &&
            !key.includes('demo'))
        );
      };
      await client.cancelQueries({ predicate });
      if (!current()) return;
      await client.invalidateQueries({ predicate });
      if (!visible()) return;
      Toast.show({ type: 'success', text1: 'Listing updated successfully.' });
      if (useEditListingDraft.getState().values === snapshot) {
        context.draft = undefined;
        useEditListingDraft.getState().keep();
        onSaved(row.id);
      } else {
        context.original = row;
        context.initial = snapshot;
        context.draft = useEditListingDraft.getState().values;
        context.state = 'ready';
      }
    } catch (error) {
      if (!visible()) return;
      const uncertain = context.state === 'unknown';
      if (context.state === 'confirmed') {
        setHeld(true);
        Toast.show({
          type: 'warning',
          text1: 'Listing saved.',
          text2: 'Please reopen My Listings to refresh the saved details.',
        });
        return;
      }
      setHeld(uncertain);
      if (error instanceof ApiError && error.fields) setErrors(listingPinErrors(error.fields));
      Toast.show({
        type: uncertain ? 'warning' : 'error',
        text1: uncertain
          ? 'Update status could not be confirmed.'
          : 'Unable to update listing.',
        text2: uncertain
          ? 'Your edits are saved. Check My Listings before another update. No automatic retry was made.'
          : error instanceof ApiError && error.status === 422
          ? 'Please correct the highlighted fields.'
          : 'Your edits are saved. Please check your connection and account access.',
      });
    } finally {
      flight.current = false;
      if (visible()) setBusy(false);
    }
  };
  return {
    busy,
    held:
      held ||
      (!!id &&
        ['pending', 'unknown', 'confirmed'].includes(
          editContext(id)?.state ?? '',
        )),
    errors,
    submit,
  };
}
