import { z } from 'zod';
export type ReviewsTab = 'visitors' | 'your';
export type ReviewOwner = number | 'demo' | 'guest';
// Observed website/DB fields; NOT a verified mobile HTTP response contract.
export const websiteReviewSchema = z.object({
  id: z.number().int().positive(),
  from_user_id: z.number().int().positive(),
  to_user_id: z.number().int().positive(),
  post_ads_id: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  review: z.string().nullable().optional(),
  date_time: z.string().optional(),
  from_user_name: z.string().optional(),
  from_user_image: z.string().nullable().optional(),
  ad_title: z.string().optional(),
});
// Internal UI model. Authorization/visibility must be mapped by a verified API adapter.
export const reviewSchema = z.object({
  id: z.number().int().positive(),
  fromUserId: z.number().int().positive(),
  toUserId: z.number().int().positive(),
  rating: z.number().min(1).max(5),
  comment: z.string().nullable().optional(),
  date: z.iso.date().nullable().optional(),
  person: z.object({
    id: z.number().int().positive(),
    name: z.string().nullable().optional(),
    avatarUrl: z.string().url().optional(),
  }),
  listing: z
    .object({
      id: z.number().int().positive(),
      title: z.string().optional(),
      canOpen: z.boolean(),
    })
    .optional(),
});
export const reviewsPageSchema = z.object({
  items: z.array(reviewSchema),
  nextPage: z.number().int().positive().nullable(),
  visibilityConfirmed: z.literal(true),
});
export const reviewsSummarySchema = z
  .object({
    total: z.number().int().nonnegative().nullable(),
    averageRating: z.number().min(0).max(5).nullable(),
  })
  .refine(
    value => value.total !== 0 || value.averageRating === null,
    'An empty review set cannot have a rating.',
  );
export type Review = z.infer<typeof reviewSchema>;
export type ReviewsPage = z.infer<typeof reviewsPageSchema>;
export type ReviewsSummary = z.infer<typeof reviewsSummarySchema>;
