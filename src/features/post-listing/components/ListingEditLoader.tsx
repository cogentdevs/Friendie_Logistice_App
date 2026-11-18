import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { AppButton } from '../../../components/ui/AppButton';
import { AppText } from '../../../components/ui/AppText';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { useAuthStore } from '../../../store/authStore';
import { loadListingEdit, EditContext } from '../services/updateListingService';
import { useEditListingDraft } from '../store/editListingDraftStore';
export function ListingEditLoader({
  id,
  children,
}: {
  id: string;
  children: (context: EditContext) => React.ReactNode;
}) {
  const user = useAuthStore(state => state.user),
    status = useAuthStore(state => state.status);
  const [context, setContext] = useState<EditContext>(),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useFocusEffect(
    useCallback(() => {
      const abort = new AbortController();
      setContext(undefined);
      setError(false);
      if (status !== 'authenticated') {
        setError(true);
        return () => abort.abort();
      }
      loadListingEdit(id, abort.signal)
        .then(value => {
          if (
            abort.signal.aborted ||
            useAuthStore.getState().user !== user ||
            useAuthStore.getState().status !== 'authenticated'
          )
            return;
          useEditListingDraft.setState({
            listingId: id,
            values: value.draft ?? value.initial,
            dirty: !!value.draft,
          });
          setContext(value);
        })
        .catch(() => {
          if (!abort.signal.aborted && useAuthStore.getState().user === user) {
            setError(true);
            if (retry > 0)
              Toast.show({
                type: 'error',
                text1: 'Unable to load listing.',
                text2: 'Please check your connection and account access.',
              });
          }
        });
      return () => abort.abort();
    }, [id, user, status, retry]),
  );
  if (
    context?.user === user &&
    String(context.original.id) === id &&
    status === 'authenticated'
  )
    return <>{children(context)}</>;
  return (
    <ScreenContainer>
      {error ? (
        <>
          <AppText>Unable to load this listing for editing.</AppText>
          <AppButton
            title="Retry"
            onPress={() => setRetry(value => value + 1)}
          />
        </>
      ) : (
        <ActivityIndicator accessibilityLabel="Loading listing for editing" />
      )}
    </ScreenContainer>
  );
}
