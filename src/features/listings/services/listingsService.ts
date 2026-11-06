import {
  getDemoListings,
  isListingDemoMode,
} from '../development/demoListings';
import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { appConfig } from '../../../constants/appConfig';
import { ApiError } from '../../../types/api';
import { SearchFilters } from '../../search/store/searchStore';
import { LocationSelection } from '../../location/types/location';
import { validateLocation } from '../../location/store/locationStore';
import {
  routeLocationSchema,
  dateRangeSchema,
} from '../../search/types/search';
export const listingSchema = z.object({
  coverImageUrl: z.string().url().nullable().optional(),
  id: z.number().int().positive(),
  type: z.enum(['send', 'carry']),
  title: z.string(),
  origin: z.string(),
  destination: z.string(),
  departureDate: z.string(),
  category: z.string(),
  price: z.number().finite().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  traveller: z
    .object({
      id: z.number().int().positive(),
      name: z.string(),
      avatarUrl: z.string().url().optional().nullable(),
      verified: z.boolean().optional(),
      rating: z.number().min(0).max(5).optional().nullable(),
      reviewCount: z.number().int().nonnegative().optional(),
    })
    .optional(),
  capacityKg: z.number().nonnegative().optional(),
});
export type Listing = z.infer<typeof listingSchema>;
export const responseSchema = z.object({
  data: z.array(listingSchema),
  meta: z.object({
    total: z.number().int().nonnegative().optional(),
    current_page: z.number().int().min(1),
    last_page: z.number().int().min(0),
  }),
});
// Proposed structured request contract: confirm these keys and DTOs with Laravel before enabling.
export function buildListingSearchParams(
  page: number,
  filters: SearchFilters,
  location: LocationSelection,
) {
  const {
    from,
    to,
    dates,
    verifiedOnly,
    availableNow,
    radiusTarget,
    ...legacy
  } = filters;
  if (from) routeLocationSchema.parse(from);
  if (to) routeLocationSchema.parse(to);
  if (dates) dateRangeSchema.parse(dates);
  if (location.mode === 'radius') validateLocation(location.filter);
  return {
    page,
    ...legacy,
    ...(verifiedOnly !== undefined ? { verified_only: verifiedOnly } : {}),
    ...(availableNow !== undefined ? { available_now: availableNow } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(dates ? { date_from: dates.start, date_to: dates.end } : {}),
    ...(location.mode === 'worldwide'
      ? { worldwide: true }
      : {
          latitude: location.filter.latitude,
          longitude: location.filter.longitude,
          radiusKm: location.filter.radiusKm,
          source: location.filter.source,
          accuracyMeters: location.filter.accuracyMeters,
          ...(location.filter.source === 'manual' &&
          location.filter.centerKind !== 'pin'
            ? {
                countryId: location.filter.countryId,
                cityId: location.filter.cityId,
                areaId: location.filter.areaId,
                placeId: location.filter.placeId,
              }
            : {}),
          radius_target: radiusTarget ?? 'origin',
          distance_metric: 'straight_line',
          worldwide: false,
        }),
  };
}
export async function getListings(
  page: number,
  filters: SearchFilters,
  location: LocationSelection,
  signal?: AbortSignal,
) {
  if (isListingDemoMode()) return getDemoListings(page, filters, location);
  if (!appConfig.apiBaseUrl || !appConfig.listingsApiVerified)
    throw new ApiError(
      'Listing search is currently unavailable. Please try again later.',
      'unknown',
    );
  if (filters.weightKg !== undefined || filters.destinationCountry)
    throw new ApiError(
      'Weight and country-ID search need a verified backend filter contract. These filters have not been sent.',
      'unknown',
    );
  const { data } = await apiClient.get<unknown>(endpoints.listings, {
    signal,
    params: buildListingSearchParams(page, filters, location),
  });
  return responseSchema.parse(data);
}
