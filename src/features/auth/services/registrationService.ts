import { ApiError } from '../../../types/api';
import {
  internationalPhone,
  registerSchema,
  RegisterValues,
} from '../schemas/registerSchema';

// Domain input only: no Laravel field mapping or endpoint is assumed.
export function prepareRegistration(values: RegisterValues) {
  const parsed = registerSchema.parse(values);
  return {
    ...parsed,
    phone: internationalPhone(parsed.phone, parsed.country)!,
  };
}
export const registrationService = {
  async register(values: RegisterValues): Promise<void> {
    prepareRegistration(values);
    // Replace this boundary after the endpoint, payload, password policy and
    // verification/session response are confirmed. Never fabricate an account/token.
    throw new ApiError(
      'Account creation is not connected yet. Please try again later.',
      'unknown',
    );
  },
};
