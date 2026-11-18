import { z } from 'zod';
import { isListingDemoMode } from '../../listings/development/demoListings';
import { validSearchWeight } from '../../search/types/searchValidation';
import {
  dateRangeSchema,
  localDate,
  routeLocationSchema,
  sameLocation,
} from '../../search/types/search';
export const homeSearchSchema = z
  .object({
    type: z.enum(['send', 'carry']),
    query: z.string().trim().max(200),
    category: z.string(),
    weight: z.string().trim(),
    from: routeLocationSchema.nullish(),
    to: routeLocationSchema.nullish(),
    dates: dateRangeSchema.optional(),
  })
  .superRefine((v, ctx) => {
    const demo = isListingDemoMode();
    if (!demo && v.query.length > 100)
      ctx.addIssue({
        code: 'custom',
        path: ['query'],
        message: 'Use a search of up to 100 characters.',
      });
    if (v.from && v.to && sameLocation(v.from, v.to))
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Choose different route locations',
      });
    if (!validSearchWeight(v.weight, demo))
      ctx.addIssue({
        code: 'custom',
        path: ['weight'],
        message: demo
          ? 'Enter a positive weight in kg'
          : 'Enter a whole-number weight from 0 to 2147483647 kg',
      });
    if (v.dates && v.dates.start < localDate(new Date()))
      ctx.addIssue({
        code: 'custom',
        path: ['dates'],
        message: 'Choose today or a future date',
      });
  });
export type HomeSearchValues = z.infer<typeof homeSearchSchema>;
