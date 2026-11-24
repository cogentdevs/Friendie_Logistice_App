import { z } from 'zod';
import { formatManualListingPin } from '../../post-listing/types/manualListingPin';
const id = z.number().int().positive().nullable();
export const ownListingApiSchema = z.object({
  from_latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  from_longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  to_latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  to_longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  id: z.number().int().positive(),
  category_id: id,
  from_country_id: id,
  from_city_id: id,
  to_country_id: id,
  to_city_id: id,
  ad_type: z.enum(['Carring', 'Send']),
  title: z.string().nullable(),
  description: z.string().nullable(),
  from_area: z.string().nullable(),
  from_address: z.string().max(255).nullable().optional(),
  to_address: z.string().max(255).nullable().optional(),
  to_area: z.string().nullable(),
  weight: z.number().int().nonnegative().nullable(),
  weight_price: z.number().finite().nonnegative().nullable(),
  currency: z.string().nullable(),
  departure_on: z.string().nullable(),
  reached_on: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  status: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  is_featured: z.boolean(),
  show_contact_info: z.number().int(),
  image_url: z
    .url()
    .refine(url => /^https?:\/\//i.test(url))
    .nullable(),
}).superRefine((row, context) => {
  for (const side of ['from', 'to'] as const) {
    const latitude = row[`${side}_latitude`], longitude = row[`${side}_longitude`];
    if (latitude === undefined && longitude === undefined) continue;
    if (latitude === null && longitude === null) continue;
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || !formatManualListingPin({latitude, longitude}))
      context.addIssue({code:'custom',path:[`${side}_latitude`],message:'Invalid owner location pin.'});
  }
});
export const ownListingsResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    items: z.array(ownListingApiSchema),
    pagination: z.object({
      current_page: z.number().int().positive(),
      per_page: z.number().int().min(1).max(50),
      total: z.number().int().nonnegative(),
      last_page: z.number().int().positive(),
    }),
  }),
});
export const ownListingFiltersSchema = z
  .object({
    status: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
    ad_type: z.enum(['Carring', 'Send']).optional(),
    search: z.string().trim().min(1).max(100).optional(),
    sort: z.enum(['latest', 'oldest', 'departure']).optional(),
  })
  .strict();
export type OwnListingFilters = z.infer<typeof ownListingFiltersSchema>;
export type OwnListingRecord = z.infer<typeof ownListingApiSchema>;
