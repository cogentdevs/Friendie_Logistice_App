import { z } from 'zod';
import { userSchema } from '../../auth/schemas/sessionSchema';
import { isUiPreviewActive } from '../../../store/developmentStore';
import { useAuthStore } from '../../../store/authStore';
import { appConfig } from '../../../constants/appConfig';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { ApiError } from '../../../types/api';
const count = z.number().int().nonnegative().nullable().optional();
export const profileSchema = userSchema.extend({
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
export async function getProfile(signal?: AbortSignal): Promise<Profile> {
  if (isUiPreviewActive())
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
  // Reuses the proposed /user route with an independently verified extended statistics DTO.
  const { data } = await apiClient.get(endpoints.me, { signal });
  const result = z.object({ data: profileSchema }).parse(data).data;
  if (
    useAuthStore.getState().user?.id !== owner ||
    useAuthStore.getState().status !== 'authenticated'
  )
    throw new ApiError('Please sign in again.', 'unauthorized', 401);
  if (result.id !== owner)
    throw new ApiError('Unable to access this profile.', 'forbidden', 403);
  return result;
}
