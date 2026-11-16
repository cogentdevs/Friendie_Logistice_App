import { reviewsService } from '../src/features/reviews/services/reviewsService';
import * as visitorService from '../src/features/reviews/services/visitorReviewsService';
import Toast from 'react-native-toast-message';
import { ApiError } from '../src/types/api';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { appConfig } from '../src/constants/appConfig';
import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RefreshControl } from 'react-native';
import { ProfileDashboardScreen } from '../src/features/dashboard/screens/ProfileDashboardScreen';
import { DashboardStatCard } from '../src/features/dashboard/components/DashboardStatCard';
import { dashboardService } from '../src/features/dashboard/services/dashboardService';
import { useAuthStore } from '../src/store/authStore';
import { useMyListingsTabs } from '../src/features/listings/store/myListingsStore';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (callback: () => void) => {
    require('react').useEffect(callback, [callback]);
  },
}));
let tree: ReactTestRenderer, client: QueryClient;
const navigation = { navigate: jest.fn(), popTo: jest.fn() };
const previousPreview = appConfig.uiPreviewEnabled;
async function settle() {
  await Renderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 30));
  });
}
async function mount() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <ProfileDashboardScreen
          route={{ key: 'dashboard', name: 'ProfileDashboard' }}
          navigation={
            navigation as unknown as React.ComponentProps<
              typeof ProfileDashboardScreen
            >['navigation']
          }
        />
      </QueryClientProvider>,
    );
  });
  await settle();
}
beforeEach(() => {
  jest.clearAllMocks();
  useDevelopmentStore.setState({ previewActive: false });
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
  jest.spyOn(dashboardService, 'activeListings').mockResolvedValue(0);
  jest.spyOn(visitorService, 'getReceivedVisitorReviews').mockResolvedValue({
    items: [],
    nextPage: null,
    pagination: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
  });
  jest.spyOn(dashboardService, 'summary').mockResolvedValue({
    listings: { total: 4, published: 0, pending: 3, expired: 1 },
    unread_messages: 3,
    reviews_received: 12,
  });
  jest
    .spyOn(reviewsService, 'summary')
    .mockResolvedValue({ total: 12, averageRating: 4.5 });
  jest.spyOn(dashboardService, 'newMessages').mockResolvedValue(3);
  jest.spyOn(reviewsService, 'received').mockResolvedValue({
    items: [],
    nextPage: null,
    visibilityConfirmed: true,
  });
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client?.clear();
  });
  jest.restoreAllMocks();
  appConfig.uiPreviewEnabled = previousPreview;
});
test('exactly three confirmed metrics, empty visitor state and correct destinations', async () => {
  await mount();
  const cards = tree.root.findAllByType(DashboardStatCard);
  expect(cards.map(c => [c.props.label, c.props.count])).toEqual([
    ['Active Listing', 0],
    ['Total Reviews', 12],
    ['New Messages', 3],
  ]);
  expect(dashboardService.summary).toHaveBeenCalledTimes(1);
  expect(dashboardService.activeListings).not.toHaveBeenCalled();
  expect(dashboardService.newMessages).not.toHaveBeenCalled();
  expect(reviewsService.summary).not.toHaveBeenCalled();
  expect(
    tree.root.findAll(
      n => n.props.children === 'No visitor reviews available yet.',
    ).length,
  ).toBeGreaterThan(0);
  useMyListingsTabs.getState().select('user:8', 'expired');
  await Renderer.act(async () => {
    cards[0].props.onPress();
  });
  expect(useMyListingsTabs.getState().tabs['user:8']).toBe('active');
  expect(navigation.navigate).toHaveBeenLastCalledWith('MyListings');
  await Renderer.act(async () => {
    cards[1].props.onPress();
    cards[2].props.onPress();
  });
  expect(navigation.navigate).toHaveBeenCalledWith('MyReviews', {
    initialTab: 'visitors',
    returnTo: 'Dashboard',
  });
  expect(navigation.navigate).toHaveBeenLastCalledWith('MainTabs', {
    screen: 'MessagesStack',
    params: { screen: 'Conversations' },
  });
  await Renderer.act(async () => {
    tree.root
      .findAll(
        n =>
          n.props.accessibilityLabel === 'Back to Profile' && n.props.onPress,
      )[0]
      .props.onPress();
  });
  expect(navigation.popTo).toHaveBeenCalledWith('Profile');
});
test('visitor feed failure preserves summary counters and refresh retries the single summary', async () => {
  jest.mocked(reviewsService.summary).mockRejectedValue(new Error('offline'));
  jest
    .mocked(visitorService.getReceivedVisitorReviews)
    .mockRejectedValue(new Error('offline'));
  await mount();
  const cards = tree.root.findAllByType(DashboardStatCard);
  expect(cards[0].props.count).toBe(0);
  expect(cards[1].props.error).toBe(false);
  expect(cards[1].props.count).toBe(12);
  const before = jest.mocked(visitorService.getReceivedVisitorReviews).mock
    .calls.length;
  await Renderer.act(async () => {
    tree.root.findByType(RefreshControl).props.onRefresh();
  });
  await settle();
  expect(visitorService.getReceivedVisitorReviews).toHaveBeenCalledTimes(
    before + 1,
  );
  expect(dashboardService.summary).toHaveBeenCalledTimes(2);
});
test('pending statistics never display invented zero', async () => {
  jest
    .mocked(dashboardService.summary)
    .mockImplementation(() => new Promise(() => {}));
  await mount();
  const card = tree.root.findAllByType(DashboardStatCard)[0];
  expect(card.props.loading).toBe(true);
  expect(card.props.count).toBeUndefined();
});

test('failed automatic load is inline; repeated explicit retry produces one Toast and one request', async () => {
  const toast = jest.spyOn(Toast, 'show');
  jest
    .mocked(dashboardService.summary)
    .mockRejectedValue(new ApiError('private', 'network'));
  await mount();
  expect(toast).not.toHaveBeenCalled();
  for (const card of tree.root.findAllByType(DashboardStatCard)) {
    expect(card.props.error).toBe(true);
    expect(card.props.count).toBeUndefined();
  }
  const retry = tree.root.findAll(
    n => n.props.title === 'Retry dashboard counts' && n.props.onPress,
  )[0];
  await Renderer.act(async () => {
    retry.props.onPress();
    retry.props.onPress();
  });
  await settle();
  expect(dashboardService.summary).toHaveBeenCalledTimes(2);
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith({
    type: 'error',
    text1: 'Dashboard unavailable',
    text2: 'Unable to connect or request timed out. Please try again.',
  });
});
test('account switching never displays another account counters; logout removes private counts', async () => {
  await mount();
  jest.mocked(dashboardService.summary).mockResolvedValue({
    listings: { total: 1, published: 1, pending: 0, expired: 0 },
    unread_messages: 0,
    reviews_received: 0,
  });
  await Renderer.act(async () => {
    useAuthStore
      .getState()
      .setUser({ id: 9, name: 'Other', email: 'other@example.test' });
  });
  await settle();
  expect(
    tree.root.findAllByType(DashboardStatCard).map(card => card.props.count),
  ).toEqual([1, 0, 0]);
  expect(dashboardService.summary).toHaveBeenCalledTimes(2);
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
    client.clear();
  });
  await settle();
  expect(
    tree.root
      .findAllByType(DashboardStatCard)
      .every(card => card.props.count === undefined),
  ).toBe(true);
  expect(dashboardService.summary).toHaveBeenCalledTimes(2);
});
test.each(['guest', 'demo'])(
  '%s does not execute the real summary query',
  async mode => {
    useAuthStore.getState().clear();
    appConfig.uiPreviewEnabled = true;
    useDevelopmentStore.setState({ previewActive: mode === 'demo' });
    await mount();
    expect(dashboardService.summary).not.toHaveBeenCalled();
    if (mode === 'demo')
      expect(dashboardService.activeListings).toHaveBeenCalledTimes(1);
    else expect(dashboardService.activeListings).not.toHaveBeenCalled();
  },
);

test('Visitor Review displays only first three received comments without deriving the Dashboard counter', async () => {
  const items = [1, 2, 3, 4].map(id => ({
    id,
    listing: { id: 100, title: 'Listing' },
    reviewer: { id: 20 + id, display_name: 'Reviewer ' + id },
    reviewed_customer: { id: 8, display_name: 'Member' },
    rating: id,
    review: 'Received comment ' + id,
    date_time: '2026-11-16',
    created_at: null,
    updated_at: null,
  }));
  jest
    .mocked(visitorService.getReceivedVisitorReviews)
    .mockResolvedValue({
      items,
      pagination: { current_page: 1, per_page: 20, total: 22, last_page: 2 },
      nextPage: 2,
    });
  await mount();
  for (const text of [
    'Received comment 1',
    'Received comment 2',
    'Received comment 3',
  ])
    expect(
      tree.root.findAll(n => n.props.children === text).length,
    ).toBeGreaterThan(0);
  expect(
    tree.root.findAll(n => n.props.children === 'Received comment 4'),
  ).toHaveLength(0);
  expect(tree.root.findAllByType(DashboardStatCard)[1].props.count).toBe(12);
  expect(dashboardService.summary).toHaveBeenCalledTimes(1);
  expect(visitorService.getReceivedVisitorReviews).toHaveBeenCalledTimes(1);
});
test('Visitor Review pending skeleton and failed retry use existing UI and one Toast without refetching counters', async () => {
  const toast = jest.spyOn(Toast, 'show');
  let reject!: (reason: unknown) => void;
  jest.mocked(visitorService.getReceivedVisitorReviews).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  await mount();
  expect(
    tree.root.findAll(
      n => n.props.accessibilityLabel === 'Loading Visitor Review',
    ).length,
  ).toBeGreaterThan(0);
  await Renderer.act(async () => {
    reject(new ApiError('private', 'network'));
  });
  await settle();
  expect(toast).not.toHaveBeenCalled();
  jest
    .mocked(visitorService.getReceivedVisitorReviews)
    .mockRejectedValue(new ApiError('private', 'network'));
  const retry = tree.root.findAll(
    n => n.props.title === 'Retry Visitor Review' && n.props.onPress,
  )[0];
  await Renderer.act(async () => {
    retry.props.onPress();
    retry.props.onPress();
  });
  await settle();
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith({
    type: 'error',
    text1: 'Visitor Review unavailable',
    text2: 'Unable to connect or request timed out. Please try again.',
  });
  expect(dashboardService.summary).toHaveBeenCalledTimes(1);
});
