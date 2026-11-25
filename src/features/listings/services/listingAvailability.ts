import { z } from 'zod';
import { useAuthStore } from '../../../store/authStore';
import { secureStorage } from '../../../services/storage/secureStorage';
import { ApiError } from '../../../types/api';
const kg = z.number().int().nonnegative().safe().nullable();
export const availabilitySchema = z
  .object({
    available: z.boolean().nullable(),
    total_kg: kg,
    reserved_kg: kg,
    committed_kg: kg,
    remaining_kg: kg,
  })
  .refine(
    v =>
      v.available === null ||
      [v.total_kg, v.reserved_kg, v.committed_kg, v.remaining_kg].every(
        n => n !== null,
      ),
  )
  .refine(
    v =>
      v.available !== true ||
      (v.reserved_kg === 0 &&
        typeof v.remaining_kg === 'number' &&
        v.remaining_kg > 0),
  )
  .optional()
  .catch(undefined);
export const eligibilitySchema = z
  .object({
    eligible: z.boolean().nullable(),
    reason: z.enum([
      'eligible',
      'authentication_required',
      'ineligible_account',
      'self_listing',
      'listing_unavailable',
      'no_eligible_complementary_listing',
      'infrastructure_unavailable',
    ]),
  })
  .refine(v =>
    v.eligible === true ? v.reason === 'eligible' : v.reason !== 'eligible',
  )
  .optional()
  .catch(undefined);
export type AvailabilityFields = {
  availability?: z.infer<typeof availabilitySchema>;
  requestEligibility?: z.infer<typeof eligibilitySchema>;
};
export function availabilityLabel(value: AvailabilityFields['availability']) {
  return value?.available === true
    ? 'Available'
    : value?.available === false
    ? 'Not Available'
    : 'Availability unknown';
}
export function remainingLabel(value: AvailabilityFields['availability']) {
  return typeof value?.remaining_kg === 'number'
    ? value.remaining_kg + ' KG remaining'
    : 'Remaining KG unavailable';
}
const reasons: Record<string, string> = {
  authentication_required: 'Please sign in again to check request eligibility.',
  ineligible_account: 'Your account is not eligible to send this request.',
  self_listing: 'You cannot request your own listing.',
  listing_unavailable: 'This listing is not available for new requests.',
  no_eligible_complementary_listing:
    'You need an available matching Send/Carry listing with enough capacity and no active request.',
  infrastructure_unavailable:
    'Requests are temporarily unavailable. Please try again later.',
};
export function availabilityRequestReason(
  detail: AvailabilityFields,
  userId?: number,
) {
  if (detail.availability?.available !== true)
    return detail.availability?.available === false
      ? reasons.listing_unavailable
      : 'Availability could not be verified. Refresh and try again.';
  if (!userId) return undefined; // Existing guest login-required action remains reachable.
  const eligibility = detail.requestEligibility;
  if (eligibility?.eligible === true && eligibility.reason === 'eligible')
    return undefined;
  return (
    (eligibility && reasons[eligibility.reason]) ||
    'Request eligibility could not be verified. Refresh and try again.'
  );
}
let revision = 0;
useAuthStore.subscribe((state, old) => {
  if (state.user !== old.user || state.status !== old.status) revision++;
});
export function availabilitySessionKey() {
  const s = useAuthStore.getState();
  return s.status === 'authenticated' && s.user
    ? 'user:' + s.user.id + ':' + revision
    : 'guest';
}
export function useAvailabilitySessionKey() {
  useAuthStore(s => s.user);
  useAuthStore(s => s.status);
  return availabilitySessionKey();
}
export async function publicListingSession(signal?: AbortSignal) {
  const state = useAuthStore.getState(),
    key = availabilitySessionKey();
  const check = () => {
    if (
      signal?.aborted ||
      availabilitySessionKey() !== key ||
      useAuthStore.getState().user !== state.user ||
      useAuthStore.getState().status !== state.status
    )
      throw new ApiError('Session changed. Reload listings.', 'cancelled');
  };
  check();
  const token =
    state.status === 'authenticated' ? await secureStorage.getToken() : null;
  check();
  return {
    headers: {
      Authorization:
        token && /^\S+$/.test(token) ? 'Bearer ' + token : (false as const),
    },
    check: async () => {
      check();
      if (
        state.status === 'authenticated' &&
        (await secureStorage.getToken()) !== token
      )
        throw new ApiError('Session changed. Reload listings.', 'cancelled');
      check();
    },
  };
}
