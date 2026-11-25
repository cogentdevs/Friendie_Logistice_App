import { z } from 'zod';
import { apiClient } from '../../services/api/apiClient';
import { endpoints } from '../../services/api/endpoints';
import { secureStorage } from '../../services/storage/secureStorage';
import { useAuthStore } from '../../store/authStore';
import { ApiError } from '../../types/api';
import { getDeal } from './dealsService';
import { revokeDealAccess } from './dealAccessEvents';
export { revokeDealAccess, subscribeDealRevocation } from './dealAccessEvents';

const id = z.number().int().positive();
const contactSchema = z.object({
  success: z.literal(true),
  data: z.object({
    deal_id: id,
    counterpart: z.object({ id, phone: z.string().nullable() }),
    listing: z.object({
      id,
      from_latitude: z.number().finite().min(-90).max(90).nullable(),
      from_longitude: z.number().finite().min(-180).max(180).nullable(),
      to_latitude: z.number().finite().min(-90).max(90).nullable(),
      to_longitude: z.number().finite().min(-180).max(180).nullable(),
    }),
  }),
});
export type DealContact = z.infer<typeof contactSchema>['data'];

// Never publish contact/pins to a listing, chat metadata, persisted store or QueryClient.
export async function readDealContact(dealId: number, signal?: AbortSignal) {
  id.parse(dealId);
  const owner = useAuthStore.getState().user;
  const check = () => {
    if (signal?.aborted || useAuthStore.getState().user !== owner)
      throw new ApiError('Session changed.', 'cancelled');
    if (!owner || useAuthStore.getState().status !== 'authenticated')
      throw new ApiError('Please sign in.', 'unauthorized', 401);
  };
  try {
    check();
    const token = await secureStorage.getToken();
    check();
    if (!token || !/^\S+$/.test(token)) {
      const removed = await secureStorage.removeTokenIfCurrent(
        token,
        () => useAuthStore.getState().user === owner,
      );
      check();
      if (removed) useAuthStore.getState().clear();
      throw new ApiError('Please sign in.', 'unauthorized', 401);
    }
    const deal = await getDeal(dealId, signal);
    check();
    const response = await apiClient.get(
      `${endpoints.deals}/${dealId}/contact`,
      { signal, headers: { Authorization: `Bearer ${token}` } },
    );
    check();
    if ((await secureStorage.getToken()) !== token)
      throw new ApiError('Session changed.', 'cancelled');
    check();
    const parsed = contactSchema.safeParse(response.data);
    if (
      response.status !== 200 ||
      !parsed.success ||
      parsed.data.data.deal_id !== dealId
    )
      throw new ApiError('Contact unavailable.', 'unknown');
    const contact = parsed.data.data;
    const sender = deal.sender_user_id === owner!.id;
    if (
      contact.counterpart.id !==
        (sender ? deal.carrier_user_id : deal.sender_user_id) ||
      contact.listing.id !==
        (sender ? deal.carrier_listing_id : deal.sender_listing_id)
    )
      throw new ApiError('Contact unavailable.', 'forbidden', 403);
    for (const side of ['from', 'to'] as const)
      if (
        (contact.listing[`${side}_latitude`] === null) !==
        (contact.listing[`${side}_longitude`] === null)
      )
        throw new ApiError('Contact unavailable.', 'unknown');
    // Status/deadline can deny/shorten a grant, never grant it: HTTP 200 above is mandatory.
    const timestamp = deal.acceptance_expires_at;
    const deadline =
      deal.status === 'accepted' && timestamp
        ? Date.parse(
            /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)
              ? timestamp.replace(' ', 'T') + 'Z'
              : timestamp,
          )
        : undefined;
    const now = Date.now();
    const serverTime = Date.parse(String(response.headers?.date ?? ''));
    // HTTP Date avoids extending a deadline when the phone clock is behind.
    // Its one-second precision is rounded conservatively towards earlier denial.
    const remaining =
      deadline === undefined
        ? Infinity
        : deadline - (Number.isFinite(serverTime) ? serverTime + 1000 : now);
    if (
      !['accepted', 'confirmed'].includes(deal.status) ||
      (deal.status === 'accepted' && (!deadline || remaining <= 0))
    )
      throw new ApiError('Deal access expired.', 'forbidden', 403);
    return {
      contact,
      deal,
      validUntil: now + Math.min(15000, remaining),
    };
  } catch (error) {
    revokeDealAccess(dealId);
    throw error;
  }
}
