import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDashboardVisitorReviews } from '../src/features/reviews/hooks/useDashboardVisitorReviews';
import * as service from '../src/features/reviews/services/visitorReviewsService';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { appConfig } from '../src/constants/appConfig';
import Toast from 'react-native-toast-message';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
let state: ReturnType<typeof useDashboardVisitorReviews>,
  tree: ReactTestRenderer,
  client: QueryClient;
const previous = appConfig.uiPreviewEnabled;
function Probe() {
  state = useDashboardVisitorReviews();
  return null;
}
async function settle() {
  await Renderer.act(async () => {
    await new Promise<void>(done => setTimeout(done, 30));
  });
}
async function mount() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  await settle();
}
beforeEach(() => {
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
  useDevelopmentStore.setState({ previewActive: false });
  jest
    .spyOn(service, 'getReceivedVisitorReviews')
    .mockImplementation(async page => ({
      items: [],
      pagination: {
        current_page: page ?? 1,
        per_page: 20,
        total: 22,
        last_page: 2,
      },
      nextPage: page === 2 ? null : 2,
    }));
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client?.clear();
  });
  appConfig.uiPreviewEnabled = previous;
  jest.restoreAllMocks();
});
test('only one initial request, normal rerenders reuse the query and pagination stops at the documented last page', async () => {
  await mount();
  expect(service.getReceivedVisitorReviews).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => {
    tree.update(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  expect(service.getReceivedVisitorReviews).toHaveBeenCalledTimes(1);
  expect(state.hasNextPage).toBe(true);
  await Renderer.act(async () => {
    await state.fetchNextPage();
  });
  await settle();
  expect(state.data?.pages.map(p => p.pagination.current_page)).toEqual([1, 2]);
  expect(service.getReceivedVisitorReviews).toHaveBeenCalledTimes(2);
  expect(state.hasNextPage).toBe(false);
});
test.each(['guest', 'demo'])(
  '%s never calls the real feed service',
  async mode => {
    useAuthStore.getState().clear();
    appConfig.uiPreviewEnabled = true;
    useDevelopmentStore.setState({ previewActive: mode === 'demo' });
    await mount();
    expect(service.getReceivedVisitorReviews).not.toHaveBeenCalled();
    if (mode === 'demo') expect(state.data?.pages[0].items).toEqual([]);
  },
);
test('late old-account request cannot replace current account page and logout clears cache', async () => {
  let resolve!: (
    value: Awaited<ReturnType<typeof service.getReceivedVisitorReviews>>,
  ) => void;
  jest.mocked(service.getReceivedVisitorReviews).mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await mount();
  await Renderer.act(async () => {
    useAuthStore
      .getState()
      .setUser({ id: 9, name: 'Other', email: 'other@example.test' });
  });
  await settle();
  await Renderer.act(async () => {
    resolve({
      items: [],
      pagination: { current_page: 1, per_page: 20, total: 99, last_page: 5 },
      nextPage: 2,
    });
  });
  await settle();
  expect(state.data?.pages[0].pagination.total).toBe(22);
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
    client.clear();
  });
  await settle();
  expect(state.data).toBeUndefined();
});
test('unmount during explicit retry cannot emit a late error Toast', async () => {
  const toast = jest.spyOn(Toast, 'show');
  await mount();
  let fail!: (reason: unknown) => void;
  jest.mocked(service.getReceivedVisitorReviews).mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  let retry!: ReturnType<typeof state.refetch>;
  await Renderer.act(async () => {
    retry = state.refetch();
  });
  await Renderer.act(async () => {
    tree.unmount();
  });
  await Renderer.act(async () => {
    fail(new Error('offline'));
    await retry;
  });
  expect(toast).not.toHaveBeenCalled();
});
