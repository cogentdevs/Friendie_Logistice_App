import { z } from 'zod';
export const dashboardCountSchema = z.number().int().nonnegative().nullable();
const count = z.number().int().nonnegative();
export const dashboardResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    listings: z.object({
      total: count,
      published: count,
      pending: count,
      expired: count,
    }),
    unread_messages: count,
    reviews_received: count,
  }),
});
export type DashboardSummary = z.infer<typeof dashboardResponseSchema>['data'];
// Internal presentation model, not an assumed Laravel resource or review meaning.
// A verified website-specific adapter must map only supported actual content here.
export const visitorReviewSchema = z.object({
  records: z.array(
    z.object({ id: z.string().min(1), text: z.string().min(1) }),
  ),
});
export type VisitorReviewData = z.infer<typeof visitorReviewSchema>;
