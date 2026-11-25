import { ApiError } from '../../../types/api';
import {
  ManualListingPin,
  parseManualListingPin,
  parseListingPinInput,
  formatManualListingPin,
} from '../types/manualListingPin';

export type ListingCoordinates = {
  from_location_pin?: string | null;
  to_location_pin?: string | null;
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
    const text = pins[`${side}Pin`]?.text.trim() ?? '';
    const parsed = parseListingPinInput(text);
    if (!parsed.valid) throw new ApiError(parsed.error, 'validation');
    if (text) fields[`${side}_location_pin`] = text;
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
  return pinSides.every(side => {
    const input = expected[`${side}_location_pin`];
    if (input !== undefined) {
      if (input === null || !input.trim())
        return (
          observed[`${side}_latitude`] === null &&
          observed[`${side}_longitude`] === null
        );
      const parsed = parseManualListingPin(input);
      const latitude = observed[`${side}_latitude`],
        longitude = observed[`${side}_longitude`];
      if (
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        !formatManualListingPin({ latitude, longitude })
      )
        return false;
      return parsed.valid && parsed.coordinates
        ? latitude === parsed.coordinates.latitude &&
            longitude === parsed.coordinates.longitude
        : true;
    }
    return (['latitude', 'longitude'] as const).every(axis => {
      const key = `${side}_${axis}` as keyof ListingCoordinates;
      return expected[key] === undefined || observed[key] === expected[key];
    });
  });
}
export function listingPinErrors(fields: Record<string, string[]>) {
  const result: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(fields)) {
    const name = /^from_(latitude|longitude|location_pin)$/.test(key)
      ? 'fromPin'
      : /^to_(latitude|longitude|location_pin)$/.test(key)
      ? 'toPin'
      : key;
    result[name] = [...new Set([...(result[name] ?? []), ...messages])];
  }
  return result;
}
