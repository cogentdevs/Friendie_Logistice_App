import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { FlatList } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MyReviewsScreen } from '../src/features/reviews/screens/MyReviewsScreen';
import { ReviewsRatingSummary } from '../src/features/reviews/components/ReviewsRatingSummary';
import { reviewsService } from '../src/features/reviews/services/reviewsService';
import {
  Review,
  ReviewsTab,
} from '../src/features/reviews/types/reviews.types';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { ApiError } from '../src/types/api';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (callback: () => void) => {
    require('react').useEffect(callback, [callback]);
  },
}));
const received: Review = {
  id: 1,
  fromUserId: 7,
  toUserId: 8,
  rating: 5,
  comment: 'Received fixture feedback',
  date: '2026-11-01',
  person: { id: 7, name: 'Reviewer fixture' },
  listing: { id: 42, title: 'Fixture route', canOpen: true },
};
const authored: Review = {
  id: 2,
  fromUserId: 8,
  toUserId: 9,
  rating: 4,
  comment: 'Authored fixture feedback',
  date: '2026-11-02',
  person: { id: 9, name: 'Recipient fixture' },
};
const page = (items: Review[], nextPage: number | null = null) => ({
  items,
  nextPage,
  visibilityConfirmed: true as const,
});
let tree: ReactTestRenderer,
  client: QueryClient,
  params: {
    initialTab?: ReviewsTab;
    returnTo?: 'Profile' | 'Dashboard' | 'Home';
  };
const navigation = { navigate: jest.fn(), setParams: jest.fn() };
function render() {
  return (
    <QueryClientProvider client={client}>
      <MyReviewsScreen
        route={{ name: 'MyReviews', key: 'reviews', params }}
        navigation={
          navigation as unknown as React.ComponentProps<
            typeof MyReviewsScreen
          >['navigation']
        }
      />
    </QueryClientProvider>
  );
}
async function settle() {
  await Renderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 25));
  });
}
async function mount(initialTab?: ReviewsTab) {
  params = { initialTab, returnTo: 'Dashboard' };
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  navigation.setParams.mockImplementation(next => {
    params = { ...params, ...next };
    tree.update(render());
  });
  await Renderer.act(async () => {
    tree = Renderer.create(render());
  });
  await settle();
}
async function press(label: string) {
  await Renderer.act(async () => {
    tree.root
      .findAll(
        node =>
          node.props.accessibilityLabel === label &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
  });
  await settle();
}
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
  useDevelopmentStore.setState({ previewActive: false });
  jest.spyOn(reviewsService, 'received').mockResolvedValue(page([received]));
  jest.spyOn(reviewsService, 'authored').mockResolvedValue(page([authored]));
  jest
    .spyOn(reviewsService, 'summary')
    .mockResolvedValue({ total: 123, averageRating: 4.8 });
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client?.clear();
  });
  jest.restoreAllMocks();
});
test('two tabs use distinct datasets and authoritative aggregates; Back and authorized listing routes work', async () => {
  await mount();
  expect(
    tree.root
      .findAll(
        node => node.props.accessibilityRole === 'tab' && node.props.onPress,
      )
      .filter(
        (node, index, array) =>
          array.findIndex(
            item =>
              item.props.accessibilityLabel === node.props.accessibilityLabel,
          ) === index,
      ),
  ).toHaveLength(2);
  expect(
    tree.root.findByType(FlatList).props.data.map((item: Review) => item.id),
  ).toEqual([1]);
  expect(reviewsService.authored).not.toHaveBeenCalled();
  expect(tree.root.findByType(ReviewsRatingSummary).props.summary).toEqual({
    total: 123,
    averageRating: 4.8,
  });
  await press('View listing 42');
  expect(navigation.navigate).toHaveBeenCalledWith('MainTabs', {
    screen: 'ListingsStack',
    params: {
      screen: 'ListingDetails',
      params: { listingId: '42', returnTo: 'MyReviews' },
    },
  });
  await press('Your Reviews');
  expect(
    tree.root.findByType(FlatList).props.data.map((item: Review) => item.id),
  ).toEqual([2]);
  expect(tree.root.findAllByType(ReviewsRatingSummary)).toHaveLength(0);
  expect(
    tree.root.findByType(FlatList).props.renderItem({ item: authored }).props
      .tab,
  ).toBe('your');
  await press('Back from My Reviews');
  expect(navigation.navigate).toHaveBeenLastCalledWith('MainTabs', {
    screen: 'ProfileStack',
    params: { screen: 'ProfileDashboard' },
  });
});
test('initial authored tab avoids requesting received reviews and summary', async () => {
  await mount('your');
  expect(reviewsService.received).not.toHaveBeenCalled();
  expect(reviewsService.summary).not.toHaveBeenCalled();
  expect(
    tree.root.findByType(FlatList).props.data.map((item: Review) => item.id),
  ).toEqual([2]);
});
test('late received response never appears in the authored tab', async () => {
  let resolve!: (value: ReturnType<typeof page>) => void;
  jest.mocked(reviewsService.received).mockImplementation(
    () =>
      new Promise(r => {
        resolve = r;
      }),
  );
  await mount();
  await press('Your Reviews');
  await Renderer.act(async () => {
    resolve(page([received]));
  });
  await settle();
  expect(
    tree.root.findByType(FlatList).props.data.map((item: Review) => item.id),
  ).toEqual([2]);
});
test('pagination deduplicates records and pull-to-refresh uses the selected source', async () => {
  jest
    .mocked(reviewsService.received)
    .mockImplementation(async (_owner, p) =>
      p === 1 ? page([received], 2) : page([received, { ...received, id: 3 }]),
    );
  await mount();
  await Renderer.act(async () => {
    tree.root.findByType(FlatList).props.onEndReached();
  });
  await settle();
  expect(
    tree.root.findByType(FlatList).props.data.map((item: Review) => item.id),
  ).toEqual([1, 3]);
  const before = jest.mocked(reviewsService.received).mock.calls.length;
  await Renderer.act(async () => {
    tree.root.findByType(FlatList).props.onRefresh();
  });
  await settle();
  expect(
    jest.mocked(reviewsService.received).mock.calls.length,
  ).toBeGreaterThan(before);
  expect(reviewsService.authored).not.toHaveBeenCalled();
});
test('empty states remain separate; forbidden responses hide old records and show retry', async () => {
  jest.mocked(reviewsService.received).mockResolvedValue(page([]));
  jest.mocked(reviewsService.authored).mockResolvedValue(page([]));
  await mount();
  expect(
    tree.root.findAll(node => node.props.children === 'No Visitor Reviews Yet')
      .length,
  ).toBeGreaterThan(0);
  await press('Your Reviews');
  expect(
    tree.root.findAll(
      node => node.props.children === "You Haven't Written Any Reviews",
    ).length,
  ).toBeGreaterThan(0);
  jest
    .mocked(reviewsService.authored)
    .mockRejectedValue(new ApiError('Denied', 'forbidden', 403));
  await Renderer.act(async () => {
    tree.root.findByType(FlatList).props.onRefresh();
  });
  await settle();
  expect(tree.root.findByType(FlatList).props.data).toEqual([]);
  await press('Retry reviews');
  expect(reviewsService.authored).toHaveBeenCalled();
});
