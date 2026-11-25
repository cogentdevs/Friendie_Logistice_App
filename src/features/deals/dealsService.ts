import { z } from 'zod';
import { apiClient } from '../../services/api/apiClient';
import { endpoints } from '../../services/api/endpoints';
import { secureStorage } from '../../services/storage/secureStorage';
import { useAuthStore } from '../../store/authStore';
import { ApiError } from '../../types/api';
import {
  getPublicListingDetails,
  verifiedPublicListingRecord,
} from '../listings/services/publicListingsService';
import { getOwnListingsPage } from '../listings/services/myListingsApiService';
import type { QueryClient } from '@tanstack/react-query';
import { revokeDealAccess } from './dealAccessEvents';

const id = z.number().int().positive().max(2147483647);
export const capacitySchema = z.object({
  total_kg: z.number().int().nonnegative(),
  reserved_kg: z.number().int().nonnegative(),
  committed_kg: z.number().int().nonnegative(),
  remaining_kg: z.number().int().nonnegative(),
  available: z.boolean(),
});
export const actionSchema = z.enum([
  'accept',
  'reject',
  'confirm',
  'cancel',
  'pickup',
  'complete',
]);
export type DealAction = z.infer<typeof actionSchema>;
const historySide = z.object({
  user: z.object({ id, display_name: z.string().nullable() }),
  listing: z.object({
    id,
    title: z.string().nullable(),
    ad_type: z.enum(['Send', 'Carring']).nullable(),
    weight_kg: z.number().int().nonnegative().nullable(),
    route: z.object({
      from_country_name: z.string().nullable().optional(),
      from_city_name: z.string().nullable().optional(),
      to_country_name: z.string().nullable().optional(),
      to_city_name: z.string().nullable().optional(),
      from_country_id: id.nullable(),
      from_city_id: id.nullable(),
      to_country_id: id.nullable(),
      to_city_id: id.nullable(),
    }),
  }),
});
const timestamp = z
  .string()
  .refine(value => Number.isFinite(Date.parse(value)))
  .nullable()
  .optional();
export const dealSchema = z.object({
  id,
  sender_listing_id: id,
  carrier_listing_id: id,
  sender_user_id: id,
  carrier_user_id: id,
  initiated_by: id,
  requested_kg: id,
  agreed_kg: id,
  status: z.enum([
    'pending',
    'accepted',
    'rejected',
    'cancelled',
    'confirmed',
    'expired',
    'completed',
  ]),
  acceptance_expires_at: z.string().nullable(),
  picked_up_at: timestamp,
  completed_at: timestamp,
  confirmed_at: timestamp,
  accepted_at: timestamp,
  created_at: timestamp,
  history: z.object({ sender: historySide, carrier: historySide }).optional(),
  conversation_id: z.number().int().positive().nullable().optional(),
  capacity: z.object({
    sender: capacitySchema.nullable(),
    carrier: capacitySchema.nullable(),
  }),
  allowed_actions: z.array(actionSchema),
});
export type Deal = z.infer<typeof dealSchema>;
const envelope = z.object({
  success: z.literal(true),
  message: z.string(),
  data: dealSchema,
});
const pageSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(dealSchema),
    pagination: z.object({
      current_page: id,
      last_page: id,
      per_page: z.number().int().min(1).max(50),
      total: z.number().int().nonnegative(),
    }),
  }),
});
let flights = new Set<string>();
let uncertain = new Set<string>();
useAuthStore.subscribe((state, previous) => {
  if (state.user !== previous.user || state.status !== previous.status) {
    flights = new Set();
    uncertain = new Set();
  }
});
export class UncertainDealError extends Error {}
export function dealErrorMessage(error: unknown) {
  if (error instanceof UncertainDealError)
    return 'Delivery is uncertain. Check your requests before taking further action. Do not resend this request.';
  if (error instanceof ApiError) {
    if (error.status === 409)
      return 'This request or capacity has changed. Refresh and check its current status.';
    if (error.status === 503) return 'Deal management is not available yet.';
    if (error.kind === 'unauthorized') return 'Please sign in again.';
    if (error.kind === 'forbidden' || error.kind === 'not-found')
      return 'This deal or listing is not available to your account.';
    if (error.kind === 'rate-limit')
      return 'Too many attempts. Please try again later.';
    if (error.kind === 'validation')
      return 'Check the selected listings and whole-KG parcel weight.';
  }
  return 'Unable to load or update requests. Check your connection and try again.';
}
async function session(signal?: AbortSignal) {
  const user = useAuthStore.getState().user;
  const check = () => {
    if (signal?.aborted || useAuthStore.getState().user !== user)
      throw new ApiError('Session changed.', 'cancelled');
    if (!user || useAuthStore.getState().status !== 'authenticated')
      throw new ApiError('Please sign in.', 'unauthorized', 401);
  };
  check();
  const token = await secureStorage.getToken();
  check();
  if (!token || !/^\S+$/.test(token)) {
    const removed = await secureStorage.removeTokenIfCurrent(
      token,
      () => useAuthStore.getState().user === user,
    );
    check();
    if (removed) useAuthStore.getState().clear();
    throw new ApiError('Please sign in.', 'unauthorized', 401);
  }
  return {
    user: user!,
    check: async () => {
      check();
      if ((await secureStorage.getToken()) !== token)
        throw new ApiError('Session changed.', 'cancelled');
      check();
    },
    config: { signal, headers: { Authorization: `Bearer ${token}` } },
  };
}
function participant(deal: Deal, owner: number) {
  if (![deal.sender_user_id, deal.carrier_user_id].includes(owner))
    throw new ApiError('Invalid deal response.', 'unknown');
  return deal;
}
export async function getDeals(
  page = 1,
  signal?: AbortSignal,
  status?: 'pending' | 'completed',
) {
  id.max(100000).parse(page);
  if (status !== undefined) z.enum(['pending', 'completed']).parse(status);
  const auth = await session(signal);
  const response = await apiClient.get(endpoints.deals, {
    ...auth.config,
    params: { page, per_page: 20, ...(status ? { status } : {}) },
  });
  await auth.check();
  const parsed = pageSchema.safeParse(response.data);
  if (
    response.status !== 200 ||
    !parsed.success ||
    parsed.data.data.pagination.current_page !== page ||
    parsed.data.data.pagination.per_page !== 20
  )
    throw new ApiError('Invalid request page.', 'unknown');
  parsed.data.data.items.forEach(deal => participant(deal, auth.user.id));
  return parsed.data.data;
}
export async function getDeal(value: number, signal?: AbortSignal) {
  id.parse(value);
  const auth = await session(signal);
  const response = await apiClient.get(
    `${endpoints.deals}/${value}`,
    auth.config,
  );
  await auth.check();
  const parsed = envelope.safeParse(response.data);
  if (
    response.status !== 200 ||
    !parsed.success ||
    parsed.data.data.id !== value
  )
    throw new ApiError('Invalid deal.', 'unknown');
  const result = participant(parsed.data.data, auth.user.id);
  uncertain.delete(`${auth.user.id}:${value}`);
  return result;
}
export async function requestCandidates(
  target: object,
  page: number,
  signal?: AbortSignal,
) {
  const row = verifiedPublicListingRecord(target);
  if (!row)
    throw new ApiError('A real public listing is required.', 'validation');
  const result = await getOwnListingsPage(
    page,
    { status: 1, ad_type: row.ad_type === 'Send' ? 'Carring' : 'Send' },
    signal,
  );
  return {
    ...result,
    items: result.items.filter(
      item =>
        item.from_country_id === row.origin.country_id &&
        item.from_city_id === row.origin.city_id &&
        item.to_country_id === row.destination.country_id &&
        item.to_city_id === row.destination.city_id &&
        item.weight !== null &&
        item.weight > 0,
    ),
  };
}
export async function verifyCandidate(
  target: object,
  candidateId: number,
  signal?: AbortSignal,
) {
  const auth = await session(signal);
  const targetRow = verifiedPublicListingRecord(target);
  const candidate = await getPublicListingDetails(
    String(id.parse(candidateId)),
    signal,
  );
  await auth.check();
  const row = verifiedPublicListingRecord(candidate)!;
  if (
    !targetRow ||
    targetRow.availability?.available !== true ||
    targetRow.request_eligibility?.eligible !== true ||
    row.availability?.available !== true ||
    !targetRow.weight ||
    !row.weight ||
    targetRow.owner.id === auth.user.id ||
    row.owner.id !== auth.user.id ||
    targetRow.ad_type === row.ad_type ||
    (['country_id', 'city_id'] as const).some(
      key =>
        targetRow.origin[key] !== row.origin[key] ||
        targetRow.destination[key] !== row.destination[key],
    )
  )
    throw new ApiError(
      'Complementary listings with the same route are required.',
      'validation',
    );
  return candidate;
}
export async function createDeal(
  target: object,
  selected: object,
  signal?: AbortSignal,
) {
  const row = verifiedPublicListingRecord(target),
    own = verifiedPublicListingRecord(selected);
  if (!row || !own)
    throw new ApiError('Verified remote listings are required.', 'validation');
  const auth = await session(signal);
  if (
    row.availability?.available !== true ||
    row.request_eligibility?.eligible !== true ||
    own.availability?.available !== true
  )
    throw new ApiError(
      'Refresh availability and request eligibility before submitting.',
      'validation',
    );
  if (
    own.owner.id !== auth.user.id ||
    row.owner.id === auth.user.id ||
    row.ad_type === own.ad_type ||
    row.origin.country_id !== own.origin.country_id ||
    row.origin.city_id !== own.origin.city_id ||
    row.destination.country_id !== own.destination.country_id ||
    row.destination.city_id !== own.destination.city_id
  )
    throw new ApiError('Invalid listing pair.', 'validation');
  const sender = row.ad_type === 'Send' ? row : own,
    carrier = row.ad_type === 'Carring' ? row : own;
  const body = {
    sender_listing_id: sender.id,
    carrier_listing_id: carrier.id,
    requested_kg: id.parse(sender.weight),
  };
  return mutate('create', `${sender.id}:${carrier.id}`, body, auth);
}
export async function actOnDeal(
  deal: Deal,
  action: DealAction,
  signal?: AbortSignal,
) {
  actionSchema.parse(action);
  id.parse(deal.id);
  if (
    !deal.allowed_actions.includes(action) ||
    (action === 'cancel' && !!deal.picked_up_at)
  )
    throw new ApiError('Action unavailable.', 'validation');
  const auth = await session(signal);
  participant(deal, auth.user.id);
  return mutate(
    action,
    String(deal.id),
    action === 'pickup' || action === 'complete' ? {} : undefined,
    auth,
  );
}
async function mutate(
  action: DealAction | 'create',
  key: string,
  body: unknown,
  auth: Awaited<ReturnType<typeof session>>,
) {
  const guard = `${auth.user.id}:${key}`;
  const activeFlights = flights,
    blocked = uncertain;
  if (activeFlights.has(guard))
    throw new ApiError('Request already in progress.', 'validation');
  if (blocked.has(guard)) throw new UncertainDealError();
  activeFlights.add(guard);
  try {
    const response = await apiClient.post(
      action === 'create'
        ? endpoints.deals
        : `${endpoints.deals}/${key}/${action}`,
      body,
      auth.config,
    );
    await auth.check();
    const parsed = envelope.safeParse(response.data);
    if (
      response.status !== (action === 'create' ? 201 : 200) ||
      !parsed.success ||
      (action !== 'create' &&
        !(action === 'pickup' && parsed.data.data.status === 'completed') &&
        parsed.data.data.status !==
          (
            {
              accept: 'accepted',
              reject: 'rejected',
              confirm: 'confirmed',
              cancel: 'cancelled',
              pickup: 'confirmed',
              complete: 'completed',
            } as const
          )[action]) ||
      ((action === 'pickup' || action === 'complete') &&
        !parsed.data.data.picked_up_at) ||
      (action === 'complete' && !parsed.data.data.completed_at) ||
      (action !== 'create' && String(parsed.data.data.id) !== key) ||
      (action === 'create' &&
        (`${parsed.data.data.sender_listing_id}:${parsed.data.data.carrier_listing_id}` !==
          key ||
          parsed.data.data.initiated_by !== auth.user.id ||
          parsed.data.data.requested_kg !==
            (body as { requested_kg: number }).requested_kg))
    ) {
      blocked.add(guard);
      throw new UncertainDealError();
    }
    const result = participant(parsed.data.data, auth.user.id);
    if (
      action === 'cancel' ||
      action === 'reject' ||
      result.status === 'completed'
    )
      revokeDealAccess(result.id);
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.kind === 'cancelled') {
      blocked.add(guard);
      throw error;
    }
    if (
      error instanceof UncertainDealError ||
      !(error instanceof ApiError) ||
      error.kind === 'network' ||
      error.kind === 'server' ||
      (error.kind === 'unknown' && error.status === undefined)
    ) {
      blocked.add(guard);
      throw new UncertainDealError();
    }
    throw error;
  } finally {
    activeFlights.delete(guard);
  }
}
export async function refreshDealData(client: QueryClient, deal?: Deal) {
  const owner = useAuthStore.getState().user;
  const current = () =>
    !!owner &&
    useAuthStore.getState().user === owner &&
    useAuthStore.getState().status === 'authenticated';
  if (!current()) return;
  const affected = (value: unknown) =>
    !deal ||
    [deal.sender_listing_id, deal.carrier_listing_id].some(
      listing => String(listing) === String(value),
    );
  const predicate = (query: { queryKey: readonly unknown[] }) => {
    if (!current()) return false;
    const key = query.queryKey;
    return (
      (['deals', 'deal', 'dealCandidates', 'notifications'].includes(
        String(key[0]),
      ) &&
        key[1] === owner!.id) ||
      (key[0] === 'myListings.read' && key[1] === `user:${owner!.id}`) ||
      (key[0] === 'ownListingDetails' &&
        key[1] === owner!.id &&
        affected(key[2])) ||
      (((key[0] === 'listingDetails' && affected(key[1])) ||
        key[0] === 'listings' ||
        (key[0] === 'home' && key[1] === 'latest' && key[2] === 'api')) &&
        !key.includes('demo'))
    );
  };
  await client.cancelQueries({ predicate });
  if (!current()) return;
  await client.invalidateQueries({ predicate });
}

export { session as authenticatedDealSession };
