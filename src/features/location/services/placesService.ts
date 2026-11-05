import { apiClient } from '../../../services/api/apiClient';
import { appConfig } from '../../../constants/appConfig';
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
    return (
      await apiClient.get<{ data: string }>(path('reverse'), {
        params: coordinates,
        signal,
      })
    ).data.data;
  },
};
