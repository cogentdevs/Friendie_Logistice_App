import { locationService, LocationError } from './locationService';
import { placesService } from './placesService';
import { appConfig } from '../../../constants/appConfig';
import { Coordinates } from '../types/location';
import { RouteLocation, routeLocationSchema } from '../../search/types/search';
export const maxGpsAccuracyMeters = 100;
export const maxGpsAgeMs = 120000;
export function validatePoint(point: Coordinates) {
  if (
    !point ||
    !Number.isFinite(point.latitude) ||
    Math.abs(point.latitude) > 90 ||
    !Number.isFinite(point.longitude) ||
    Math.abs(point.longitude) > 180
  )
    throw new LocationError('unavailable');
}
export async function readFilterGps() {
  const fix = await locationService.currentPosition();
  validatePoint(fix);
  if (
    !Number.isFinite(fix.accuracyMeters) ||
    fix.accuracyMeters <= 0 ||
    fix.accuracyMeters > maxGpsAccuracyMeters
  )
    throw new LocationError('inaccurate');
  return { ...fix, capturedAt: Date.now() };
}
export async function resolveFilterReference(input: RouteLocation) {
  const reference = routeLocationSchema.parse(input);
  // Explicit coordinates always win, including an exact pin in a named area.
  if (reference.coordinates) {
    validatePoint(reference.coordinates);
    return {
      reference,
      coordinates: reference.coordinates,
      kind: 'pin' as const,
    };
  }
  if (
    reference.placeId &&
    appConfig.placesApiVerified &&
    appConfig.placesProxyUrl
  ) {
    const coordinates = await placesService.resolve(reference.placeId);
    validatePoint(coordinates);
    return { reference, coordinates, kind: 'reference' as const };
  }
  throw new Error(
    'Choose a location with a resolved point or enter exact coordinates.',
  );
}
export function locationProblem(error: unknown) {
  if (error instanceof LocationError) {
    const messages = {
      denied:
        'Location permission was denied. Allow access or choose a manual location.',
      blocked:
        'Location access is blocked. Enable it in Settings or choose a manual location.',
      disabled:
        'Device location is switched off. Turn it on or choose a manual location.',
      timeout:
        'Location took too long. Try again outdoors or choose a manual location.',
      inaccurate:
        'A precise location is not available. Enable precise location and try again, or select an exact manual point.',
      unavailable:
        'Current location is unavailable. Try again or select a manual location.',
    };
    return { reason: error.reason, message: messages[error.reason] };
  }
  return {
    reason: 'unresolved' as const,
    message:
      'This location needs a resolved point. Enter exact coordinates or choose an existing route point.',
  };
}
