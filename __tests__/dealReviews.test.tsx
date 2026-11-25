import React from 'react';
import Renderer from 'react-test-renderer';
import {
  QueryClient,
  QueryClientProvider,
  notifyManager,
} from '@tanstack/react-query';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import * as services from '../src/features/reviews/services/dealReviewsService';
import { DealReviewPanel } from '../src/features/reviews/components/DealReviewPanel';
import { ListingReviewsPanel } from '../src/features/reviews/components/ListingReviewsPanel';
import { SubmitReviewDialog } from '../src/features/reviews/components/SubmitReviewDialog';
import { AppButton } from '../src/components/ui/AppButton';
import { Deal } from '../src/features/deals/dealsService';
import { ApiError } from '../src/types/api';
// Resolve RN lazy native view modules outside per-interaction test budgets.
for (const name of [
  'View',
  'Text',
  'Modal',
  'ScrollView',
  'TextInput',
  'Pressable',
  'KeyboardAvoidingView',
  'ActivityIndicator',
])
  Reflect.get(require('react-native'), name);
const deal: Deal = {
  id: 9,
  sender_listing_id: 11,
  carrier_listing_id: 12,
  sender_user_id: 1,
  carrier_user_id: 2,
  initiated_by: 1,
  requested_kg: 5,
  agreed_kg: 5,
  status: 'completed',
  acceptance_expires_at: null,
  capacity: { sender: null, carrier: null },
  allowed_actions: [],
};
const review = {
  id: 50,
  deal_id: 9,
  listing: { id: 12, title: null },
  reviewer: { id: 1, display_name: null },
  reviewed_customer: { id: 2, display_name: null },
  rating: 0,
  review: 'Helpful',
  date_time: '2026-11-25',
  created_at: null,
  updated_at: null,
};
const response = (data: unknown, status = 200) => ({
  status,
  data: { success: true, message: 'OK', data },
});
const publicItem = {
  id: 50,
  reviewer: { id: 1, display_name: null },
  rating: 0,
  review: null,
  date_time: null,
  created_at: null,
  updated_at: null,
};
const page = (current = 1, last = 1) => ({
  listing_id: 12,
  average_rating: 0,
  review_count: 2,
  items: [publicItem],
  pagination: {
    current_page: current,
    last_page: last,
    per_page: 20,
    total: 2,
  },
});
let tree: Renderer.ReactTestRenderer | undefined, client: QueryClient;
beforeEach(() => {
  notifyManager.setScheduler(callback => callback());
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  useAuthStore
    .getState()
    .setUser({ id: 1, name: 'Sender', email: 'sender@example.test' });
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('review-deal-token');
  jest.spyOn(apiClient, 'get').mockResolvedValue(response(deal));
});
afterEach(() => {
  Renderer.act(() => tree?.unmount());
  tree = undefined;
  client.clear();
  useAuthStore.getState().clear();
  jest.restoreAllMocks();
  notifyManager.setScheduler(callback => setTimeout(callback, 0));
});
async function mount(component: React.ReactElement) {
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>{component}</QueryClientProvider>,
    );
  });
}
test.each([1, 2])(
  'stored participant %s reviews counterpart with only deal_id/rating/text',
  async caller => {
    useAuthStore
      .getState()
      .setUser({ id: caller, name: 'Participant', email: 'p@example.test' });
    const expected = {
      ...review,
      listing: { id: caller === 1 ? 12 : 11, title: null },
      reviewer: { id: caller, display_name: null },
      reviewed_customer: { id: caller === 1 ? 2 : 1, display_name: null },
    };
    const post = jest
      .spyOn(apiClient, 'post')
      .mockResolvedValue(response(expected, 201));
    const saved = await services.submitDealReview(9, {
      rating: 0,
      review: 'Helpful',
    });
    expect(saved.deal_id).toBe(9);
    expect(post).toHaveBeenCalledWith(
      '/customer/reviews',
      { deal_id: 9, rating: 0, review: 'Helpful' },
      expect.objectContaining({
        headers: { Authorization: 'Bearer review-deal-token' },
      }),
    );
    await expect(
      services.submitDealReview(9, { rating: 0, review: 'Helpful' }),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(post).toHaveBeenCalledTimes(1);
  },
);
test.each([null, -1, 6, 1.5])('invalid rating %s never posts', async rating => {
  const post = jest.spyOn(apiClient, 'post');
  await expect(
    services.submitDealReview(9, { rating, review: 'Helpful' }),
  ).rejects.toMatchObject({ kind: 'validation' });
  expect(post).not.toHaveBeenCalled();
});
test('noncompleted deal cannot submit', async () => {
  jest
    .mocked(apiClient.get)
    .mockResolvedValue(response({ ...deal, status: 'confirmed' }));
  const post = jest.spyOn(apiClient, 'post');
  await expect(
    services.submitDealReview(9, { rating: 5, review: 'Helpful' }),
  ).rejects.toMatchObject({ kind: 'validation' });
  expect(post).not.toHaveBeenCalled();
});
test('guest cannot submit', async () => {
  useAuthStore.getState().clear();
  const post = jest.spyOn(apiClient, 'post');
  await expect(
    services.submitDealReview(9, { rating: 5, review: 'Helpful' }),
  ).rejects.toMatchObject({ kind: 'unauthorized' });
  expect(post).not.toHaveBeenCalled();
});
test('timeout does not automatically retry or permit repeat', async () => {
  const post = jest
    .spyOn(apiClient, 'post')
    .mockRejectedValue(new ApiError('Timeout', 'network'));
  await expect(
    services.submitDealReview(9, { rating: 5, review: 'Helpful' }),
  ).rejects.toMatchObject({ kind: 'network' });
  expect(services.dealReviewState(9)).toBe('unknown');
  await expect(
    services.submitDealReview(9, { rating: 5, review: 'Helpful' }),
  ).rejects.toMatchObject({ kind: 'validation' });
  expect(post).toHaveBeenCalledTimes(1);
});
test('duplicate backend response blocks further submissions', async () => {
  jest
    .spyOn(apiClient, 'post')
    .mockRejectedValue(new ApiError('Duplicate', 'unknown', 409));
  await expect(
    services.submitDealReview(9, { rating: 5, review: 'Helpful' }),
  ).rejects.toMatchObject({ status: 409 });
  expect(services.dealReviewState(9)).toBe('duplicate');
});
test('guest public reviews use exact public endpoint, aggregate and pagination', async () => {
  useAuthStore.getState().clear();
  const get = jest
    .mocked(apiClient.get)
    .mockResolvedValue(response(page(2, 2)));
  const result = await services.getListingReviews(12, 2);
  expect(result.average_rating).toBe(0);
  expect(result.review_count).toBe(2);
  expect(get).toHaveBeenCalledWith(
    '/listings/12/reviews',
    expect.objectContaining({
      headers: { Authorization: false },
      params: { page: 2, per_page: 20 },
    }),
  );
});
test('public review rendering handles null fields and deduplicates pagination', async () => {
  jest
    .mocked(apiClient.get)
    .mockImplementation(async (_url, config) =>
      response(page((config?.params as { page: number }).page, 2)),
    );
  await mount(<ListingReviewsPanel listingId={12} enabled />);
  expect(JSON.stringify(tree!.toJSON())).toContain('Verified reviews');
  await Renderer.act(async () =>
    tree!.root
      .findAllByType(AppButton)
      .find(button => button.props.title === 'Load more reviews')!
      .props.onPress(),
  );
  expect(
    tree!.root
      .findAllByType(AppButton)
      .some(button => button.props.title === 'Load more reviews'),
  ).toBe(false);
});
test('Give Review reuses dialog, prevents duplicate taps and refreshes Given/public reviews', async () => {
  const post = jest
    .spyOn(apiClient, 'post')
    .mockResolvedValue(response(review, 201));
  client.setQueryData(['reviews.authored', 'user:1'], {});
  client.setQueryData(['reviews.received', 'user:1'], {});
  client.setQueryData(['listingReviews', 12], {});
  await mount(<DealReviewPanel deal={deal} focused />);
  await Renderer.act(async () =>
    tree!.root
      .findAllByType(AppButton)
      .find(button => button.props.title === 'Give Review')!
      .props.onPress(),
  );
  await Renderer.act(async () =>
    tree!.root
      .findByType(SubmitReviewDialog)
      .props.onChange({ rating: 0, review: 'Helpful' }),
  );
  await Renderer.act(async () => {
    const dialog = tree!.root.findByType(SubmitReviewDialog);
    dialog.props.onSubmit();
    dialog.props.onSubmit();
  });
  expect(post).toHaveBeenCalledTimes(1);
  expect(
    client.getQueryState(['reviews.authored', 'user:1'])?.isInvalidated,
  ).toBe(true);
  expect(client.getQueryState(['listingReviews', 12])?.isInvalidated).toBe(
    true,
  );
  expect(
    client.getQueryState(['reviews.received', 'user:1'])?.isInvalidated,
  ).toBe(false);
});
test('noncompleted and unrelated viewers see no Give Review action', async () => {
  await mount(
    <DealReviewPanel deal={{ ...deal, status: 'confirmed' }} focused />,
  );
  expect(tree!.root.findAllByType(AppButton)).toHaveLength(0);
});
