import {
  reviewsService,
  mapWebsiteReview,
  validateReviewPage,
  currentReviewOwner,
} from '../src/features/reviews/services/reviewsService';
import { apiClient } from '../src/services/api/apiClient';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { appConfig } from '../src/constants/appConfig';
const raw = {
  id: 1,
  from_user_id: 7,
  to_user_id: 8,
  post_ads_id: 42,
  rating: 5,
  review: 'Fixture',
  date_time: '2026-11-01',
  from_user_name: 'Author fixture',
};
const ui = appConfig.uiPreviewEnabled;
beforeEach(() => {
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
  useDevelopmentStore.setState({ previewActive: false });
});
afterEach(() => {
  jest.restoreAllMocks();
  appConfig.uiPreviewEnabled = ui;
});
test('observed website semantics map received versus authored correctly, without inventing recipient names or authorization', () => {
  const received = mapWebsiteReview(raw, 'visitors', 8, true);
  expect(received.person.name).toBe('Author fixture');
  expect(received.listing?.canOpen).toBe(false);
  const authored = mapWebsiteReview(
    { ...raw, from_user_id: 8, to_user_id: 9 },
    'your',
    8,
    true,
  );
  expect(authored.person.id).toBe(9);
  expect(authored.person.name).toBeNull();
  expect(() => mapWebsiteReview(raw, 'visitors', 8)).toThrow('visibility');
  expect(() => mapWebsiteReview(raw, 'your', 8, true)).toThrow('belong');
  expect(() =>
    mapWebsiteReview({ ...raw, rating: 9 }, 'visitors', 8, true),
  ).toThrow();
});
test('production never requests HTML web routes or guesses mobile endpoints; UI preview is isolated', async () => {
  const get = jest.spyOn(apiClient, 'get');
  await expect(reviewsService.received(8, 1)).rejects.toThrow('not connected');
  await expect(reviewsService.authored(8, 1)).rejects.toThrow('not connected');
  await expect(reviewsService.summary(8)).rejects.toThrow('unavailable');
  expect(get).not.toHaveBeenCalled();
  appConfig.uiPreviewEnabled = true;
  useDevelopmentStore.setState({ previewActive: true });
  expect(currentReviewOwner()).toBe(8);
  await expect(reviewsService.received('demo', 1)).rejects.toThrow('Sign in');
  useAuthStore.getState().clear();
  expect(currentReviewOwner()).toBe('demo');
  await expect(reviewsService.received('demo', 1)).resolves.toMatchObject({
    items: [],
    nextPage: null,
  });
  await expect(reviewsService.summary('demo')).resolves.toEqual({
    total: 0,
    averageRating: null,
  });
});
test('page validation rejects wrong-owner records, unconfirmed visibility and repeated page cursors', () => {
  const item = mapWebsiteReview(raw, 'visitors', 8, true);
  expect(() =>
    validateReviewPage(
      { items: [item], nextPage: null, visibilityConfirmed: true },
      'your',
      8,
      1,
    ),
  ).toThrow('access');
  expect(() =>
    validateReviewPage(
      { items: [item], nextPage: 1, visibilityConfirmed: true },
      'visitors',
      8,
      1,
    ),
  ).toThrow('pagination');
  expect(() =>
    validateReviewPage(
      { items: [item], nextPage: null, visibilityConfirmed: false },
      'visitors',
      8,
      1,
    ),
  ).toThrow();
  useAuthStore.getState().clear();
  expect(() =>
    validateReviewPage(
      { items: [item], nextPage: null, visibilityConfirmed: true },
      'visitors',
      8,
      1,
    ),
  ).toThrow('Sign in');
});
