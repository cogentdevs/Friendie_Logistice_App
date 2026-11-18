import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { ApiError } from '../../../types/api';
import type { SearchFilters } from '../../search/store/searchStore';
import type { LocationSelection } from '../../location/types/location';
import { validDate } from '../../search/types/search';
import { isVerifiedFilterRoute } from '../../post-listing/services/listingReferencesService';

const id = z.number().int().positive().max(2147483647);
const place = z.object({
  country_id: id,
  country: z.string().nullable(),
  city_id: id,
  city: z.string().nullable(),
});
export const publicListingSchema = z.object({
  id,
  ad_type: z.enum(['Carring', 'Send']),
  title: z.string().nullable(),
  short_description: z.string().nullable(),
  image_url: z.string().url().nullable(),
  category: z.object({ id, name: z.string().nullable() }),
  origin: place,
  destination: place,
  weight: z.number().int().nonnegative().nullable(),
  weight_price: z.number().finite().nonnegative().nullable(),
  currency: z.string().nullable(),
  departure_on: z.string().nullable(),
  reached_on: z.string().nullable(),
  is_featured: z.boolean(),
  created_at: z.string().nullable(),
  owner: z.object({
    id,
    display_name: z.string().nullable(),
    image_url: z.string().url().nullable(),
  }),
  description: z.string().nullable().optional(),
});
const pagination = z.object({
  current_page: z.number().int().positive(),
  per_page: z.number().int().min(1).max(50),
  total: z.number().int().nonnegative(),
  last_page: z.number().int().positive(),
});
const pageSchema = z.object({
  success: z.literal(true),
  data: z.object({ items: z.array(publicListingSchema), pagination }),
});
const detailSchema = z.object({
  success: z.literal(true),
  data: publicListingSchema.extend({ description: z.string().nullable() }),
});
type Row = z.infer<typeof publicListingSchema>;
const label = (value: z.infer<typeof place>) =>
  [value.city, value.country].filter(Boolean).join(', ') ||
  'Location unavailable';
export function normalizePublicListing(row: Row) {
  return {
    id: row.id,
    type: row.ad_type === 'Carring' ? ('carry' as const) : ('send' as const),
    title: row.title ?? '',
    origin: label(row.origin),
    destination: label(row.destination),
    departureDate: row.departure_on ?? '',
    category: row.category.name ?? '',
    price: row.weight_price,
    currency: row.currency,
    coverImageUrl: row.image_url,
    traveller: {
      id: row.owner.id,
      name: row.owner.display_name ?? '',
      avatarUrl: row.owner.image_url,
    },
    ...(row.weight === null ? {} : { capacityKg: row.weight }),
  };
}
// Query structural sharing is disabled for detail reads so this provenance survives
// cache publication. Numeric identity or a caller-supplied flag is not proof.
const remoteDetails = new WeakMap<object, number>();
export function isVerifiedPublicListing(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    remoteDetails.has(value) &&
    remoteDetails.get(value) === (value as { id?: number }).id
  );
}
export function publicSearchParams(
  page: number,
  filters: SearchFilters,
  location: LocationSelection,
) {
  const unsupported = () => {
    throw new ApiError(
      'These search filters are not supported by the public API. Use country/city IDs, an exact date, or worldwide search.',
      'validation',
    );
  };
  if (
    location.mode !== 'worldwide' ||
    filters.verifiedOnly ||
    filters.availableNow ||
    filters.origin ||
    filters.destination
  )
    unsupported();
  if (filters.dates && filters.dates.start !== filters.dates.end) unsupported();
  if ('currency' in filters || 'sort' in filters) unsupported();
  const params: Record<string, string | number> = { page, per_page: 20 };
  const identity = (key: string, value: unknown) => {
    if (value === undefined || value === '') return;
    const parsed = id.safeParse(
      typeof value === 'number' ||
        (typeof value === 'string' && /^[1-9]\d*$/.test(value))
        ? Number(value)
        : NaN,
    );
    if (!parsed.success) unsupported();
    params[key] = Number(value);
  };
  identity('category_id', filters.category);
  identity('to_country_id', filters.destinationCountry?.id);
  for (const side of ['from', 'to'] as const) {
    const reference = filters.routeReferences?.[side];
    if (reference) {
      if (!isVerifiedFilterRoute(reference.country, reference.city))
        unsupported();
      identity(side + '_country_id', reference.country.id);
      if (reference.city) identity(side + '_city_id', reference.city.id);
      continue;
    }
    const value = filters[side];
    if (value) {
      if (!value.country.id || !value.city.id) unsupported();
      identity(side + '_country_id', value.country.id);
      identity(side + '_city_id', value.city.id);
    }
  }
  if (filters.query?.trim()) params.search = filters.query.trim();
  if (filters.type && !['send', 'carry'].includes(filters.type)) unsupported();
  if (filters.type)
    params.ad_type = filters.type === 'carry' ? 'Carring' : 'Send';
  if (filters.weightKg !== undefined) params.weight = filters.weightKg;
  const date = filters.dates?.start ?? filters.date;
  if (date) {
    if (!validDate(date)) unsupported();
    params.departure_on = date;
  }
  const valid = z
    .object({
      page: z.number().int().min(1).max(100000),
      per_page: z.number(),
      search: z.string().min(1).max(100).optional(),
      weight: z.number().int().min(0).max(2147483647).optional(),
    })
    .safeParse(params);
  if (!valid.success)
    throw new ApiError(
      'Use a search of up to 100 characters, a whole-number weight, and a valid page.',
      'validation',
    );
  return params;
}
export async function getPublicListings(
  page: number,
  filters: SearchFilters,
  location: LocationSelection,
  signal?: AbortSignal,
) {
  const response = await apiClient.get<unknown>(endpoints.listings, {
    signal,
    headers: { Authorization: false },
    params: publicSearchParams(page, filters, location),
  });
  const parsed = pageSchema.safeParse(response.data);
  if (signal?.aborted) throw new ApiError('Request cancelled.', 'cancelled');
  if (
    response.status !== 200 ||
    !parsed.success ||
    parsed.data.data.pagination.current_page !== page
  )
    throw new ApiError('Unable to read listings.', 'unknown');
  const data = parsed.data.data;
  return {
    data: data.items.map(normalizePublicListing),
    meta: data.pagination,
  };
}
export async function getPublicListingDetails(
  value: string,
  signal?: AbortSignal,
) {
  if (!/^[1-9]\d*$/.test(value) || !id.safeParse(Number(value)).success)
    throw new ApiError('Invalid listing.', 'not-found', 404);
  const response = await apiClient.get<unknown>(
    endpoints.listings + '/' + value,
    { signal, headers: { Authorization: false } },
  );
  const parsed = detailSchema.safeParse(response.data);
  if (signal?.aborted) throw new ApiError('Request cancelled.', 'cancelled');
  if (
    response.status !== 200 ||
    !parsed.success ||
    String(parsed.data.data.id) !== value
  )
    throw new ApiError('Unable to read listing.', 'unknown');
  const row = parsed.data.data;
  const result = {
    ...normalizePublicListing(row),
    ownerId: row.owner.id,
    status: 'active' as const,
    description: row.description,
    ...(row.weight === null
      ? {}
      : { weight: { value: row.weight, unit: 'kg' as const } }),
  };
  remoteDetails.set(result, result.id);
  return result;
}
