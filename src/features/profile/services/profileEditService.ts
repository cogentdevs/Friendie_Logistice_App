import { ApiError } from '../../../types/api';
import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { appConfig } from '../../../constants/appConfig';
import {
  internationalPhone,
  phoneCountries,
} from '../../auth/schemas/registerSchema';
import { clearRevokedSession } from '../../auth/services/sessionLogout';
import {
  EditProfileValues,
  createEditProfileSchema,
} from '../schemas/editProfileSchema';
import { AvatarDraft } from './profilePhotoService';
import {
  Profile,
  getProfile,
  normalizeProfile,
  profileResponseSchema,
} from './profileService';
import {
  uploadProfileAvatar,
  AvatarUploadUncertainError,
} from './profileAvatarService';
export class AvatarPartialSaveError extends ApiError {
  constructor(public avatarUrl: string, cause: unknown) {
    super(
      'Photo uploaded, but the remaining profile save could not be confirmed. Your edits are preserved; try again.',
      cause instanceof ApiError ? cause.kind : 'unknown',
      cause instanceof ApiError ? cause.status : undefined,
      cause instanceof ApiError ? cause.fields : undefined,
    );
  }
}
export function profileCallingCountry(
  profile: Profile,
): EditProfileValues['callingCountry'] {
  const code = profile.countryCode ?? profile.location?.country.code;
  return (
    phoneCountries.find(country => country.id === code)?.id ??
    phoneCountries.find(
      country =>
        profile.countryId != null &&
        appConfig.registrationCountryIds[country.id] === profile.countryId,
    )?.id ??
    phoneCountries.find(country =>
      profile.phone?.startsWith('+' + country.dial),
    )?.id ??
    null
  );
}
const updateResponseSchema = z.object({
  success: z.literal(true),
  message: z.enum([
    'Profile updated successfully.',
    'Profile updated. Verify your new email and sign in again.',
  ]),
  data: z.object({
    profile: profileResponseSchema.shape.data,
    verification_required: z.boolean(),
    reauthentication_required: z.boolean(),
  }),
});
export type ProfileUpdateResult = {
  profile: Profile;
  reauthenticationRequired: boolean;
  verificationRequired: boolean;
};
let busy = false;
export const profileEditService = {
  async save(
    values: EditProfileValues,
    avatar?: AvatarDraft,
    removeAvatar = false,
    baseline?: Profile,
    signal?: AbortSignal,
  ): Promise<ProfileUpdateResult> {
    if (busy)
      throw new ApiError(
        'A profile update is already in progress.',
        'cancelled',
      );
    const session = useAuthStore.getState();
    if (session.status !== 'authenticated' || !session.user)
      throw new ApiError(
        'Sign in with a real account to update your profile. Demo editing is unavailable.',
        'unauthorized',
        401,
      );
    if (!baseline || baseline.id !== session.user.id)
      throw new ApiError('Reload your profile before saving.', 'validation');
    if (removeAvatar)
      throw new ApiError(
        'Photo removal is not connected. Restore the original photo before saving.',
        'validation',
      );
    const current = () =>
      useAuthStore.getState().status === 'authenticated' &&
      useAuthStore.getState().user === session.user;
    const check = () => {
      if (!current() || signal?.aborted)
        throw new ApiError('Profile update cancelled.', 'cancelled');
    };
    busy = true;
    let uploadedUrl: string | undefined;
    try {
      const input = createEditProfileSchema(!baseline.phone).parse(values);
      const phone = input.phone
        ? internationalPhone(input.phone, input.callingCountry!)
        : undefined;
      if (input.phone && !phone)
        throw new ApiError('Check the phone number.', 'validation', undefined, {
          phone: ['Check this profile field.'],
        });
      const payload: {
        name?: string;
        email?: string;
        phone?: string;
        country_id?: number;
      } = {};
      if (input.name !== baseline.name) payload.name = input.name;
      if (input.email !== baseline.email.trim().toLowerCase())
        payload.email = input.email;
      if (phone && phone !== baseline.phone) payload.phone = phone;
      if (input.callingCountry !== profileCallingCountry(baseline)) {
        const countryId =
          appConfig.registrationCountryIds[input.callingCountry!];
        if (!Number.isSafeInteger(countryId) || countryId < 1)
          throw new ApiError(
            'Selected country is not configured.',
            'validation',
            undefined,
            { country_id: ['Select a supported country.'] },
          );
        payload.country_id = countryId;
      }
      if (!Object.keys(payload).length && !avatar)
        throw new ApiError(
          'No supported profile changes to save.',
          'validation',
        );
      const token = await secureStorage.getToken();
      check();
      if (!token || !/^\S+$/.test(token))
        throw new ApiError('Please sign in again.', 'unauthorized', 401);
      if (avatar) {
        // Upload before text updates: changing email revokes the current token.
        uploadedUrl = await uploadProfileAvatar(
          avatar,
          signal,
          baseline.avatarUrl,
        );
        check();
        if (!Object.keys(payload).length) {
          const refreshed = await getProfile(signal);
          check();
          if (refreshed.avatarUrl !== uploadedUrl)
            throw new ApiError(
              'Saved photo could not be confirmed in the profile response.',
              'unknown',
            );
          return {
            profile: refreshed,
            reauthenticationRequired: false,
            verificationRequired: false,
          };
        }
      }
      const response = await apiClient.put<unknown>(
        endpoints.profile,
        payload,
        { signal, headers: { Authorization: `Bearer ${token}` } },
      );
      check();
      if ((await secureStorage.getToken()) !== token)
        throw new ApiError('Session changed.', 'cancelled');
      check();
      const parsed = updateResponseSchema.safeParse(response.data);
      if (response.status !== 200 || !parsed.success)
        throw new ApiError(
          'The server did not confirm the profile update.',
          'unknown',
        );
      const data = parsed.data.data;
      const updated = normalizeProfile(data.profile);
      if (uploadedUrl && updated.avatarUrl !== uploadedUrl)
        throw new ApiError(
          'Saved photo could not be confirmed in the profile response.',
          'unknown',
        );
      const emailChanged =
        updated.email.trim().toLowerCase() !==
        baseline.email.trim().toLowerCase();
      if (
        updated.id !== session.user.id ||
        data.reauthentication_required !== emailChanged ||
        data.verification_required !== emailChanged ||
        (emailChanged && updated.verified === true)
      )
        throw new ApiError(
          'The server returned inconsistent profile data.',
          'unknown',
        );
      if (data.reauthentication_required) {
        try {
          await clearRevokedSession(token, session.user);
        } catch (error) {
          if (error instanceof ApiError) throw error;
          throw new ApiError(
            'Your profile was updated, but secure local sign-out failed. Please sign out before continuing.',
            'unknown',
            200,
          );
        }
      }
      return {
        profile: updated,
        reauthenticationRequired: data.reauthentication_required,
        verificationRequired: data.verification_required,
      };
    } catch (error) {
      if (
        uploadedUrl &&
        current() &&
        !(error instanceof ApiError && error.kind === 'cancelled')
      )
        throw new AvatarPartialSaveError(uploadedUrl, error);
      if (error instanceof ApiError) throw error;
      if (error instanceof z.ZodError)
        throw new ApiError(
          'Check the profile fields and try again.',
          'validation',
        );
      throw new ApiError(
        'Unable to confirm the profile update. Your changes are unsaved.',
        'unknown',
      );
    } finally {
      busy = false;
    }
  },
};
export function profileUpdateErrorMessage(error: unknown): string {
  if (error instanceof AvatarUploadUncertainError) return error.message;
  if (error instanceof AvatarPartialSaveError) return error.message;
  if (!(error instanceof ApiError))
    return 'Unable to confirm the profile update. Please try again.';
  if (error.status === 200) return error.message;
  if (error.fields?.profile?.[0] === 'These profile details are unavailable.')
    return 'These profile details are unavailable.';
  if (
    error.kind === 'validation' &&
    /^(Photo removal is not connected\.|Choose a |The avatar )/.test(
      error.message,
    )
  )
    return error.message;
  const messages = {
    network: 'Unable to connect. Your changes are unsaved. Please try again.',
    unauthorized: 'Please sign in with a real account to update your profile.',
    forbidden: 'Your account cannot update this profile right now.',
    'rate-limit': 'Too many attempts. Please wait before trying again.',
    server: 'Profile updates are temporarily unavailable. Please try again.',
    validation: 'Check your profile fields and try again.',
  };
  if (error.status === 413)
    return 'The selected image is too large. Choose an image up to 2 MB.';
  if (error.kind === 'validation' && error.fields?.avatar)
    return 'Choose a valid JPEG, PNG or WebP image up to 2 MB and 2048 by 2048 pixels.';
  return (
    messages[error.kind as keyof typeof messages] ??
    'Unable to confirm the profile update. Please try again.'
  );
}
