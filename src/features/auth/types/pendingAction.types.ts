import { z } from 'zod';
const id = z
  .string()
  .regex(/^[1-9]\d*$/)
  .max(20);
export const pendingActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('POST_LISTING'),
    params: z
      .object({ listingType: z.enum(['send', 'carry']).optional() })
      .optional(),
  }),
  z.object({
    type: z.literal('OPEN_MESSAGES'),
    params: z
      .object({
        returnTo: z
          .object({
            stack: z.enum(['HomeStack', 'ListingsStack']),
            listingId: id,
          })
          .optional(),
        conversationId: z
          .string()
          .regex(/^[A-Za-z0-9_-]{1,128}$/)
          .optional(),
      })
      .optional(),
  }),
  z.object({
    type: z.literal('SAVE_LISTING'),
    params: z.object({ listingId: id }),
  }),
  z.object({
    type: z.literal('REQUEST_LISTING'),
    params: z.object({ listingId: id }),
  }),
  z.object({
    type: z.literal('VIEW_CONTACT'),
    params: z.object({ listingId: id }),
  }),
  z.object({ type: z.literal('OPEN_PROFILE') }),
  z.object({
    type: z.literal('OPEN_ACCOUNT'),
    params: z.object({
      destination: z.enum([
        'ProfileDashboard',
        'EditProfile',
        'MyListings',
        'MyReviews',
        'SavedListings',
        'Settings',
        'ChangePassword',
        'Notifications',
        'Tracking',
      ]),
    }),
  }),
]);
export type PendingAction = z.infer<typeof pendingActionSchema>;
