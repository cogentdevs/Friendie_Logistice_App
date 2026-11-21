import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { ApiError } from '../../../types/api';
import { getCategories } from '../../home/services/categoriesService';
import type { ListingDraft } from '../types/listingDraft';

export type ReferenceKind =
  | 'categories'
  | 'countries'
  | 'cities'
  | 'currencies';
export type ListingReference = { id: number; name: string; countryId?: number };
export type ReferenceOption = {
  shortName?: string;
  key: string;
  label: string;
  value: ListingReference | string;
};
const id = z.number().int().min(1).max(2147483647);
const place = z.object({
  id,
  name: z.string().nullable(),
  short_name: z.string().nullable(),
});
const schemas = {
  countries: place.extend({ image_url: z.string().nullable() }),
  cities: place.extend({ country_id: id }),
  currencies: z.object({ code: z.string().nullable() }),
};
// Only IDs returned by real reference reads are eligible for creation. No
// marketplace fixtures or free-text IDs are registered here.
const verified = {
  categories: new Set<number>(),
  countries: new Set<number>(),
  cities: new Map<number, number>(),
  currencies: new Set<string>(),
};
export async function getListingReferences(
  kind: ReferenceKind,
  countryId?: number,
  signal?: AbortSignal,
): Promise<ReferenceOption[]> {
  if (kind === 'categories') {
    const rows = await getCategories(signal);
    return rows.map(row => {
      const key = Number(row.id);
      if (!id.safeParse(key).success)
        throw new ApiError('Invalid category data.', 'unknown');
      verified.categories.add(key);
      return {
        key: row.id,
        label: row.name,
        value: { id: key, name: row.name },
      };
    });
  }
  if (kind === 'cities' && !id.safeParse(countryId).success)
    throw new ApiError('Select a country first.', 'validation');
  const response = await apiClient.get<unknown>(endpoints[kind], {
    signal,
    headers: { Authorization: false },
    ...(kind === 'cities' ? { params: { country_id: countryId } } : {}),
  });
  if (signal?.aborted) throw new ApiError('Request cancelled.', 'cancelled');
  const envelope = z
    .object({
      success: z.literal(true),
      message: z.string(),
      data: z.object({ items: z.array(schemas[kind]) }),
    })
    .safeParse(response.data);
  if (response.status !== 200 || !envelope.success)
    throw new ApiError('Unable to read listing options.', 'unknown');
  const options: ReferenceOption[] = [];
  for (const raw of envelope.data.data.items) {
    if ('code' in raw) {
      if (!raw.code?.trim() || raw.code.length > 11) continue;
      verified.currencies.add(raw.code);
      options.push({ key: raw.code, label: raw.code, value: raw.code });
    } else if (raw.name?.trim()) {
      if ('country_id' in raw && raw.country_id !== countryId)
        throw new ApiError(
          'City does not belong to the selected country.',
          'unknown',
        );
      const country = 'country_id' in raw ? raw.country_id : undefined;
      if (country) verified.cities.set(raw.id, country);
      else verified.countries.add(raw.id);
      options.push({
        key: String(raw.id),
        label: raw.name,
        ...(raw.short_name ? { shortName: raw.short_name } : {}),
        value: {
          id: raw.id,
          name: raw.name,
          ...(country ? { countryId: country } : {}),
        },
      });
    }
  }
  return options;
}
export function hasVerifiedListingReferences(draft: ListingDraft) {
  return (
    !!draft.category &&
    verified.categories.has(draft.category.id) &&
    !!draft.currency &&
    verified.currencies.has(draft.currency) &&
    [draft.from, draft.to].every(
      value =>
        value?.source === 'api' &&
        verified.countries.has(value.country.id) &&
        verified.cities.get(value.city.id) === value.country.id &&
        value.city.countryId === value.country.id,
    )
  );
}

// Public filters reuse the same authoritative reference reads and relationship checks.
export function isVerifiedFilterRoute(
  country: ListingReference,
  city?: ListingReference,
) {
  return (
    verified.countries.has(country.id) &&
    (!city ||
      (city.countryId === country.id &&
        verified.cities.get(city.id) === country.id))
  );
}
