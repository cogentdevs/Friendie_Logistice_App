import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProfileDashboard } from '../src/features/dashboard/hooks/useProfileDashboard';
import { useMyListings } from '../src/features/listings/hooks/useMyListings';
import { dashboardService } from '../src/features/dashboard/services/dashboardService';
import * as listings from '../src/features/listings/services/myListingsService';
import * as visitors from '../src/features/reviews/services/visitorReviewsService';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
test('own-list reads/refetches do not change published Dashboard count or cause extra Dashboard requests', async () => {
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
  useDevelopmentStore.setState({ previewActive: false });
  const summary = jest
    .spyOn(dashboardService, 'summary')
    .mockResolvedValue({
      listings: { total: 12, published: 4, pending: 5, expired: 3 },
      unread_messages: 1,
      reviews_received: 2,
    });
  jest
    .spyOn(listings, 'getMyListings')
    .mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 2, total: 123 },
    });
  jest
    .spyOn(visitors, 'getReceivedVisitorReviews')
    .mockResolvedValue({
      items: [],
      nextPage: null,
      pagination: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
    });
  let dashboard!: ReturnType<typeof useProfileDashboard>,
    own!: ReturnType<typeof useMyListings>,
    tree!: ReactTestRenderer;
  function Probe() {
    dashboard = useProfileDashboard();
    own = useMyListings();
    return null;
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  try {
    await Renderer.act(async () => {
      tree = Renderer.create(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      );
    });
    await Renderer.act(async () => {
      await new Promise<void>(done => setTimeout(done, 30));
    });
    expect(dashboard.active.data).toBe(4);
    await Renderer.act(async () => {
      await own.query.refetch();
    });
    await Renderer.act(async () => {
      await new Promise<void>(done => setTimeout(done, 30));
    });
    expect(dashboard.active.data).toBe(4);
    expect(summary).toHaveBeenCalledTimes(1);
  } finally {
    await Renderer.act(async () => {
      tree.unmount();
      client.clear();
    });
    jest.restoreAllMocks();
  }
});
