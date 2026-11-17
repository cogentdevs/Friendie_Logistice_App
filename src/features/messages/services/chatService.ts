import { isUiPreviewActive } from '../../../store/developmentStore';
import {
  demoConversation,
  demoMessages,
  demoSend,
} from '../development/demoChat';
import { z } from 'zod';
import { appConfig } from '../../../constants/appConfig';
import { apiClient } from '../../../services/api/apiClient';
import { ApiError } from '../../../types/api';
import { useAuthStore } from '../../../store/authStore';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import {
  conversationReadResponseSchema,
  historyReadResponseSchema,
  sentMessageResponseSchema,
  markedReadResponseSchema,
} from '../types/chatRead.types';
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const instant = z.string().datetime({ offset: true });
export const messageSchema = z.object({
  id: identifier,
  conversationId: identifier,
  senderId: z.number().int().positive(),
  body: z.string().max(4000),
  createdAt: instant,
  clientId: identifier.optional(),
  status: z.enum(['sent', 'delivered', 'read']).optional(),
});
export type ChatMessage = Omit<z.infer<typeof messageSchema>, 'createdAt'> & {
  createdAt: string | null;
};
export const conversationSchema = z.object({
  id: identifier,
  canSend: z.boolean(),
  participant: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    avatarUrl: z.string().url().nullable().optional(),
    deleted: z.boolean().optional(),
    verified: z.boolean().optional(),
    presence: z
      .object({
        online: z.boolean(),
        observedAt: instant,
        lastSeenAt: instant.optional(),
      })
      .optional(),
    phone: z.string().optional(),
    callPermitted: z.boolean().optional(),
  }),
});
export type Conversation = z.infer<typeof conversationSchema>;
export function chatSendConfigured() {
  return (
    isUiPreviewActive() ||
    Boolean(
      appConfig.apiBaseUrl &&
        useAuthStore.getState().status === 'authenticated' &&
        useAuthStore.getState().user,
    )
  );
}
export function validateMessageText(body: string) {
  let bytes = 0;
  for (const character of body) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  if (
    !body.trim() ||
    body.includes('\0') ||
    Array.from(body).length > 10000 ||
    bytes > 65535
  )
    throw new ApiError(
      'Enter a nonempty message of up to 10000 characters (maximum 65535 UTF-8 bytes).',
      'validation',
    );
}
function guard(id: string) {
  if (
    useAuthStore.getState().status !== 'authenticated' ||
    !useAuthStore.getState().user
  )
    throw new ApiError(
      'Sign in with a real account to view this conversation.',
      'unauthorized',
      401,
    );
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
    throw new ApiError('Invalid conversation.', 'not-found', 404);
  if (!appConfig.apiBaseUrl)
    throw new ApiError(
      'Messaging is currently unavailable. Please try again later.',
      'unknown',
    );
  return endpoints.conversations + '/' + encodeURIComponent(id);
}
function assertSession(
  owner: ReturnType<typeof useAuthStore.getState>['user'],
  signal?: AbortSignal,
) {
  if (
    signal?.aborted ||
    useAuthStore.getState().status !== 'authenticated' ||
    useAuthStore.getState().user !== owner
  )
    throw new ApiError('Request cancelled.', 'cancelled');
}
export async function markConversationRead(id: string, signal?: AbortSignal) {
  if (isUiPreviewActive())
    throw new ApiError('Demo messages stay on this device.', 'cancelled');
  const path = guard(id);
  const owner = useAuthStore.getState().user;
  const token = await secureStorage.getToken();
  assertSession(owner, signal);
  if (!token || !/^\S+$/.test(token))
    throw new ApiError('Please sign in again.', 'unauthorized', 401);
  const response = await apiClient.post<unknown>(path + '/read', undefined, {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
  assertSession(owner, signal);
  if ((await secureStorage.getToken()) !== token)
    throw new ApiError('Chat session changed.', 'cancelled');
  assertSession(owner, signal);
  const parsed = markedReadResponseSchema.safeParse(response.data);
  if (
    response.status !== 200 ||
    !parsed.success ||
    parsed.data.data.conversation_id !== Number(id)
  )
    throw new ApiError('Read status could not be confirmed.', 'unknown');
  return parsed.data.data;
}
async function readChat(
  path: string,
  owner: ReturnType<typeof useAuthStore.getState>['user'],
  signal?: AbortSignal,
  params?: { page: number; per_page: number },
) {
  assertSession(owner, signal);
  const current = () =>
    useAuthStore.getState().status === 'authenticated' &&
    useAuthStore.getState().user === owner;
  const token = await secureStorage.getToken();
  assertSession(owner, signal);
  if (!token || !/^\S+$/.test(token)) {
    const removed = await secureStorage.removeTokenIfCurrent(token, current);
    assertSession(owner, signal);
    if (!removed) throw new ApiError('Chat session changed.', 'cancelled');
    useAuthStore.getState().clear();
    throw new ApiError('Please sign in again.', 'unauthorized', 401);
  }
  const response = await apiClient.get<unknown>(path, {
    signal,
    ...(params ? { params } : {}),
    headers: { Authorization: `Bearer ${token}` },
  });
  assertSession(owner, signal);
  if ((await secureStorage.getToken()) !== token)
    throw new ApiError('Chat session changed.', 'cancelled');
  assertSession(owner, signal);
  if (response.status !== 200)
    throw new ApiError('Unable to read conversation.', 'unknown');
  return response.data;
}
export function normalizeChatTime(value: string | null) {
  if (value == null) return null;
  // Verified Laravel APP_TIMEZONE=UTC. SQL timestamps have no device-local timezone.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)
    ? value.replace(' ', 'T') + 'Z'
    : value;
  if (!instant.safeParse(normalized).success)
    throw new ApiError('Invalid message timestamp.', 'unknown');
  return new Date(normalized).toISOString();
}
export function compareChatOrder(
  a: { id?: string; createdAt: string | null; clientId?: string },
  b: { id?: string; createdAt: string | null; clientId?: string },
) {
  if (a.id && b.id && /^\d+$/.test(a.id) && /^\d+$/.test(b.id))
    return Number(a.id) - Number(b.id);
  return (
    (a.createdAt ? Date.parse(a.createdAt) : 0) -
      (b.createdAt ? Date.parse(b.createdAt) : 0) ||
    (a.id ?? a.clientId ?? '').localeCompare(b.id ?? b.clientId ?? '')
  );
}
export async function getConversation(
  id: string,
  signal?: AbortSignal,
): Promise<Conversation> {
  if (isUiPreviewActive()) {
    identifier.parse(id);
    return demoConversation(id);
  }
  const path = guard(id);
  const owner = useAuthStore.getState().user;
  const data = await readChat(path, owner, signal);
  assertSession(owner, signal);
  const parsed = conversationReadResponseSchema.safeParse(data);
  if (!parsed.success)
    throw new ApiError('Unable to read conversation.', 'unknown');
  const value = parsed.data.data;
  if (String(value.id) !== id || value.other_participant.id === owner?.id)
    throw new ApiError('Conversation unavailable.', 'forbidden', 403);
  return {
    id: String(value.id),
    canSend: true,
    participant: {
      id: value.other_participant.id,
      name: value.other_participant.display_name?.trim() || 'Name unavailable',
    },
  };
}
export async function getMessages(
  id: string,
  cursor: string | null,
  signal?: AbortSignal,
) {
  if (isUiPreviewActive()) {
    identifier.parse(id);
    return demoMessages(id);
  }
  const path = guard(id);
  const owner = useAuthStore.getState().user;
  if (
    cursor !== null &&
    (!/^[1-9]\d*$/.test(cursor) || Number(cursor) > 100000)
  )
    throw new ApiError('Invalid message page.', 'validation');
  const readPage = async (page: number) => {
    assertSession(owner, signal);
    const data = await readChat(path + '/messages', owner, signal, {
      page,
      per_page: 20,
    });
    assertSession(owner, signal);
    const parsed = historyReadResponseSchema.safeParse(data);
    if (!parsed.success)
      throw new ApiError('Unable to read messages.', 'unknown');
    const result = parsed.data.data;
    if (
      result.pagination.current_page !== page ||
      result.pagination.per_page !== 20 ||
      result.items.length > 20 ||
      new Set(result.items.map(item => item.id)).size !== result.items.length ||
      result.items.some(
        (item, index) =>
          item.conversation_id !== Number(id) ||
          (index > 0 && item.id <= result.items[index - 1].id),
      )
    )
      throw new ApiError('Invalid conversation history.', 'unknown');
    return result;
  };
  let page = await readPage(cursor ? Number(cursor) : 1);
  if (cursor === null && page.pagination.last_page > 1) {
    if (page.pagination.last_page > 100000)
      throw new ApiError(
        'Message history exceeds supported pagination.',
        'unknown',
      );
    page = await readPage(page.pagination.last_page);
  }
  assertSession(owner, signal);
  return {
    data: page.items.map(
      (item): ChatMessage => ({
        id: String(item.id),
        conversationId: String(item.conversation_id),
        senderId: item.sender.id,
        body: item.message,
        createdAt: normalizeChatTime(item.created_at),
        ...(item.is_read ? { status: 'read' as const } : {}),
      }),
    ),
    // Internal adapter for existing earlier-history UI: this is a page number, not a backend cursor.
    nextCursor:
      page.items.length && page.pagination.current_page > 1
        ? String(page.pagination.current_page - 1)
        : null,
  };
}
export async function sendMessage(id: string, body: string, clientId: string) {
  if (isUiPreviewActive()) {
    identifier.parse(id);
    identifier.parse(clientId);
    const text = body.trim();
    if (!text || text.length > 4000)
      throw new ApiError(
        'Enter a message of up to 4000 characters.',
        'validation',
      );
    return demoSend(id, text, clientId);
  }
  const path = guard(id);
  validateMessageText(body);
  const owner = useAuthStore.getState().user;
  const token = await secureStorage.getToken();
  assertSession(owner);
  if (!token || !/^\S+$/.test(token)) {
    const current = () =>
      useAuthStore.getState().status === 'authenticated' &&
      useAuthStore.getState().user === owner;
    const removed = await secureStorage.removeTokenIfCurrent(token, current);
    assertSession(owner);
    if (!removed) throw new ApiError('Chat session changed.', 'cancelled');
    useAuthStore.getState().clear();
    throw new ApiError('Please sign in again.', 'unauthorized', 401);
  }
  const response = await apiClient.post<unknown>(
    path + '/messages',
    { message: body },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  assertSession(owner);
  if ((await secureStorage.getToken()) !== token)
    throw new ApiError('Chat session changed.', 'cancelled');
  assertSession(owner);
  const parsed = sentMessageResponseSchema.safeParse(response.data);
  if (
    response.status !== 201 ||
    !parsed.success ||
    parsed.data.data.conversation_id !== Number(id) ||
    parsed.data.data.sender.id !== owner!.id ||
    (parsed.data.data.message !== body &&
      parsed.data.data.message !== body.trim())
  )
    throw new ApiError('Unable to confirm message delivery.', 'unknown');
  const row = parsed.data.data;
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: row.sender.id,
    body: row.message,
    createdAt: normalizeChatTime(row.created_at),
    ...(row.is_read ? { status: 'read' as const } : {}),
  } as ChatMessage;
}
export function chatPhone(_conversation: Conversation) {
  // No verified accepted-request/authorized-participant contract is available yet.
  return undefined;
}
