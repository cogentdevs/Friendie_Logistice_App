import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { ApiError } from '../../../types/api';
import { getOwnListingDetails } from '../../listings/services/ownListingDetailsService';
import {
  ownListingApiSchema,
  OwnListingRecord,
} from '../../listings/types/myListingsApi.types';
import { ListingDraft } from '../types/listingDraft';
import { createListingPayload } from './createListingService';
import {
  getListingReferences,
  ReferenceOption,
} from './listingReferencesService';

export type EditContext = {
  original: OwnListingRecord;
  initial: ListingDraft;
  draft?: ListingDraft;
  user: object;
  state: 'ready' | 'pending' | 'unknown' | 'confirmed';
};
const contexts = new Map<string, EditContext>();
useAuthStore.subscribe((state, previous) => {
  if (state.user !== previous.user || state.status !== previous.status)
    contexts.clear();
});
// Update the read-only preview without replacing the edit/diff snapshot.
export function refreshEditListingImage(
  id: string,
  imageUrl: string | null,
  expected?: string | null,
) {
  const context = contexts.get(id);
  if (
    context?.user === useAuthStore.getState().user &&
    (expected === undefined || context.original.image_url === expected)
  )
    context.original = { ...context.original, image_url: imageUrl };
}
export function editContext(id: string) {
  return contexts.get(id);
}
export async function loadListingEdit(
  id: string,
  signal?: AbortSignal,
): Promise<EditContext> {
  const user = useAuthStore.getState().user;
  if (!user || useAuthStore.getState().status !== 'authenticated')
    throw new ApiError('Sign in to edit your listing.', 'unauthorized', 401);
  const existing = contexts.get(id);
  if (existing?.user === user && (existing.state === 'pending' || existing.state === 'unknown' || (existing.state === 'ready' && existing.draft)))
    return existing;
  const row = (await getOwnListingDetails(id, signal)).backend;
  const fromCitiesRequest = row.from_country_id ? getListingReferences('cities', row.from_country_id, signal) : Promise.resolve([]);
  const toCitiesRequest = row.to_country_id === row.from_country_id ? fromCitiesRequest : row.to_country_id ? getListingReferences('cities', row.to_country_id, signal) : Promise.resolve([]);
  const [categories, countries, currencies, fromCities, toCities] =
    await Promise.all([
      getListingReferences('categories', undefined, signal),
      getListingReferences('countries', undefined, signal),
      getListingReferences('currencies', undefined, signal),
      fromCitiesRequest,
      toCitiesRequest,
    ]);
  if (
    signal?.aborted ||
    useAuthStore.getState().user !== user ||
    useAuthStore.getState().status !== 'authenticated'
  )
    throw new ApiError('Edit cancelled.', 'cancelled');
  const identity = (options: ReferenceOption[], value: number | null) => {
    const found = options.find(
      option => typeof option.value !== 'string' && option.value.id === value,
    )?.value;
    return typeof found === 'string' ? undefined : found;
  };
  const location = (side: 'from' | 'to', cities: ReferenceOption[]) => {
    const country = identity(countries, row[`${side}_country_id`]);
    const city = identity(cities, row[`${side}_city_id`]);
    if (!country || !city || city.countryId !== country.id) return undefined;
    return {
      source: 'api' as const,
      country,
      city: { ...city, countryId: country.id },
      ...(row[`${side}_area`] == null
        ? {}
        : { area: { name: row[`${side}_area`]! } }),
    };
  };
  const initial: ListingDraft = {
    type: row.ad_type === 'Carring' ? 'carry' : 'send',
    title: row.title ?? '',
    category: identity(categories, row.category_id),
    currency: currencies.some(option => option.value === row.currency)
      ? row.currency!
      : undefined,
    from: location('from', fromCities),
    ...(row.from_address != null ? { fromAddress: row.from_address } : {}),
    ...(row.to_address != null ? { toAddress: row.to_address } : {}),
    to: location('to', toCities),
    date: row.departure_on ?? '',
    reachedOn: row.reached_on ?? '',
    weight: row.weight == null ? '' : String(row.weight),
  };
  const context: EditContext = { original: row, initial, user, state: 'ready' };
  contexts.set(id, context);
  return context;
}
export function changedListingFields(
  context: EditContext,
  draft: ListingDraft,
) {
  const full = createListingPayload(draft);
  const intended = {
    ...full,
    weight: draft.weight.trim() ? Number(draft.weight) : null,
    from_area: draft.from?.area?.name.trim() || null,
    to_area: draft.to?.area?.name.trim() || null,
    from_address: draft.fromAddress?.trim() || null,
    to_address: draft.toAddress?.trim() || null,
  };
  // The form has no visibility control. Preserve the stored value by omission.
  const fields = intended;
  return Object.fromEntries(
    Object.entries(fields).filter(([key, value]) => {
      let previous = context.original[key as keyof OwnListingRecord];
      if (key === 'currency' && typeof previous === 'string')
        previous = previous.trim().toUpperCase();
      if (
        (key === 'from_area' || key === 'to_area' || key === 'from_address' || key === 'to_address') &&
        typeof previous === 'string'
      )
        previous = previous.trim() || null;
      if ((key === 'from_address' || key === 'to_address') && previous === undefined) previous = null;
      return key !== 'show_contact_info' && value !== previous;
    }),
  );
}
const response = z.object({
  success: z.literal(true),
  message: z.string(),
  data: ownListingApiSchema,
});
export async function updateListing(
  context: EditContext,
  draft: ListingDraft,
  signal?: AbortSignal,
) {
  const id = String(context.original.id),
    user = context.user;
  const current = () =>
    useAuthStore.getState().user === user &&
    useAuthStore.getState().status === 'authenticated' &&
    contexts.get(id) === context;
  if (!current() || signal?.aborted)
    throw new ApiError('Edit session changed.', 'cancelled');
  if (context.state !== 'ready')
    throw new ApiError(
      'Check the authoritative listing before submitting again.',
      'validation',
    );
  const payload = changedListingFields(context, draft);
  if (!Object.keys(payload).length) return null;
  context.state = 'pending';
  let dispatched = false;
  try {
    const token = await secureStorage.getToken();
    if (!current() || signal?.aborted)
      throw new ApiError('Edit cancelled.', 'cancelled');
    if (!token || !/^\S+$/.test(token)) {
      const removed = await secureStorage.removeTokenIfCurrent(token, current);
      if (removed && current()) useAuthStore.getState().clear();
      throw new ApiError('Please sign in again.', 'unauthorized', 401);
    }
    dispatched = true;
    const result = await apiClient.put<unknown>(
      `${endpoints.myListings}/${id}`,
      payload,
      { signal, headers: { Authorization: `Bearer ${token}` } },
    );
    if (
      !current() ||
      signal?.aborted ||
      (await secureStorage.getToken()) !== token
    )
      throw new ApiError('Edit session changed.', 'cancelled');
    const parsed = response.safeParse(result.data);
    if (
      result.status !== 200 ||
      !parsed.success ||
      parsed.data.data.id !== context.original.id ||
      (Object.prototype.hasOwnProperty.call(payload, 'from_address') && parsed.data.data.from_address !== payload.from_address) ||
      (Object.prototype.hasOwnProperty.call(payload, 'to_address') && parsed.data.data.to_address !== payload.to_address)
    )
      throw new ApiError('Update status could not be confirmed.', 'unknown');
    context.state = 'confirmed';
    return parsed.data.data;
  } catch (error) {
    const definite =
      error instanceof ApiError &&
      [400, 401, 403, 404, 409, 422, 429].includes(error.status ?? 0);
    context.state = !dispatched || definite ? 'ready' : 'unknown';
    // A read can establish that the intended state now exists, without
    // repeating PUT or claiming which request performed the write.
    if (
      context.state === 'unknown' &&
      current() &&
      !signal?.aborted &&
      !(error instanceof ApiError && error.kind === 'cancelled')
    ) {
      try {
        const observed = (await getOwnListingDetails(id, signal)).backend;
        if (
          current() &&
          !signal?.aborted &&
          Object.entries(payload).every(
            ([key, value]) => observed[key as keyof OwnListingRecord] === value,
          )
        ) {
          context.state = 'confirmed';
          return observed;
        }
      } catch {
        /* An inconclusive read retains the unknown hold and draft. */
      }
    }
    throw error;
  }
}
