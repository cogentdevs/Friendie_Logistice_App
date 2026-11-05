export type LocationSource = 'gps' | 'manual';
export interface Coordinates {
  latitude: number;
  longitude: number;
}
export interface LocationSearchFilter extends Coordinates {
  source: LocationSource;
  radiusKm: number;
  countryId?: number;
  cityId?: number;
  areaId?: number;
  placeId?: string;
  accuracyMeters?: number;
  capturedAt?: number;
  centerKind?: 'pin' | 'reference' | 'gps';
  countryName?: string;
  countryCode?: string;
  cityName?: string;
  areaName?: string;
}
export type LocationSelection =
  | { mode: 'worldwide' }
  | { mode: 'radius'; filter: LocationSearchFilter };
export interface PlaceSuggestion {
  placeId: string;
  label: string;
}
export interface PlacesProvider {
  search: (query: string, signal?: AbortSignal) => Promise<PlaceSuggestion[]>;
  resolve: (placeId: string, signal?: AbortSignal) => Promise<Coordinates>;
  reverseGeocode: (
    coordinates: Coordinates,
    signal?: AbortSignal,
  ) => Promise<string>;
}
