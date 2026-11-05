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
    owner = useAuthStore(state => state.user?.id),
    preview = useDevelopmentStore(state => state.previewActive),
    demo = preview && isUiPreviewActive();
  const query = useQuery({
    queryKey: ['profile', demo ? 'demo' : owner ?? 'guest'],
    queryFn: ({ signal }) => getProfile(signal),
    enabled: focused,
    retry: false,
  });
  return { query, demo };
}
