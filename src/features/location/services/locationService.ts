import { Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {
  PERMISSIONS,
  RESULTS,
  check,
  request,
  requestMultiple,
  openSettings,
} from 'react-native-permissions';
export type LocationFailure =
  | 'denied'
  | 'blocked'
  | 'disabled'
  | 'timeout'
  | 'unavailable'
  | 'inaccurate';
export class LocationError extends Error {
  constructor(public reason: LocationFailure) {
    super('Location ' + reason);
  }
}
export const locationService = {
  openSettings,
  async requestForegroundPermission() {
    const permission =
      Platform.OS === 'ios'
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
    let result = await check(permission);
    if (Platform.OS === 'android' && result !== RESULTS.GRANTED) {
      const results = await requestMultiple([
        PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      ]);
      result =
        results[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION] === RESULTS.GRANTED
          ? RESULTS.GRANTED
          : results[PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION];
    } else if (result === RESULTS.DENIED) result = await request(permission);
    if (result === RESULTS.BLOCKED) throw new LocationError('blocked');
    if (result === RESULTS.UNAVAILABLE) throw new LocationError('unavailable');
    if (result !== RESULTS.GRANTED && result !== RESULTS.LIMITED)
      throw new LocationError('denied');
  },
  async currentPosition() {
    await locationService.requestForegroundPermission();
    if (Platform.OS === 'ios') {
      const authorization = await Geolocation.requestAuthorization('whenInUse');
      if (authorization === 'disabled') throw new LocationError('disabled');
      if (authorization !== 'granted')
        throw new LocationError(
          authorization === 'restricted' ? 'unavailable' : 'denied',
        );
    }
    return new Promise<{
      latitude: number;
      longitude: number;
      accuracyMeters: number;
    }>((resolve, reject) =>
      Geolocation.getCurrentPosition(
        position =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
          }),
        error =>
          reject(
            new LocationError(
              error.code === 1
                ? 'denied'
                : error.code === 3
                ? 'timeout'
                : error.code === 5
                ? 'disabled'
                : 'unavailable',
            ),
          ),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
          showLocationDialog: true,
        },
      ),
    );
  },
};
