import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { ApiError } from '../../../types/api';
import { categorySchema } from './categoriesService';
import {
  publicListingSchema,
  normalizePublicListing,
} from '../../listings/services/publicListingsService';
import { HomeAd, HomeCategory } from '../types/home.types';
import { StaticMarketplaceDisabledError } from '../../listings/development/staticMarketplace';

const responseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    categories: z.array(categorySchema.extend({ name: z.string().nullable() })),
    featured_listings: z.array(publicListingSchema),
    latest_listings: z.array(publicListingSchema),
  }),
});
export type HomeData = {
  categories: HomeCategory[];
  featured: HomeAd[];
  latest: HomeAd[];
};
export class HomeLocationsUnavailableError extends StaticMarketplaceDisabledError {
  constructor() {
    super();
    this.message = 'Popular locations are not provided by the Home API.';
  }
}
export async function getHome(signal?: AbortSignal): Promise<HomeData> {
  const response = await apiClient.get<unknown>(endpoints.home, {
    signal,
    headers: { Authorization: false },
  });
  if (signal?.aborted)
    throw new ApiError('Home request cancelled.', 'cancelled');
  const parsed = responseSchema.safeParse(response.data);
  if (response.status !== 200 || !parsed.success)
    throw new ApiError('Unable to read Home data.', 'unknown');
  const data = parsed.data.data;
  return {
    categories: data.categories.map(row => ({
      id: String(row.id),
      name: row.name ?? '',
      ...(row.image_url ? { imageUrl: row.image_url } : {}),
    })),
    featured: data.featured_listings.map(normalizePublicListing),
    latest: data.latest_listings.map(normalizePublicListing),
  };
}
