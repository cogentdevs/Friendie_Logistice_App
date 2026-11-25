import { z } from 'zod';

export const inboxItemSchema = z.object({
  id: z.number().int().positive(),
  deal_id: z.number().int().positive().nullable().optional(),
  listing: z.object({
    id: z.number().int().positive(),
    title: z.string().nullable(),
  }),
  other_participant: z.object({
    id: z.number().int().positive(),
    display_name: z.string().nullable(),
  }),
  created_at: z.string().nullable(),
  last_message: z.string().nullable(),
  last_message_at: z.string().nullable(),
  unread_count: z.number().int().nonnegative(),
});
export const inboxResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    items: z.array(inboxItemSchema),
    pagination: z.object({
      current_page: z.number().int().positive(),
      per_page: z.number().int().min(1).max(50),
      total: z.number().int().nonnegative(),
      last_page: z.number().int().positive(),
    }),
  }),
});
export type InboxItem = z.infer<typeof inboxItemSchema>;
