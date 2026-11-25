import { z } from 'zod';
import { apiClient } from '../../services/api/apiClient';
import { endpoints } from '../../services/api/endpoints';
import { ApiError } from '../../types/api';
import { authenticatedDealSession, actionSchema } from '../deals/dealsService';
const id = z.number().int().positive();
const person = z.object({ id, display_name: z.string().nullable() });
const notification = z.object({
  id,
  event: z.enum([
    'request_submitted',
    'request_accepted',
    'request_rejected',
    'deal_confirmed',
    'deal_cancelled',
    'parcel_picked_up',
    'delivery_completed',
  ]),
  deal_id: id,
  deal_status: z.enum([
    'pending',
    'accepted',
    'confirmed',
    'rejected',
    'cancelled',
    'expired',
    'completed',
  ]),
  is_read: z.boolean(),
  read_at: z.string().nullable(),
  created_at: z.string(),
  is_pending_task: z.boolean(),
  visible: z.boolean(),
  allowed_actions: z.array(actionSchema),
  summary: z.object({
    parcel_title: z.string().nullable(),
    weight_kg: z.number().int().nonnegative(),
    route: z.object({
      from_country_id: id.nullable(),
      from_city_id: id.nullable(),
      to_country_id: id.nullable(),
      to_city_id: id.nullable(),
      from_country_name: z.string().nullable(),
      from_city_name: z.string().nullable(),
      to_country_name: z.string().nullable(),
      to_city_name: z.string().nullable(),
    }),
    sender: person,
    carrier: person,
  }),
});
export type DealNotification = z.infer<typeof notification>;
const counts = z.object({
  unread_count: z.number().int().nonnegative(),
  pending_task_count: z.number().int().nonnegative(),
});
const page = z.object({
  items: z.array(notification),
  pagination: z.object({
    current_page: id,
    last_page: id,
    per_page: z.number().int().min(1).max(50),
    total: z.number().int().nonnegative(),
  }),
});
function data<T extends z.ZodType>(
  schema: T,
  response: { status: number; data: unknown },
): z.infer<T> {
  const parsed = z
    .object({ success: z.literal(true), data: z.unknown() })
    .safeParse(response.data);
  if (response.status !== 200 || !parsed.success)
    throw new ApiError('Invalid notification response.', 'unknown');
  const result = schema.safeParse(parsed.data.data);
  if (!result.success)
    throw new ApiError('Invalid notification response.', 'unknown');
  return result.data;
}
export async function getNotificationCounts(signal?: AbortSignal) {
  const auth = await authenticatedDealSession(signal);
  const response = await apiClient.get(
    endpoints.notifications + '/counts',
    auth.config,
  );
  await auth.check();
  return data(counts, response);
}
export async function getNotifications(value = 1, signal?: AbortSignal) {
  id.max(100000).parse(value);
  const auth = await authenticatedDealSession(signal);
  const response = await apiClient.get(endpoints.notifications, {
    ...auth.config,
    params: { filter: 'all', page: value, per_page: 20 },
  });
  await auth.check();
  const result = data(page, response);
  if (
    result.pagination.current_page !== value ||
    result.pagination.per_page !== 20
  )
    throw new ApiError('Invalid notification page.', 'unknown');
  return result;
}
export async function markNotificationRead(
  value: number,
  signal?: AbortSignal,
) {
  id.parse(value);
  const auth = await authenticatedDealSession(signal);
  const response = await apiClient.post(
    endpoints.notifications + '/' + value + '/read',
    {},
    auth.config,
  );
  await auth.check();
  const result = data(notification, response);
  if (result.id !== value || !result.is_read)
    throw new ApiError('Invalid read response.', 'unknown');
  return result;
}
export function notificationError(error: unknown) {
  if (error instanceof ApiError && error.status === 503)
    return 'Notifications are not available yet.';
  if (error instanceof ApiError && [401, 403, 404].includes(error.status ?? 0))
    return 'Notifications are unavailable for this session. Please sign in again.';
  return 'Unable to load notifications. Please try again.';
}
