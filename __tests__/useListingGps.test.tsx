import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import Toast from 'react-native-toast-message';
import { useListingGps } from '../src/features/post-listing/hooks/useListingGps';
import { listingGpsService } from '../src/features/post-listing/services/listingGpsService';
import { useAuthStore } from '../src/store/authStore';
import { LocationError } from '../src/features/location/services/locationService';

let api: ReturnType<typeof useListingGps>, tree: ReactTestRenderer;
let listener: (state: string) => void;
const applied = jest.fn(),
  manual = { selected: false };
const result = {
  country: { id: 8, name: 'UAE' },
  city: { id: 71, name: 'Dubai', countryId: 8 },
};
function Harness({ enabled = true }: { enabled?: boolean }) {
  api = useListingGps(enabled, () => !manual.selected, applied);
  return null;
}
async function mount(enabled = true) {
  await Renderer.act(async () => {
    tree = Renderer.create(<Harness enabled={enabled} />);
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Toast, 'show').mockImplementation(() => {});
  manual.selected = false;
  useAuthStore
    .getState()
    .setUser({ id: 7, name: 'Test', email: 'test@example.test' });
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      listener = callback as typeof listener;
      return { remove: jest.fn() };
    });
  jest.spyOn(listingGpsService, 'hasPermission').mockResolvedValue(true);
  jest.spyOn(listingGpsService, 'enabled').mockResolvedValue(true);
  jest
    .spyOn(listingGpsService, 'requestPermission')
    .mockResolvedValue(undefined);
  jest.spyOn(listingGpsService, 'detect').mockResolvedValue(result);
  jest
    .spyOn(listingGpsService, 'openLocationSettings')
    .mockResolvedValue(undefined);
  jest.spyOn(listingGpsService, 'openAppSettings').mockResolvedValue(undefined);
});
afterEach(async () => {
  await Renderer.act(async () => tree?.unmount());
  jest.restoreAllMocks();
  useAuthStore.getState().clear();
});
test('entry automatically fills origin once when granted, without permission prompt or rerender requests', async () => {
  await mount();
  expect(applied).toHaveBeenCalledWith(result);
  expect(listingGpsService.requestPermission).not.toHaveBeenCalled();
  await Renderer.act(async () => tree.update(<Harness />));
  expect(listingGpsService.detect).toHaveBeenCalledTimes(1);
});
test('existing manual draft prevents automatic detection', async () => {
  manual.selected = true;
  await mount();
  expect(listingGpsService.detect).not.toHaveBeenCalled();
});
test('unfocused/Edit mode never detects', async () => {
  await mount(false);
  expect(listingGpsService.hasPermission).not.toHaveBeenCalled();
});
test('missing permission waits for explicit action', async () => {
  jest.mocked(listingGpsService.hasPermission).mockResolvedValue(false);
  await mount();
  expect(listingGpsService.requestPermission).not.toHaveBeenCalled();
  await Renderer.act(async () => api.detect());
  expect(listingGpsService.requestPermission).toHaveBeenCalledTimes(1);
  expect(applied).toHaveBeenCalledWith(result);
});
test.each(['denied', 'blocked', 'timeout', 'unavailable', 'disabled'] as const)(
  '%s preserves manual flow and uses Toast',
  async reason => {
    manual.selected = true;
    await mount();
    jest
      .mocked(listingGpsService.detect)
      .mockRejectedValueOnce(new LocationError(reason));
    await Renderer.act(async () => api.detect());
    expect(applied).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'warning' }),
    );
    expect(api.busy).toBe(false);
    if (reason === 'blocked') {
      expect(api.settings).toBe('app');
      await Renderer.act(async () => api.openSettings());
      expect(listingGpsService.openAppSettings).toHaveBeenCalledTimes(1);
    }
  },
);
test('disabled services provide settings action; returning resumes once without permission prompt', async () => {
  jest.mocked(listingGpsService.enabled).mockResolvedValue(false);
  await mount();
  expect(api.settings).toBe('location');
  expect(listingGpsService.detect).not.toHaveBeenCalled();
  await Renderer.act(async () => api.openSettings());
  expect(listingGpsService.openLocationSettings).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => listener('background'));
  jest.mocked(listingGpsService.enabled).mockResolvedValue(true);
  await Renderer.act(async () => listener('active'));
  expect(applied).toHaveBeenCalledWith(result);
  await Renderer.act(async () => listener('active'));
  expect(listingGpsService.detect).toHaveBeenCalledTimes(1);
});
test.each(['manual', 'navigation', 'logout', 'account', 'background'] as const)(
  '%s invalidates a pending GPS completion',
  async action => {
    let resolve!: (value: typeof result) => void;
    jest.mocked(listingGpsService.detect).mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    await mount();
    expect(api.busy).toBe(true);
    await Renderer.act(async () => {
      if (action === 'manual') {
        manual.selected = true;
        api.invalidate();
      }
      if (action === 'navigation') tree.update(<Harness enabled={false} />);
      if (action === 'logout') useAuthStore.getState().clear();
      if (action === 'account')
        useAuthStore
          .getState()
          .setUser({ id: 9, name: 'Other', email: 'other@example.test' });
      if (action === 'background') listener('background');
    });
    await Renderer.act(async () => resolve(result));
    expect(applied).not.toHaveBeenCalled();
  },
);
test('explicit repeated taps share one in-flight request', async () => {
  manual.selected = true;
  await mount();
  let resolve!: (value: typeof result) => void;
  jest.mocked(listingGpsService.detect).mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await Renderer.act(async () => {
    api.detect();
    api.detect();
  });
  expect(listingGpsService.detect).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => resolve(result));
  expect(applied).toHaveBeenCalledTimes(1);
});

test.each(['denied', 'blocked'] as const)(
  'explicit permission %s does not call provider or repeat on rerender',
  async reason => {
    jest.mocked(listingGpsService.hasPermission).mockResolvedValue(false);
    jest
      .mocked(listingGpsService.requestPermission)
      .mockRejectedValue(new LocationError(reason));
    await mount();
    await Renderer.act(async () => api.detect());
    await Renderer.act(async () => tree.update(<Harness />));
    expect(listingGpsService.requestPermission).toHaveBeenCalledTimes(1);
    expect(listingGpsService.detect).not.toHaveBeenCalled();
    expect(applied).not.toHaveBeenCalled();
  },
);
test('manual selection cancels settings-resume intent', async () => {
  jest.mocked(listingGpsService.enabled).mockResolvedValue(false);
  await mount();
  await Renderer.act(async () => api.openSettings());
  await Renderer.act(async () => {
    api.invalidate();
    manual.selected = true;
    listener('background');
  });
  jest.mocked(listingGpsService.enabled).mockResolvedValue(true);
  await Renderer.act(async () => listener('active'));
  expect(listingGpsService.detect).not.toHaveBeenCalled();
});

test('Strict Mode effect replay produces one usable automatic result', async () => {
  await Renderer.act(async () => {
    tree = Renderer.create(
      <React.StrictMode>
        <Harness />
      </React.StrictMode>,
    );
  });
  expect(listingGpsService.detect).toHaveBeenCalledTimes(1);
  expect(applied).toHaveBeenCalledWith(result);
});

test('reopening an empty Create form attempts once; reopening a selected origin preserves the draft', async () => {
  await mount();
  await Renderer.act(async () => tree.update(<Harness enabled={false} />));
  await Renderer.act(async () => tree.update(<Harness />));
  expect(listingGpsService.detect).toHaveBeenCalledTimes(2);
  manual.selected = true;
  await Renderer.act(async () => tree.update(<Harness enabled={false} />));
  await Renderer.act(async () => tree.update(<Harness />));
  expect(listingGpsService.detect).toHaveBeenCalledTimes(2);
});
