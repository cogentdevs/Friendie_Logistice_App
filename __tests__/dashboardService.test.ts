import {
  dashboardService,
  dashboardIsDemo,
} from '../src/features/dashboard/services/dashboardService';
import * as listings from '../src/features/listings/services/myListingsService';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { appConfig } from '../src/constants/appConfig';
import { apiClient } from '../src/services/api/apiClient';
const previous = appConfig.uiPreviewEnabled;
beforeEach(() => {
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
  useDevelopmentStore.setState({ previewActive: false });
});
afterEach(() => {
  jest.restoreAllMocks();
  appConfig.uiPreviewEnabled = previous;
});
test.each([0, 12])(
  'uses authoritative active total %s, never current page length',
  async total => {
    jest
      .spyOn(listings, 'getMyListings')
      .mockResolvedValue({
        data: [],
        meta: { current_page: 1, last_page: 2, total },
      });
    await expect(dashboardService.activeListings()).resolves.toBe(total);
    expect(listings.getMyListings).toHaveBeenCalledWith('active', 1, undefined);
  },
);
test('unknown count remains unknown and conflicting totals fail', async () => {
  jest
    .spyOn(listings, 'getMyListings')
    .mockResolvedValueOnce({
      data: [],
      meta: { current_page: 1, last_page: 1 },
    })
    .mockResolvedValueOnce({
      data: [],
      meta: { current_page: 1, last_page: 1, total: 3, counts: { active: 4 } },
    });
  await expect(dashboardService.activeListings()).resolves.toBeNull();
  await expect(dashboardService.activeListings()).rejects.toThrow('confirm');
});
test('unverified metrics do not guess endpoints or substitute other metrics', async () => {
  const get = jest.spyOn(apiClient, 'get');
  await expect(dashboardService.totalReviews()).rejects.toThrow('unavailable');
  await expect(dashboardService.newMessages()).rejects.toThrow('unavailable');
  await expect(dashboardService.visitorReview()).rejects.toThrow('unavailable');
  expect(get).not.toHaveBeenCalled();
});
test('visitor empty preview is isolated from real authenticated accounts', async () => {
  appConfig.uiPreviewEnabled = true;
  useDevelopmentStore.setState({ previewActive: true });
  expect(dashboardIsDemo()).toBe(false);
  await expect(dashboardService.visitorReview()).rejects.toThrow('unavailable');
  useAuthStore.getState().clear();
  expect(dashboardIsDemo()).toBe(true);
  await expect(dashboardService.visitorReview()).resolves.toEqual({
    records: [],
  });
});
test('guest cannot read dashboard data', async () => {
  useAuthStore.getState().clear();
  await expect(dashboardService.activeListings()).rejects.toThrow('Sign in');
});
