import { ApiError } from '../../../types/api';
import {
  ManualListingPin,
  parseManualListingPin,
  formatManualListingPin,
} from '../types/manualListingPin';

export type ListingCoordinates = {
  from_latitude?: number | null;
  from_longitude?: number | null;
  to_latitude?: number | null;
  to_longitude?: number | null;
};
export const pinSides = ['from', 'to'] as const;
export function createPinFields(pins: {
  fromPin?: ManualListingPin;
  toPin?: ManualListingPin;
}): ListingCoordinates {
  const fields: ListingCoordinates = {};
  for (const side of pinSides) {
    const parsed = parseManualListingPin(pins[`${side}Pin`]?.text ?? '');
    if (!parsed.valid) throw new ApiError(parsed.error, 'validation');
    if (parsed.coordinates) {
      fields[`${side}_latitude`] = parsed.coordinates.latitude;
      fields[`${side}_longitude`] = parsed.coordinates.longitude;
    }
  }
  return fields;
}
export function hydrateListingPin(
  row: ListingCoordinates,
  side: 'from' | 'to',
): ManualListingPin | undefined {
  const latitude = row[`${side}_latitude`],
    longitude = row[`${side}_longitude`];
  if (latitude === undefined || longitude === undefined) return undefined;
  return {
    text:
      latitude === null || longitude === null
        ? ''
        : formatManualListingPin({ latitude, longitude }),
    intent: 'unchanged',
  };
}
export function pinResponseMatches(
  expected: ListingCoordinates,
  observed: ListingCoordinates,
) {
  return pinSides.every(side =>
    (['latitude', 'longitude'] as const).every(axis => {
      const key = `${side}_${axis}` as keyof ListingCoordinates;
      return expected[key] === undefined || observed[key] === expected[key];
    }),
  );
}
export function listingPinErrors(fields: Record<string, string[]>) {
  const result: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(fields)) {
    const name = /^from_(latitude|longitude)$/.test(key)
      ? 'fromPin'
      : /^to_(latitude|longitude)$/.test(key)
      ? 'toPin'
      : key;
    result[name] = [...new Set([...(result[name] ?? []), ...messages])];
  }
  return result;
}
