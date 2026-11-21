import { z } from 'zod';
import { validDate } from '../../search/types/search';
const identity = z.object({
  id: z.number().int().min(1).max(2147483647),
  name: z.string().min(1),
});
export const listingLocationSchema = z
  .object({
    country: identity,
    city: identity.extend({ countryId: z.number().int().positive() }),
    area: z.object({ name: z.string().max(255) }).optional(),
    source: z.literal('api'),
  })
  .refine(
    value => value.city.countryId === value.country.id,
    'Select a city in this country.',
  );
export type ListingLocation = z.infer<typeof listingLocationSchema>;
export const listingLocationLabel = (value: ListingLocation) =>
  [value.area?.name, value.city.name, value.country.name]
    .filter(Boolean)
    .join(', ');
const common = {
  fromAddress: z.string().max(255).optional(),
  toAddress: z.string().max(255).optional(),
  from: listingLocationSchema.optional(),
  to: listingLocationSchema.optional(),
  title: z.string().max(255).optional(),
  description: z.string().max(10000).optional(),
  weightPrice: z
    .string()
    .refine(
      value =>
        !value.trim() ||
        (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()) &&
          Number.isFinite(Number(value)) &&
          Number(value) >= 0),
      'Enter a finite price of 0 or more, or leave blank.',
    )
    .optional(),
  category: identity.optional(),
  currency: z.string().max(11).optional(),
  date: z.string().refine(validDate, 'Select a valid departure date.'),
  reachedOn: z.string().optional(),
  weight: z
    .string()
    .refine(
      value =>
        !value.trim() ||
        (/^\d+$/.test(value.trim()) && Number(value) <= 2147483647),
      'Enter a whole number from 0 to 2147483647, or leave blank.',
    ),
  image: z
    .object({
      uri: z.string(),
      type: z.string(),
      fileName: z.string().optional(),
      fileSize: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .optional(),
};
export const sendListingSchema = z.object({
  ...common,
  type: z.literal('send'),
});
export const carryListingSchema = z.object({
  ...common,
  type: z.literal('carry'),
});
export const listingDraftSchema = z
  .discriminatedUnion('type', [sendListingSchema, carryListingSchema])
  .superRefine((value, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: 'custom', path: [path], message });
    if (!value.title?.trim()) issue('title', 'Enter a listing title.');
    if (!value.category) issue('category', 'Select a category.');
    if (!value.currency?.trim()) issue('currency', 'Select a currency.');
    if (!value.from) issue('from', 'Select an origin country and city.');
    if (!value.to) issue('to', 'Select a destination country and city.');
    if (!value.reachedOn || !validDate(value.reachedOn))
      issue('reachedOn', 'Select a valid arrival date.');
    else if (value.reachedOn < value.date)
      issue('reachedOn', 'Arrival must be on or after departure.');
  });
export type ListingDraft = z.infer<typeof listingDraftSchema>;
export const emptyListingDraft = (): ListingDraft => ({
  type: 'carry',
  title: '',
  date: '',
  reachedOn: '',
  weight: '',
});
