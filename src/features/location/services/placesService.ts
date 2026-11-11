import { apiClient } from '../../../services/api/apiClient';
import { appConfig } from '../../../constants/appConfig';
import { NativeModules, Platform } from 'react-native';
import { z } from 'zod';
import {
  Coordinates,
  PlaceSuggestion,
  PlacesProvider,
} from '../types/location';
function path(suffix: string) {
  if (!appConfig.placesProxyUrl || !appConfig.placesApiVerified)
    throw Error('Configure a Laravel Places proxy before using geocoding.');
  return appConfig.placesProxyUrl.replace(/\/$/, '') + '/' + suffix;
}
// Proposed proxy contract: no Google server credentials in the mobile bundle.
export const placesService: PlacesProvider = {
  async search(query, signal) {
    return (
      await apiClient.get<{ data: PlaceSuggestion[] }>(path('search'), {
        params: { query },
        signal,
      })
    ).data.data;
  },
  async resolve(placeId, signal) {
    return (
      await apiClient.get<{ data: Coordinates }>(path('resolve'), {
        params: { placeId },
        signal,
      })
    ).data.data;
  },
  async reverseGeocode(coordinates, signal) {
    if (signal?.aborted) throw Error('Address lookup cancelled.');
    const native = NativeModules.FriendieGeocoder;
    if (Platform.OS !== 'android' || typeof native?.reverse !== 'function')
      throw Error('Address lookup is unavailable on this device.');
    const result: unknown = await native.reverse(
      coordinates.latitude,
      coordinates.longitude,
    );
    if (signal?.aborted) throw Error('Address lookup cancelled.');
    return z
      .object({
        countryName: z.string().trim().min(1).optional(),
        countryCode: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .optional()
          .catch(undefined),
        city: z.string().trim().min(1).optional(),
        area: z.string().trim().min(1).optional(),
      })
      .parse(result);
  },
};
