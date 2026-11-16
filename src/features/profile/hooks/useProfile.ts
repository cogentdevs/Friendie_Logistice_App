import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { useAuthStore } from '../../../store/authStore';
import {
  isUiPreviewActive,
  useDevelopmentStore,
} from '../../../store/developmentStore';
import { getProfile } from '../services/profileService';
export function useProfile() {
  const focused = useIsFocused(),
    status = useAuthStore(state => state.status),
    owner = useAuthStore(state => state.user?.id),
    preview = useDevelopmentStore(state => state.previewActive),
    demo =
      preview &&
      isUiPreviewActive() &&
      useAuthStore.getState().status !== 'authenticated';
  const query = useQuery({
    queryKey: ['profile', demo ? 'demo' : owner ?? 'guest'],
    queryFn: ({ signal }) => getProfile(signal),
    enabled: focused && (demo || (status === 'authenticated' && !!owner)),
    staleTime: 60000,
    retry: false,
  });
  return { query, demo };
}
