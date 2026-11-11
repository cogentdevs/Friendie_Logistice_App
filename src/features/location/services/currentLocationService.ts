import { locationService, LocationError } from './locationService';
import { placesService } from './placesService';
import type { ResolvedAddress } from '../types/location';

// One GPS + address flow shared by route forms and radius filters. No authentication.
export async function detectCurrentLocation() {
  const fix = await locationService.currentPosition();
  const capturedAt = Date.now();
  if (
    !Number.isFinite(fix.latitude) ||
    Math.abs(fix.latitude) > 90 ||
    !Number.isFinite(fix.longitude) ||
    Math.abs(fix.longitude) > 180
  )
    throw new LocationError('unavailable');
  let address: ResolvedAddress = {};
  try {
    address = await placesService.reverseGeocode(fix);
  } catch {
    // A geocoder failure never discards a successful device fix.
  }
  const addressMessage =
    !address.countryName || !address.countryCode || !address.city
      ? 'Your device location was captured, but the full address is unavailable. Complete the country and city manually; your device point is retained.'
      : undefined;
  return { ...fix, capturedAt, address, addressMessage };
}
