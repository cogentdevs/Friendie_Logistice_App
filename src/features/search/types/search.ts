import { z } from 'zod';
const identity = z.object({
  id: z.union([z.string().min(1), z.number().int().positive()]).optional(),
  name: z.string().trim().min(1),
});
export const routeLocationSchema = z.object({
  country: identity.extend({ code: z.string().regex(/^[A-Z]{2}$/) }),
  city: identity,
  area: identity.optional(),
  placeId: z.string().min(1).optional(),
  coordinates: z
    .object({
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
    })
    .optional(),
  source: z.enum(['gps', 'manual']),
});
export type RouteLocation = z.infer<typeof routeLocationSchema>;
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number),
    date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}
export const dateRangeSchema = z
  .object({
    start: z.string().refine(validDate),
    end: z.string().refine(validDate),
  })
  .refine(range => range.end >= range.start, 'End date must follow start date');
export const routeSearchSchema = z
  .object({
    type: z.enum(['send', 'carry']),
    query: z.string().trim().max(200).optional(),
    category: z.string().trim().optional(),
    verifiedOnly: z.boolean().optional(),
    availableNow: z.boolean().optional(),
    radiusTarget: z.enum(['origin', 'destination']).optional(),
    from: routeLocationSchema,
    to: routeLocationSchema,
    dates: dateRangeSchema.optional(),
  })
  .refine(
    value => !sameLocation(value.from, value.to),
    'Choose different route locations',
  );
export type RouteSearch = z.infer<typeof routeSearchSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
export const locationLabel = (location: RouteLocation) =>
  [location.area?.name, location.city.name, location.country.name]
    .filter(Boolean)
    .join(', ');
export function sameLocation(a: RouteLocation, b: RouteLocation) {
  // Full structured identity, never the city label alone.
  if (a.placeId && b.placeId) return a.placeId === b.placeId;
  return (
    a.country.code === b.country.code &&
    a.city.id === b.city.id &&
    a.city.name.toLowerCase() === b.city.name.toLowerCase() &&
    a.area?.id === b.area?.id &&
    a.area?.name?.toLowerCase() === b.area?.name?.toLowerCase() &&
    a.coordinates?.latitude === b.coordinates?.latitude &&
    a.coordinates?.longitude === b.coordinates?.longitude
  );
}
export function localDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
export function displayDate(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
export function displayRange(range?: DateRange) {
  return range
    ? displayDate(range.start) +
        (range.end !== range.start ? ' to ' + displayDate(range.end) : '')
    : 'Any date';
}
