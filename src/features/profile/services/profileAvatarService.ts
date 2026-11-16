import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { ApiError } from '../../../types/api';
import { AvatarDraft, validateAvatar } from './profilePhotoService';

const responseSchema = z.object({
  success: z.literal(true),
  message: z.literal('Avatar updated successfully.'),
  data: z.object({
    image_url: z.url().refine(value => /^https?:\/\//i.test(value)),
  }),
});
export async function uploadProfileAvatar(
  avatar: AvatarDraft,
  signal?: AbortSignal,
): Promise<string> {
  const session = useAuthStore.getState();
  if (session.status !== 'authenticated' || !session.user)
    throw new ApiError(
      'Sign in with a real account to upload a photo.',
      'unauthorized',
      401,
    );
  const current = () =>
    useAuthStore.getState().status === 'authenticated' &&
    useAuthStore.getState().user === session.user;
  const check = () => {
    if (!current() || signal?.aborted)
      throw new ApiError('Photo upload cancelled.', 'cancelled');
  };
  let image: AvatarDraft;
  try {
    image = validateAvatar(avatar);
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : 'Choose a valid image.',
      'validation',
    );
  }
  const token = await secureStorage.getToken();
  check();
  if (!token || !/^\S+$/.test(token))
    throw new ApiError('Please sign in again.', 'unauthorized', 401);
  const extension =
    image.type === 'image/png'
      ? 'png'
      : image.type === 'image/webp'
      ? 'webp'
      : 'jpg';
  const validName =
    image.fileName &&
    /^[\w.-]+\.(jpe?g|png|webp)$/i.test(image.fileName) &&
    (extension === 'jpg'
      ? /\.jpe?g$/i
      : new RegExp(`\\.${extension}$`, 'i')
    ).test(image.fileName);
  const body = new FormData();
  body.append('avatar', {
    uri: image.uri,
    name: validName ? image.fileName! : `avatar.${extension}`,
    type: image.type,
  });
  const response = await apiClient.post<unknown>(
    endpoints.profileAvatar,
    body,
    {
      signal,
      // Override the client's JSON default. Axios' RN adapter supplies the native boundary.
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  check();
  if ((await secureStorage.getToken()) !== token)
    throw new ApiError('Session changed.', 'cancelled');
  check();
  const parsed = responseSchema.safeParse(response.data);
  if (response.status !== 200 || !parsed.success)
    throw new ApiError(
      'The server did not return a usable saved photo URL. Refresh your profile before retrying.',
      'unknown',
    );
  return parsed.data.data.image_url;
}
