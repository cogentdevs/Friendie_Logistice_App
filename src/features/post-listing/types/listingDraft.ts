import { z } from 'zod';
import {
  localDate,
  routeLocationSchema,
  sameLocation,
  validDate,
} from '../../search/types/search';
function positiveWeight(label: string) {
  return z
    .string()
    .trim()
    .refine(
      value =>
        /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value) &&
        Number.isFinite(Number(value)) &&
        Number(value) > 0,
      'Enter a ' + label + ' greater than 0 kg.',
    );
}
const common = {
  from: routeLocationSchema.optional(),
  to: routeLocationSchema.optional(),
  date: z
    .string()
    .refine(
      value => validDate(value) && value >= localDate(new Date()),
      'Select today or a future date.',
    ),
};
export const sendListingSchema = z.object({
  ...common,
  type: z.literal('send'),
  weight: positiveWeight('parcel weight'),
});
export const carryListingSchema = z.object({
  ...common,
  type: z.literal('carry'),
  weight: positiveWeight('carrying capacity'),
});
export const listingDraftSchema = z
  .discriminatedUnion('type', [sendListingSchema, carryListingSchema])
  .superRefine((value, context) => {
    if (!value.from)
      context.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'Select an origin location.',
      });
    if (!value.to)
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Select a destination location.',
      });
    if (value.from && value.to && sameLocation(value.from, value.to))
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Choose a different destination.',
      });
  });
export type ListingDraft = z.infer<typeof listingDraftSchema>;
export const emptyListingDraft = (): ListingDraft => ({
  type: 'carry',
  date: '',
  weight: '',
});
