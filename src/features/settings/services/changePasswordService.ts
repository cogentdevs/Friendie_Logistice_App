import { isUiPreviewActive } from '../../../store/developmentStore';
import { ApiError } from '../../../types/api';
import { useAuthStore } from '../../../store/authStore';
import {
  ChangePasswordValues,
  createChangePasswordSchema,
  PasswordChangeResult,
  PasswordPolicy,
} from '../schemas/changePasswordSchema';
// Set only from a verified backend policy; registration's local preview baseline is not a contract.
export const passwordChangePolicy: PasswordPolicy | null = null;
export const changePasswordService = {
  async update(values: ChangePasswordValues): Promise<PasswordChangeResult> {
    createChangePasswordSchema(passwordChangePolicy).parse(values);
    if (isUiPreviewActive())
      throw new ApiError(
        'Password updates are not connected yet. Your password has not been changed.',
        'unknown',
      );
    if (useAuthStore.getState().status !== 'authenticated')
      throw new ApiError(
        'Sign in to change your password.',
        'unauthorized',
        401,
      );
    // No verified authenticated endpoint, payload mapping or session response exists.
    // Do not guess a URL, serialize credentials or fabricate confirmation.
    throw new ApiError(
      'Password updates are not connected yet. Your password has not been changed.',
      'unknown',
    );
  },
};
