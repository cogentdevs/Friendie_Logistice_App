import { NativeModules, Platform, Linking } from 'react-native';
import { locationService } from '../../location/services/locationService';
import { detectCurrentLocation } from '../../location/services/currentLocationService';
import { maxGpsAccuracyMeters } from '../../location/services/filterLocationService';
import {
  getListingReferences,
  ListingReference,
  ReferenceOption,
} from './listingReferencesService';
import type { ResolvedAddress } from '../../location/types/location';

export type ListingGpsResult = {
  country: ListingReference;
  city?: ListingReference & { countryId: number };
  area?: string;
  address?: string;
};
const normal = (text?: string) => text?.trim().normalize('NFKC').toLowerCase();
const unique = (rows: ReferenceOption[]) =>
  rows.length === 1 && typeof rows[0].value !== 'string'
    ? rows[0].value
    : undefined;
let deviceFix: ReturnType<typeof detectCurrentLocation> | undefined;
export const listingGpsService = {
  hasPermission: () => locationService.hasForegroundPermission(),
  async enabled() {
    // Fail closed if the native availability reader is unavailable. Never show
    // a system enable-location dialog from automatic form entry.
    return Platform.OS === 'android' &&
      typeof NativeModules.FriendieGeocoder?.isLocationEnabled === 'function'
      ? (await NativeModules.FriendieGeocoder.isLocationEnabled()) === true
      : false;
  },
  async detect(signal: AbortSignal) {
    deviceFix ??= detectCurrentLocation({
      requestPermission: false,
      showLocationDialog: false,
    }).finally(() => {
      deviceFix = undefined;
    });
    const fix = await deviceFix;
    if (signal.aborted) return undefined;
    return matchListingAddress(
      {
        ...fix.address,
        streetAddress: Number.isFinite(fix.accuracyMeters) && fix.accuracyMeters > 0 && fix.accuracyMeters <= maxGpsAccuracyMeters ? fix.address.streetAddress : undefined,
        area:
          Number.isFinite(fix.accuracyMeters) &&
          fix.accuracyMeters > 0 &&
          fix.accuracyMeters <= maxGpsAccuracyMeters
            ? fix.address.area
            : undefined,
      },
      signal,
    );
  },
  requestPermission: () => locationService.requestForegroundPermission(),
  openAppSettings: () => locationService.openSettings(),
  openLocationSettings: () =>
    Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS'),
};
export async function matchListingAddress(
  address: ResolvedAddress,
  signal?: AbortSignal,
): Promise<ListingGpsResult | undefined> {
  const countries = await getListingReferences('countries', undefined, signal);
  if (signal?.aborted) return undefined;
  const code = normal(address.countryCode);
  const coded = code
    ? countries.filter(row => normal(row.shortName) === code)
    : [];
  // Prefer the server's short_name when it really matches the supplied ISO code;
  // otherwise accept only a unique exact server name/abbreviation. No fuzzy guesses.
  const country = coded.length
    ? unique(coded)
    : unique(
        countries.filter(
          row =>
            !!normal(address.countryName) &&
            (normal(row.label) === normal(address.countryName) ||
              normal(row.shortName) === normal(address.countryName)),
        ),
      );
  if (!country) return undefined;
  const cities = await getListingReferences('cities', country.id, signal);
  if (signal?.aborted) return undefined;
  const city = unique(
    cities.filter(
      row =>
        !!normal(address.city) &&
        (normal(row.label) === normal(address.city) ||
          normal(row.shortName) === normal(address.city)),
    ),
  );
  return {
    country,
    ...(city?.countryId === country.id
      ? {
          city: { ...city, countryId: country.id },
          ...(address.streetAddress?.trim() && address.streetAddress.trim().length <= 255 ? { address: address.streetAddress.trim() } : {}),
          ...(address.area?.trim() && address.area.trim().length <= 255
            ? { area: address.area.trim() }
            : {}),
        }
      : {}),
  };
}
