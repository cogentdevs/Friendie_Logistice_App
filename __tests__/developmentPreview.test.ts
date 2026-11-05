import { appConfig } from '../src/constants/appConfig';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { useAuthStore } from '../src/store/authStore';
const original = appConfig.uiPreviewEnabled;
afterEach(() => {
  appConfig.uiPreviewEnabled = original;
  useDevelopmentStore.getState().exitPreview();
  jest.restoreAllMocks();
});
test('preview entry changes navigation state without changing authentication', () => {
  appConfig.uiPreviewEnabled = true;
  const auth = useAuthStore.getState();
  useDevelopmentStore.getState().enterPreview();
  expect(useDevelopmentStore.getState().previewActive).toBe(true);
  expect(useAuthStore.getState()).toBe(auth);
  useDevelopmentStore.getState().exitPreview();
  expect(useDevelopmentStore.getState().previewActive).toBe(false);
});
test('turning off UI preview keeps actual authentication enabled', () => {
  appConfig.uiPreviewEnabled = false;
  useDevelopmentStore.getState().enterPreview();
  expect(useDevelopmentStore.getState().previewActive).toBe(false);
});
test('release runtime cannot enter preview even if the configuration flag is true', () => {
  appConfig.uiPreviewEnabled = true;
  jest.replaceProperty(
    globalThis as typeof globalThis & { __DEV__: boolean },
    '__DEV__',
    false,
  );
  useDevelopmentStore.getState().enterPreview();
  expect(useDevelopmentStore.getState().previewActive).toBe(false);
});
