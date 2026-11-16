import { z } from 'zod';
const id = z.number().int().positive().nullable();
export const ownListingApiSchema = z.object({
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
