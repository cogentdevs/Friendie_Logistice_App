import { z } from 'zod';
import { inboxItemSchema } from './inbox.types';
export const markedReadResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    conversation_id: z.number().int().positive(),
    marked_read: z.number().int().nonnegative(),
    unread_count: z.number().int().nonnegative(),
  }),
});
export const conversationReadResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: inboxItemSchema.pick({
    id: true,
    deal_id: true,
    listing: true,
    other_participant: true,
    created_at: true,
  }),
});
export const historyReadResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    items: z.array(
      z.object({
        id: z.number().int().positive(),
        conversation_id: z.number().int().positive(),
        sender: z.object({
          id: z.number().int().positive(),
          display_name: z.string().nullable(),
        }),
        message: z.string(),
        created_at: z.string().nullable(),
        message_on: z.string().nullable(),
        is_read: z.boolean(),
      }),
    ),
    pagination: z.object({
      current_page: z.number().int().positive(),
      per_page: z.number().int().min(1).max(50),
      total: z.number().int().nonnegative(),
      last_page: z.number().int().positive(),
    }),
  }),
});
export const sentMessageResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: historyReadResponseSchema.shape.data.shape.items.element,
});
