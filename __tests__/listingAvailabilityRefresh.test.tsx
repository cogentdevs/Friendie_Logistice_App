import React from 'react';
import Renderer from 'react-test-renderer';
import {
  QueryClient,
  QueryClientProvider,
  notifyManager,
} from '@tanstack/react-query';
import { useListingDetails } from '../src/features/listings/hooks/useListingDetails';
import * as service from '../src/features/listings/services/listingDetailsService';
import { useAuthStore } from '../src/store/authStore';
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => mockFocused,
}));
jest.mock('../src/features/listings/development/demoListings', () => ({
  isListingDemoMode: () => false,
}));
let current: ReturnType<typeof useListingDetails>;
function Harness() {
  current = useListingDetails('12');
  return null;
}
const base: service.ListingDetail = {
  id: 12,
  ownerId: 2,
  status: 'active',
  type: 'carry',
  title: 'Parcel',
  origin: 'A',
  destination: 'B',
  departureDate: '2030-01-01',
  category: 'Parcel',
  price: 0,
  currency: 'USD',
  availability: {
    total_kg: 12,
    reserved_kg: 5,
    committed_kg: 0,
    remaining_kg: 7,
    available: false,
  },
  requestEligibility: { eligible: false, reason: 'listing_unavailable' },
};
test('acceptance expiry is refreshed from the server while focused and stops polling off-screen', async () => {
  jest.useFakeTimers();
  mockFocused = true;
  useAuthStore.getState().clear();
  notifyManager.setScheduler(cb => cb());
  const get = jest.spyOn(service, 'getListingDetails').mockResolvedValue(base),
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  let tree!: Renderer.ReactTestRenderer;
  try {
    await Renderer.act(async () => {
      tree = Renderer.create(
        <QueryClientProvider client={client}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(current.data?.availability?.available).toBe(false);
    get.mockResolvedValue({
      ...base,
      availability: {
        total_kg: 12,
        reserved_kg: 0,
        committed_kg: 0,
        remaining_kg: 12,
        available: true,
      },
    });
    await Renderer.act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(get).toHaveBeenCalledTimes(2);
    expect(current.data?.availability?.remaining_kg).toBe(12);
    expect(current.data?.availability?.available).toBe(true);
    mockFocused = false;
    await Renderer.act(async () => {
      tree.update(
        <QueryClientProvider client={client}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    await Renderer.act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(get).toHaveBeenCalledTimes(2);
  } finally {
    await Renderer.act(async () => tree?.unmount());
    client.clear();
    get.mockRestore();
    jest.useRealTimers();
    notifyManager.setScheduler(cb => setTimeout(cb, 0));
  }
});
