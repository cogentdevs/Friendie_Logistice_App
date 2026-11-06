import { ApiError } from '../../../types/api';
import {
  isListingDemoMode,
  getDemoListings,
} from '../../listings/development/demoListings';
import { homeDestinations } from '../data/destinations';
import { HomeAd, HomeCategory, HomeDestinationItem } from '../types/home.types';
const unavailable = (section: string): never => {
  throw new ApiError(
    `${section} is currently unavailable. Please try again later.`,
    'unknown',
  );
};
// No verified category/destination/latest/count contracts exist. These boundaries make no guessed requests.
export const homeService = {
  async categories(): Promise<HomeCategory[]> {
    if (!isListingDemoMode()) return unavailable('Categories');
    return [
      { id: 'Food Items', name: 'Food Items' },
      { id: 'Personal Items', name: 'Personal Items' },
      { id: 'Documents', name: 'Documents' },
    ];
  },
  async destinations(): Promise<HomeDestinationItem[]> {
    if (!isListingDemoMode()) return unavailable('Destinations');
    return [
      ['SA', 'Saudi Arabia'],
      ['AE', 'UAE'],
      ['PH', 'Philippines'],
      ['BH', 'Bahrain'],
      ['PK', 'Pakistan'],
      ['IN', 'India'],
    ].map(([code, name]) => ({
      country: { id: 'demo-' + code, code, name },
      photo: homeDestinations.find(d => d.code === code)?.photo,
    }));
  },
  async latest(): Promise<HomeAd[]> {
    if (!isListingDemoMode()) return unavailable('Latest ads');
    // Sample order only; production requires authoritative publication time and public-active visibility.
    return getDemoListings(1, {}, { mode: 'worldwide' }).data.slice(0, 3);
  },
  async unread(): Promise<number> {
    return unavailable('Notification count');
  },
};
