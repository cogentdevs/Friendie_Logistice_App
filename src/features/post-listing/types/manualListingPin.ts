// Raw form text remains separate from validated numeric coordinates.
export type PinCoordinates = { latitude: number; longitude: number };
export type ManualListingPin = {
  text: string;
  intent: 'unchanged' | 'replace' | 'clear';
};
export type ParsedManualPin =
  | { valid: true; coordinates?: PinCoordinates }
  | { valid: false; error: string };

export function parseManualListingPin(text: string): ParsedManualPin {
  if (!text.trim()) return { valid: true };
  const parts = text
    .trim()
    .split(',')
    .map(part => part.trim());
  if (parts.length !== 2 || parts.some(part => !/^-?\d+(?:\.\d+)?$/.test(part)))
    return {
      valid: false,
      error: 'Enter latitude, longitude as two decimal numbers.',
    };
  const [latitude, longitude] = parts.map(Number);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return {
      valid: false,
      error: 'Latitude must be -90 to 90 and longitude -180 to 180.',
    };
  if (parts.some(part => (part.split('.')[1]?.length ?? 0) > 7))
    return {
      valid: false,
      error: 'Use at most 7 decimal places per coordinate.',
    };
  return { valid: true, coordinates: { latitude, longitude } };
}

export function editManualListingPin(text: string): ManualListingPin {
  return { text, intent: text.trim() ? 'replace' : 'clear' };
}

// Future owner-authorized hydration only; never turn a missing/null axis into 0.
export function formatManualListingPin(
  pin: PinCoordinates | null | undefined,
): string {
  if (pin == null) return '';
  const numbers = [pin.latitude, pin.longitude];
  if (numbers.some(value => !Number.isFinite(value))) return '';
  const decimals = numbers.map(value => value.toFixed(7));
  if (decimals.some((value, index) => Number(value) !== numbers[index])) return '';
  const text = decimals.map(value => value.replace(/\.?0+$/, '') || '0').join(', ');
  const parsed = parseManualListingPin(text);
  return parsed.valid && parsed.coordinates ? text : '';
}

export function listingGeographyChanged(
  previous?: { country: { id: number }; city: { id: number } },
  next?: { country: { id: number }; city: { id: number } },
) {
  return (
    previous?.country.id !== next?.country.id ||
    previous?.city.id !== next?.city.id
  );
}
