import { z } from 'zod';
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
    from: routeLocationSchema.nullable(),
    to: routeLocationSchema.nullable(),
    dates: dateRangeSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.from)
      ctx.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'Select an origin location',
      });
    if (!v.to)
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Select a destination location',
      });
    if (v.from && v.to && sameLocation(v.from, v.to))
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Choose different route locations',
      });
    if (
      v.weight &&
      (!/^\d+(\.\d+)?$/.test(v.weight) ||
        !Number.isFinite(Number(v.weight)) ||
        Number(v.weight) <= 0)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['weight'],
        message: 'Enter a positive weight in kg',
      });
    if (v.dates && v.dates.start < localDate(new Date()))
      ctx.addIssue({
        code: 'custom',
        path: ['dates'],
        message: 'Choose today or a future date',
      });
  });
export type HomeSearchValues = z.infer<typeof homeSearchSchema>;
