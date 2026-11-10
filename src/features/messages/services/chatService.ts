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
export type ChatMessage = z.infer<typeof messageSchema>;
export const conversationSchema = z.object({
  id: identifier,
  canSend: z.boolean(),
  participant: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    avatarUrl: z.string().url().nullable().optional(),
    deleted: z.boolean(),
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
const pageSchema = z.object({
  data: z.array(messageSchema),
  nextCursor: z.string().min(1).max(2048).nullable(),
});
export function chatSendConfigured() {
  if (isUiPreviewActive()) return true;
  return Boolean(
    appConfig.apiBaseUrl &&
      appConfig.chatApiVerified &&
      appConfig.chatIdempotencyVerified,
  );
}
function guard(id: string) {
  identifier.parse(id);
  if (useAuthStore.getState().status !== 'authenticated')
    throw new ApiError(
      'Sign in with a real account to view this conversation.',
      'unauthorized',
      401,
    );
  if (!appConfig.apiBaseUrl || !appConfig.chatApiVerified)
    throw new ApiError(
      'Messaging is currently unavailable. Please try again later.',
      'unknown',
    );
  return '/conversations/' + encodeURIComponent(id);
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
// Proposed contracts only; gates stay false until Laravel verifies authorization and DTOs.
export async function getConversation(id: string, signal?: AbortSignal) {
  if (isUiPreviewActive()) {
    identifier.parse(id);
    return demoConversation(id);
  }
  const path = guard(id);
  const owner = useAuthStore.getState().user;
  const { data } = await apiClient.get(path, { signal });
  assertSession(owner, signal);
  const value = z.object({ data: conversationSchema }).parse(data).data;
  if (value.id !== id)
    throw new ApiError('Conversation unavailable.', 'forbidden', 403);
  delete value.participant.phone;
  delete value.participant.callPermitted;
  return value;
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
  if (cursor) z.string().min(1).max(2048).parse(cursor);
  const { data } = await apiClient.get(path + '/messages', {
    signal,
    params: cursor ? { before: cursor } : {},
  });
  assertSession(owner, signal);
  const page = pageSchema.parse(data);
  if (page.data.some(item => item.conversationId !== id))
    throw new ApiError('Conversation unavailable.', 'forbidden', 403);
  return page;
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
  const owner = useAuthStore.getState().user;
  if (!appConfig.chatIdempotencyVerified)
    throw new ApiError(
      'Sending is unavailable until reliable retry support is configured.',
      'unknown',
    );
  identifier.parse(clientId);
  const text = body.trim();
  if (!text || text.length > 4000)
    throw new ApiError(
      'Enter a message of up to 4000 characters.',
      'validation',
    );
  const { data } = await apiClient.post(
    path + '/messages',
    { body: text, clientId },
    { headers: { 'Idempotency-Key': clientId } },
  );
  assertSession(owner);
  const message = z.object({ data: messageSchema }).parse(data).data;
  if (
    message.conversationId !== id ||
    message.clientId !== clientId ||
    message.senderId !== useAuthStore.getState().user?.id
  )
    throw new ApiError('Could not confirm the sent message.', 'unknown');
  return message;
}
export function chatPhone(_conversation: Conversation) {
  // No verified accepted-request/authorized-participant contract is available yet.
  return undefined;
}
