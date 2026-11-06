import { reviewsService } from '../src/features/reviews/services/reviewsService';
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
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
  jest.spyOn(dashboardService, 'activeListings').mockResolvedValue(0);
  jest
    .spyOn(reviewsService, 'summary')
    .mockResolvedValue({ total: 12, averageRating: 4.5 });
  jest.spyOn(dashboardService, 'newMessages').mockResolvedValue(3);
  jest
    .spyOn(reviewsService, 'received')
    .mockResolvedValue({
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
});
test('exactly three confirmed metrics, empty visitor state and correct destinations', async () => {
  await mount();
  const cards = tree.root.findAllByType(DashboardStatCard);
  expect(cards.map(c => [c.props.label, c.props.count])).toEqual([
    ['Active Listing', 0],
    ['Total Reviews', 12],
    ['New Messages', 3],
  ]);
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
test('partial failure keeps available counts and refresh retries all resources', async () => {
  jest.mocked(reviewsService.summary).mockRejectedValue(new Error('offline'));
  jest.mocked(reviewsService.received).mockRejectedValue(new Error('offline'));
  await mount();
  const cards = tree.root.findAllByType(DashboardStatCard);
  expect(cards[0].props.count).toBe(0);
  expect(cards[1].props.error).toBe(true);
  expect(cards[1].props.count).toBeUndefined();
  const before = jest.mocked(reviewsService.received).mock.calls.length;
  await Renderer.act(async () => {
    tree.root.findByType(RefreshControl).props.onRefresh();
  });
  await settle();
  expect(reviewsService.received).toHaveBeenCalledTimes(before + 1);
});
test('pending statistics never display invented zero', async () => {
  jest
    .mocked(dashboardService.activeListings)
    .mockImplementation(() => new Promise(() => {}));
  await mount();
  const card = tree.root.findAllByType(DashboardStatCard)[0];
  expect(card.props.loading).toBe(true);
  expect(card.props.count).toBeUndefined();
});
