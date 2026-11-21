import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { ApiError } from '../../../types/api';
import { AvatarDraft, validateAvatar } from './profilePhotoService';
import { getProfile, Profile } from './profileService';

type Upload = {
  avatar: AvatarDraft;
  phase: 'pending' | 'unknown' | 'confirmed';
  url?: string;
  observed?: Profile;
  previousUrl?: string | null;
  comparison?: 'unchanged' | 'changed' | 'unavailable';
};
// Mutation recovery only; authoritative profile data stays in the existing query cache.
let operation: Upload | undefined;
let removal:
  | { phase: 'pending' | 'unknown' | 'confirmed'; url?: string | null }
  | undefined;
useAuthStore.subscribe((state, previous) => {
  if (state.user !== previous.user || state.status !== previous.status) {
    operation = undefined;
    removal = undefined;
  }
});
export class AvatarDeleteUncertainError extends ApiError {
  constructor(public observedProfile?: Profile) {
    super(
      'Photo removal could not be confirmed. Your changes are kept. Further photo changes are blocked to avoid repeating an uncertain request.',
      'unknown',
    );
  }
}
export function avatarDeleteRecovery() {
  return removal;
}
export function completeAvatarDelete() {
  if (removal?.phase === 'confirmed') removal = undefined;
}
export async function deleteProfileAvatar(
  signal?: AbortSignal,
): Promise<string | null> {
  const session = useAuthStore.getState();
  if (session.status !== 'authenticated' || !session.user)
    throw new ApiError(
      'Sign in with a real account to remove a photo.',
      'unauthorized',
      401,
    );
  const current = () =>
    useAuthStore.getState().status === 'authenticated' &&
    useAuthStore.getState().user === session.user;
  const check = () => {
    if (!current() || signal?.aborted)
      throw new ApiError('Photo removal cancelled.', 'cancelled');
  };
  check();
  if (operation?.phase === 'pending' || removal?.phase === 'pending')
    throw new ApiError('A photo change is already in progress.', 'cancelled');
  if (operation?.phase === 'unknown')
    throw new AvatarUploadUncertainError(operation.observed);
  if (removal?.phase === 'unknown') throw new AvatarDeleteUncertainError();
  if (removal?.phase === 'confirmed') return removal.url!;
  const attempt: NonNullable<typeof removal> = { phase: 'pending' };
  removal = attempt;
  let dispatched = false;
  let token: string | null = null;
  try {
    token = await secureStorage.getToken();
    check();
    if (!token || !/^\S+$/.test(token))
      throw new ApiError('Please sign in again.', 'unauthorized', 401);
    dispatched = true;
    const response = await apiClient.delete<unknown>(endpoints.profileAvatar, {
      signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    check();
    if ((await secureStorage.getToken()) !== token)
      throw new ApiError('Session changed.', 'cancelled');
    check();
    const parsed = deleteResponseSchema.safeParse(response.data);
    if (response.status !== 200 || !parsed.success)
      throw new ApiError('Invalid photo removal response.', 'unknown');
    attempt.phase = 'confirmed';
    attempt.url = parsed.data.data.image_url;
    return attempt.url;
  } catch (error) {
    const definite =
      error instanceof ApiError &&
      [400, 401, 403, 404, 409, 422, 429].includes(error.status ?? 0);
    if (!dispatched || definite) {
      if (removal === attempt) removal = undefined;
      throw error;
    }
    attempt.phase = 'unknown';
    let observed: Profile | undefined;
    if (
      current() &&
      !signal?.aborted &&
      (await secureStorage.getToken()) === token
    ) {
      try {
        observed = await getProfile(signal);
      } catch {
        /* Keep the uncertainty hold. */
      }
    }
    check();
    if ((await secureStorage.getToken()) !== token)
      throw new ApiError('Session changed.', 'cancelled');
    throw new AvatarDeleteUncertainError(observed);
  }
}
export class AvatarUploadUncertainError extends ApiError {
  constructor(public observedProfile?: Profile, status?: number) {
    super(
      'Profile photo upload status could not be confirmed. Your selection is kept. Upload is blocked to avoid repeating an uncertain request.',
      'unknown',
      status,
    );
  }
}
export function avatarUploadRecovery() {
  return operation;
}
export function completeAvatarUpload(avatar?: AvatarDraft) {
  if (operation?.phase === 'confirmed' && operation.avatar === avatar)
    operation = undefined;
}

const responseSchema = z.object({
  success: z.literal(true),
  message: z.literal('Avatar updated successfully.'),
  data: z.object({
    image_url: z.url().refine(value => /^https?:\/\//i.test(value)),
  }),
});
const deleteResponseSchema = responseSchema.extend({
  message: z.literal('Avatar removed successfully.'),
  data: z.object({
    image_url: responseSchema.shape.data.shape.image_url.nullable(),
  }),
});
export async function uploadProfileAvatar(
  avatar: AvatarDraft,
  signal?: AbortSignal,
  previousUrl?: string | null,
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
  check();
  if (removal?.phase === 'pending')
    throw new ApiError('A photo change is already in progress.', 'cancelled');
  if (removal?.phase === 'unknown') throw new AvatarDeleteUncertainError();
  // A later explicit upload supersedes a previously confirmed removal.
  if (removal?.phase === 'confirmed') removal = undefined;
  if (operation?.phase === 'pending')
    throw new ApiError('A photo upload is already in progress.', 'cancelled');
  if (operation?.phase === 'unknown')
    throw new AvatarUploadUncertainError(operation.observed);
  if (operation?.phase === 'confirmed' && operation.avatar === avatar)
    return operation.url!;
  let image: AvatarDraft;
  try {
    image = validateAvatar(avatar);
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : 'Choose a valid image.',
      'validation',
    );
  }
  const attempt: Upload = { avatar, phase: 'pending', previousUrl };
  operation = attempt;
  let dispatched = false;
  try {
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
    dispatched = true;
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
    attempt.phase = 'confirmed';
    attempt.url = parsed.data.data.image_url;
    return attempt.url;
  } catch (error) {
    const definite =
      error instanceof ApiError &&
      [400, 401, 403, 404, 409, 413, 415, 422, 429].includes(error.status ?? 0);
    if (!dispatched || definite) {
      if (operation === attempt) operation = undefined;
      throw error;
    }
    attempt.phase = 'unknown';
    if (current() && !signal?.aborted) {
      // A changed URL alone cannot identify this request's bytes: another device
      // may also replace the avatar. Refresh for visibility, never infer delivery.
      try {
        attempt.observed = await getProfile(signal);
        attempt.comparison =
          previousUrl === undefined || attempt.observed.avatarUrl === undefined
            ? 'unavailable'
            : attempt.observed.avatarUrl === previousUrl
            ? 'unchanged'
            : 'changed';
      } catch {
        /* keep the hold */
      }
    }
    if (!current() || signal?.aborted)
      throw new ApiError('Photo upload cancelled.', 'cancelled');
    throw new AvatarUploadUncertainError(
      attempt.observed,
      error instanceof ApiError ? error.status : undefined,
    );
  }
}
