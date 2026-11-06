import { ApiError } from '../../../types/api';
import {
  EditProfileValues,
  editProfileSchema,
} from '../schemas/editProfileSchema';
import { AvatarDraft, validateAvatar } from './profilePhotoService';
import { Profile } from './profileService';
export const profileEditService = {
  async save(
    values: EditProfileValues,
    avatar?: AvatarDraft,
    removeAvatar = false,
  ): Promise<Profile> {
    editProfileSchema.parse(values);
    if (avatar) validateAvatar(avatar);
    if (avatar && removeAvatar)
      throw new ApiError(
        'Choose a photo replacement or removal, not both.',
        'validation',
      );
    // No update/upload endpoint, field allowlist or re-verification contract is verified.
    // Domain values must not be serialized to a guessed Laravel endpoint.
    throw new ApiError(
      'Saving profile changes is not connected yet. Your profile has not been changed.',
      'unknown',
    );
  },
};
