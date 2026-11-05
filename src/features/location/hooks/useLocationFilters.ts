import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  useFilterDraftStore,
  draftReady,
} from '../../search/store/filterDraftStore';
export function useLocationFilters() {
  const draft = useFilterDraftStore();
  useFocusEffect(
    useCallback(() => {
      useFilterDraftStore.getState().syncApplied();
    }, []),
  );
  return { ...draft, canApply: draftReady(draft) };
}
