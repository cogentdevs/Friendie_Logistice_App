import { z } from 'zod';
export const dashboardCountSchema = z.number().int().nonnegative().nullable();
// Internal presentation model, not an assumed Laravel resource or review meaning.
// A verified website-specific adapter must map only supported actual content here.
export const visitorReviewSchema = z.object({
  records: z.array(
    z.object({ id: z.string().min(1), text: z.string().min(1) }),
  ),
});
export type VisitorReviewData = z.infer<typeof visitorReviewSchema>;
