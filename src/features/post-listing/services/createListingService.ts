import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { isUiPreviewActive } from '../../../store/developmentStore';
import { ApiError } from '../../../types/api';
import { ownListingApiSchema } from '../../listings/types/myListingsApi.types';
import { ListingDraft, listingDraftSchema } from '../types/listingDraft';
import { hasVerifiedListingReferences } from './listingReferencesService';
import { useListingDraft } from '../store/listingDraftStore';
import type { OwnListingRecord } from '../../listings/types/myListingsApi.types';
import { createPinFields, ListingCoordinates, pinResponseMatches } from './listingPinPayload';

export type CreateListingRequest = ListingCoordinates & {
  ad_type: 'Carring' | 'Send';
  title: string;
  category_id: number;
  from_country_id: number;
  from_city_id: number;
  to_country_id: number;
  to_city_id: number;
  currency: string;
  departure_on: string;
  reached_on: string;
  from_area?: string;
  from_address?: string;
  to_address?: string;
  to_area?: string;
  weight?: number;
  description?: string;
  weight_price?: number;
  show_contact_info: 0;
};
const responseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: ownListingApiSchema,
});
type Submission = {
  state: 'pending' | 'unknown' | 'confirmed';
  draft: ListingDraft;
  record?: OwnListingRecord;
};
const submissions = new WeakMap<object, Submission>();
useAuthStore.subscribe((state, previous) => {
  if (
    previous.user &&
    (state.user !== previous.user || state.status !== 'authenticated')
  )
    submissions.delete(previous.user);
});
export function listingSubmission() {
  const user = useAuthStore.getState().user;
  return user ? submissions.get(user) : undefined;
}
// Only a deliberate Continue from the form starts a fresh post-success draft.
// Pending and ambiguous attempts remain held even after remount/discard.
export function beginListingDraft(draft: ListingDraft) {
  if (useListingDraft.getState().imageRecovery) return;
  const user = useAuthStore.getState().user;
  const previous = user ? submissions.get(user) : undefined;
  if (
    user &&
    previous?.state === 'confirmed' &&
    JSON.stringify(previous.draft) !== JSON.stringify(draft)
  )
    submissions.delete(user);
}
export function isConfirmedCreatedListing(record: OwnListingRecord) {
  const user = useAuthStore.getState().user;
  return (
    !!user &&
    submissions.get(user)?.record === record &&
    submissions.get(user)?.state === 'confirmed'
  );
}
export function createListingPayload(
  draft: ListingDraft,
): CreateListingRequest {
  const parsed = listingDraftSchema.safeParse(draft);
  if (!parsed.success)
    throw new ApiError(
      'Complete all required listing fields.',
      'validation',
      undefined,
      Object.fromEntries(
        parsed.error.issues.map(issue => [
          String(issue.path[0]),
          [issue.message],
        ]),
      ),
    );
  const value = parsed.data;
  if (!hasVerifiedListingReferences(value))
    throw new ApiError(
      'Select real categories, countries, cities and currency from the listing selectors.',
      'validation',
    );
  return {
    ...createPinFields(value),
    ad_type: value.type === 'carry' ? 'Carring' : 'Send',
    title: value.title!.trim(),
    category_id: value.category!.id,
    from_country_id: value.from!.country.id,
    from_city_id: value.from!.city.id,
    to_country_id: value.to!.country.id,
    to_city_id: value.to!.city.id,
    currency: value.currency!,
    departure_on: value.date,
    reached_on: value.reachedOn!,
    show_contact_info: 0,
    ...(value.fromAddress?.trim()
      ? { from_address: value.fromAddress.trim() }
      : {}),
    ...(value.toAddress?.trim() ? { to_address: value.toAddress.trim() } : {}),
    ...(value.description?.trim() ? { description: value.description } : {}),
    ...(value.weightPrice?.trim()
      ? { weight_price: Number(value.weightPrice) }
      : {}),
    ...(value.weight.trim() ? { weight: Number(value.weight) } : {}),
    ...(value.from!.area?.name.trim()
      ? { from_area: value.from!.area!.name.trim() }
      : {}),
    ...(value.to!.area?.name.trim()
      ? { to_area: value.to!.area!.name.trim() }
      : {}),
  };
}
export async function createListing(draft: ListingDraft, signal?: AbortSignal) {
  const session = useAuthStore.getState(),
    user = session.user;
  if (session.status !== 'authenticated' || !user || isUiPreviewActive())
    throw new ApiError(
      'Sign in with a real customer account to create a listing.',
      'unauthorized',
      401,
    );
  const payload = createListingPayload(draft);
  if (submissions.has(user))
    throw new ApiError(
      'A listing is already submitted, pending or awaiting confirmation. Check My Listings before continuing.',
      'validation',
    );
  const snapshot: ListingDraft = JSON.parse(JSON.stringify(draft));
  submissions.set(user, { state: 'pending', draft: snapshot });
  const current = () =>
    useAuthStore.getState().status === 'authenticated' &&
    useAuthStore.getState().user === user;
  const check = () => {
    if (!current() || signal?.aborted)
      throw new ApiError('Listing submission cancelled.', 'cancelled');
  };
  let posted = false;
  try {
    check();
    const token = await secureStorage.getToken();
    check();
    if (!token || !/^\S+$/.test(token)) {
      const removed = await secureStorage.removeTokenIfCurrent(token, current);
      check();
      if (removed) useAuthStore.getState().clear();
      throw new ApiError('Please sign in again.', 'unauthorized', 401);
    }
    posted = true;
    const response = await apiClient.post<unknown>(
      endpoints.myListings,
      payload,
      { signal, headers: { Authorization: `Bearer ${token}` } },
    );
    check();
    if ((await secureStorage.getToken()) !== token)
      throw new ApiError('Listing session changed.', 'cancelled');
    check();
    const parsed = responseSchema.safeParse(response.data);
    if (
      response.status !== 201 ||
      !parsed.success ||
      !pinResponseMatches(payload, parsed.data.data) ||
      // Current Laravel creates Published (1). Keep compatibility with the
      // previously supported Pending (0), without rewriting either server value.
      (parsed.data.data.status !== 0 && parsed.data.data.status !== 1) ||
      parsed.data.data.show_contact_info !== 0 ||
      (payload.from_address !== undefined &&
        parsed.data.data.from_address !== payload.from_address) ||
      (payload.to_address !== undefined &&
        parsed.data.data.to_address !== payload.to_address) ||
      Object.entries(payload).some(
        ([key, value]) =>
          key !== 'description' &&
          key in parsed.data.data &&
          parsed.data.data[key as keyof typeof parsed.data.data] !== value,
      )
    )
      throw new ApiError('Listing creation could not be confirmed.', 'unknown');
    submissions.set(user, {
      state: 'confirmed',
      draft: snapshot,
      record: parsed.data.data,
    });
    return parsed.data.data;
  } catch (error) {
    const rejected =
      error instanceof ApiError &&
      [400, 401, 403, 404, 409, 422, 429].includes(error.status ?? 0);
    if (current()) {
      if (!posted || rejected) submissions.delete(user);
      else submissions.set(user, { state: 'unknown', draft: snapshot });
    }
    throw error;
  }
}
export function createListingErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (!error.status && error.kind === 'validation') return error.message;
    if (error.status === 401) return 'Please sign in again.';
    if (error.status === 403)
      return 'Your account is not permitted to create this listing.';
    if (error.status === 404)
      return 'A selected listing option is no longer available.';
    if (error.status === 409)
      return 'This listing could not be created. Check My Listings.';
    if (error.status === 422)
      return 'Check the listing fields and selected locations.';
    if (error.status === 429)
      return 'Too many attempts. Please wait before trying again.';
  }
  return 'Unable to create your listing. Please try again later.';
}
