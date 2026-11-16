import { routeLocationSchema } from '../../search/types/search';
import { z } from 'zod';
import { userSchema } from '../../auth/schemas/sessionSchema';
import { isUiPreviewActive } from '../../../store/developmentStore';
import { useAuthStore } from '../../../store/authStore';
import { appConfig } from '../../../constants/appConfig';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { ApiError } from '../../../types/api';
const count = z.number().int().nonnegative().nullable().optional();
export const profileSchema = userSchema.extend({
  phone: z.string().nullable().optional(),
  countryId: z.number().int().positive().nullable().optional(),
  countryCode: z.string().nullable().optional(),
  location: routeLocationSchema.nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  verified: z.boolean().nullable().optional(),
  statistics: z
    .object({
      listings: count,
      reviews: count,
      rating: z.number().min(0).max(5).nullable().optional(),
    })
    .optional(),
});
export type Profile = z.infer<typeof profileSchema>;
// CustomerController::profileData. Statistics and route coordinates are not
// returned by this endpoint and must never be inferred or filled with samples.
export const profileResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    email: z.email(),
    phone: z.string().nullable().optional(),
    country_id: z.number().int().positive().nullable().optional(),
    country: z
      .object({
        id: z.number().int().positive(),
        name: z.string().nullable(),
        short_name: z.string().nullable(),
      })
      .nullable()
      .optional(),
    image_url: z.url().nullable().optional(),
    is_verified: z.boolean().optional(),
    email_verified_at: z.string().nullable().optional(),
  }),
});
export function normalizeProfile(
  result: z.infer<typeof profileResponseSchema>['data'],
): Profile {
  return {
    id: result.id,
    name: result.name,
    email: result.email,
    phone: result.phone,
    avatarUrl: result.image_url,
    verified: result.is_verified,
    countryId: result.country_id,
    countryCode: result.country?.short_name,
  };
}
export async function getProfile(signal?: AbortSignal): Promise<Profile> {
  if (isUiPreviewActive() && useAuthStore.getState().status !== 'authenticated')
    return {
      id: 990015,
      name: 'Demo Traveller',
      email: 'demo@friendie.test',
      verified: true,
      statistics: { listings: 24, reviews: 128, rating: 4.9 },
    };
  const current = useAuthStore.getState(),
    owner = current.status === 'authenticated' ? current.user?.id : undefined;
  if (!owner)
    throw new ApiError('Sign in to view your profile.', 'unauthorized', 401);
  if (!appConfig.apiBaseUrl || !appConfig.profileApiVerified)
    throw new ApiError('Profile details are currently unavailable.', 'unknown');
  const isCurrent = () =>
    useAuthStore.getState().status === 'authenticated' &&
    useAuthStore.getState().user === current.user;
  const check = () => {
    if (signal?.aborted || !isCurrent())
      throw new ApiError('Profile request cancelled.', 'cancelled');
  };
  try {
    check();
    const token = await secureStorage.getToken();
    check();
    if (!token || !/^\S+$/.test(token)) {
      const removed = await secureStorage.removeTokenIfCurrent(
        token,
        isCurrent,
      );
      if (!removed)
        throw new ApiError('Profile request cancelled.', 'cancelled');
      if (isCurrent()) useAuthStore.getState().clear();
      throw new ApiError('Please sign in again.', 'unauthorized', 401);
    }
    const response = await apiClient.get<unknown>(endpoints.profile, {
      signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    check();
    if ((await secureStorage.getToken()) !== token)
      throw new ApiError('Profile request cancelled.', 'cancelled');
    check();
    const parsed = profileResponseSchema.safeParse(response.data);
    if (response.status !== 200 || !parsed.success)
      throw new ApiError(
        'The server returned an invalid profile response.',
        'unknown',
      );
    const result = parsed.data.data;
    if (result.id !== owner)
      throw new ApiError('Unable to access this profile.', 'forbidden', 403);
    // The existing per-owner query cache holds profile data. Keep Login's minimal
    // session and Keychain token unchanged; there is no second persistent store.
    return normalizeProfile(result);
  } catch (error) {
    if (error instanceof ApiError) {
      const messages = {
        unauthorized: 'Please sign in again.',
        forbidden: 'Unable to access this profile.',
        'not-found': 'Your profile is unavailable. Please try again.',
        'rate-limit':
          'Too many attempts. Please wait before retrying your profile.',
        network:
          'Unable to load your profile. Check your connection and try again.',
        server:
          'Profile details are temporarily unavailable. Please try again later.',
        cancelled: 'Profile request cancelled.',
      };
      throw new ApiError(
        messages[error.kind as keyof typeof messages] ??
          'Profile details are currently unavailable.',
        error.kind,
        error.status,
      );
    }
    throw new ApiError('Profile details are currently unavailable.', 'unknown');
  }
}
