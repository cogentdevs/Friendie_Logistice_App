import { z } from 'zod';
const identity = z.object({
  id: z.number().int().positive(),
  display_name: z.string().nullable(),
});
// CustomerReviewController::data. Avatar and moderation status are not returned.
export const receivedReviewResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    items: z.array(
      z.object({
        deal_id: z.number().int().positive().nullable().optional(),
        id: z.number().int().positive(),
        listing: z.object({
          id: z.number().int().positive(),
          title: z.string().nullable(),
        }),
        reviewer: identity,
        reviewed_customer: identity,
        rating: z.number().int().min(0).max(5),
        review: z.string().nullable(),
        date_time: z.string().nullable(),
        created_at: z.string().nullable(),
        updated_at: z.string().nullable(),
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
export type ReceivedReview = z.infer<
  typeof receivedReviewResponseSchema
>['data']['items'][number];
export type ReceivedReviewsPage = z.infer<
  typeof receivedReviewResponseSchema
>['data'] & { nextPage: number | null };
