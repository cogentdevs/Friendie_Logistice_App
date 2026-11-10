import { useAuthStore } from './authStore';
import { create } from 'zustand';
import { isUiPreviewAllowed } from '../constants/appConfig';
// In-memory UI navigation only. Never persisted or treated as authentication.
export const useDevelopmentStore = create<{
  previewActive: boolean;
  authEntryRequested: boolean;
  requestLogin: () => void;
  enterPreview: () => void;
  exitPreview: () => void;
}>(set => ({
  previewActive: false,
  authEntryRequested: false,
  requestLogin: () => set({ previewActive: false, authEntryRequested: true }),
  enterPreview: () => {
    if (isUiPreviewAllowed())
      set({ previewActive: true, authEntryRequested: false });
  },
  exitPreview: () => set({ previewActive: false }),
}));

export function isUiPreviewActive() {
  return (
    useAuthStore.getState().status !== 'authenticated' &&
    isUiPreviewAllowed() &&
    useDevelopmentStore.getState().previewActive
  );
}
