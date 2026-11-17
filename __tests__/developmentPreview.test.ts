import { appConfig } from '../src/constants/appConfig';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { useAuthStore } from '../src/store/authStore';
const original = appConfig.uiPreviewEnabled;
const originalTesting = appConfig.testingUiPreview;
beforeEach(() => {
  appConfig.testingUiPreview = false;
});
afterEach(() => {
  appConfig.uiPreviewEnabled = original;
  appConfig.testingUiPreview = originalTesting;
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

test('explicit testing APK allows UI navigation without creating authentication', () => {
  jest.replaceProperty(
    globalThis as typeof globalThis & { __DEV__: boolean },
    '__DEV__',
    false,
  );
  const originalStatic = appConfig.staticTestingBuild;
  jest.isolateModules(() => {
    const { NativeModules } = require('react-native');
    const descriptor = Object.getOwnPropertyDescriptor(
      NativeModules,
      'FriendieAppMetadata',
    );
    // appConfig reads this native metadata at module initialization.
    Object.defineProperty(NativeModules, 'FriendieAppMetadata', {
      configurable: true,
      value: { staticTesting: true },
    });
    try {
      const isolatedConfig = require('../src/constants/appConfig').appConfig;
      const isolatedAuth = require('../src/store/authStore').useAuthStore;
      const isolatedPreview =
        require('../src/store/developmentStore').useDevelopmentStore;
      expect(isolatedConfig.staticTestingBuild).toBe(true);
      expect(isolatedConfig.uiPreviewEnabled).toBe(true);
      const auth = isolatedAuth.getState();
      isolatedPreview.getState().enterPreview();
      expect(isolatedPreview.getState().previewActive).toBe(true);
      expect(isolatedAuth.getState()).toBe(auth);
      isolatedPreview.getState().exitPreview();
    } finally {
      if (descriptor)
        Object.defineProperty(NativeModules, 'FriendieAppMetadata', descriptor);
      else delete NativeModules.FriendieAppMetadata;
    }
  });
  expect(appConfig.staticTestingBuild).toBe(originalStatic);
  expect(useDevelopmentStore.getState().previewActive).toBe(false);
});
