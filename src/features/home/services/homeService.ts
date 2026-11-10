import { ApiError } from '../../../types/api';
import { getDemoListings } from '../../listings/development/demoListings';
import { homeDestinations } from '../data/destinations';
import { HomeAd, HomeCategory, HomeDestinationItem } from '../types/home.types';
import {
  isStaticMarketplaceEnabled,
  StaticMarketplaceDisabledError,
} from '../../listings/development/staticMarketplace';
const requireStaticMarketplace = () => {
  if (!isStaticMarketplaceEnabled()) throw new StaticMarketplaceDisabledError();
};
const unavailable = (section: string): never => {
  throw new ApiError(
    `${section} is currently unavailable. Please try again later.`,
    'unknown',
  );
};
// No verified category/destination/latest/count contracts exist. These boundaries make no guessed requests.
export const homeService = {
  async categories(): Promise<HomeCategory[]> {
    requireStaticMarketplace();
    return [
      { id: 'Food Items', name: 'Food Items' },
      { id: 'Personal Items', name: 'Personal Items' },
      { id: 'Documents', name: 'Documents' },
    ];
  },
  async destinations(): Promise<HomeDestinationItem[]> {
    requireStaticMarketplace();
    const countries = [
      ['SA', 'Saudi Arabia'],
      ['AE', 'UAE'],
      ['PH', 'Philippines'],
      ['BH', 'Bahrain'],
      ['PK', 'Pakistan'],
      ['IN', 'India'],
    ];
    for (const destination of homeDestinations) {
      if (!countries.some(([code]) => code === destination.code))
        countries.push([destination.code, destination.country]);
    }
    return countries.map(([code, name]) => ({
      country: { id: 'demo-' + code, code, name },
      photo: homeDestinations.find(d => d.code === code)?.photo,
    }));
  },
  async latest(): Promise<HomeAd[]> {
    requireStaticMarketplace();
    // Sample order only; production requires authoritative publication time and public-active visibility.
    return getDemoListings(1, {}, { mode: 'worldwide' }).data.slice(0, 3);
  },
  async unread(): Promise<number> {
    return unavailable('Notification count');
  },
};
