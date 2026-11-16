import { ApiError } from '../../../types/api';
import { z } from 'zod';
import { appConfig } from '../../../constants/appConfig';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { logRegistrationEvent } from './registrationDiagnostics';
import {
  internationalPhone,
  registerSchema,
  RegisterValues,
} from '../schemas/registerSchema';

// Existing form normalization; consent remains local because the API rejects unknown fields.
export function prepareRegistration(values: RegisterValues) {
  const parsed = registerSchema.parse(values);
  return {
    ...parsed,
    phone: internationalPhone(parsed.phone, parsed.country)!,
  };
}
export interface RegisterRequest {
  name: string;
  email: string;
  phone: string;
  country_id: number;
  password: string;
  password_confirmation: string;
}
export interface RegistrationResult {
  message: string;
  requiresEmailVerification: true;
}
const responseSchema = z.object({
  success: z.literal(true),
  message: z.string().trim().min(1).max(1000),
  // AuthController::register returns an empty object, never a token/session.
  data: z.object({}).strict(),
});
const fieldNames: Record<string, keyof RegisterValues> = {
  name: 'fullName',
  email: 'email',
  phone: 'phone',
  country_id: 'country',
  password: 'password',
  password_confirmation: 'confirmPassword',
};
function registrationError(error: unknown): ApiError {
  if (!(error instanceof ApiError))
    return new ApiError(
      'Unable to create an account. Please try again.',
      'unknown',
    );
  const fields: Record<string, string[]> = {};
  for (const [backendField, formField] of Object.entries(fieldNames)) {
    const messages = z
      .array(z.string().trim().min(1).max(1000))
      .safeParse(error.fields?.[backendField]);
    if (messages.success && messages.data.length)
      fields[formField] = messages.data;
  }
  const message =
    error.kind === 'validation'
      ? 'Please check your registration details.'
      : error.kind === 'network'
      ? 'Unable to connect. Check your connection and try again.'
      : error.kind === 'rate-limit'
      ? 'Too many attempts. Please wait before trying again.'
      : error.kind === 'cancelled'
      ? 'Registration was cancelled.'
      : error.kind === 'server'
      ? 'Account creation is temporarily unavailable. Please try again later.'
      : 'Unable to create an account. Please review your details and try again.';
  return new ApiError(message, error.kind, error.status, fields);
}
let registrationSequence = 0;
export const registrationService = {
  async register(values: RegisterValues): Promise<RegistrationResult> {
    const parsed = prepareRegistration(values);
    if (!appConfig.registrationApiEnabled || !appConfig.apiBaseUrl) {
      logRegistrationEvent('BLOCKED', { reason: 'api-not-configured' });
      throw new ApiError(
        'Account creation is not configured. Please try again later.',
        'unknown',
      );
    }
    const countries: Record<string, number> = appConfig.registrationCountryIds;
    const countryId = countries[parsed.country];
    if (!Number.isSafeInteger(countryId) || countryId < 1) {
      logRegistrationEvent('BLOCKED', { reason: 'country-not-configured' });
      throw new ApiError(
        'Registration is not configured for the selected country.',
        'validation',
        undefined,
        {
          country: [
            'Select a country with a verified registration country ID.',
          ],
        },
      );
    }
    const payload: RegisterRequest = {
      name: parsed.fullName,
      email: parsed.email,
      phone: parsed.phone,
      country_id: countryId,
      password: parsed.password,
      password_confirmation: parsed.confirmPassword,
    };
    let response;
    const requestId = ++registrationSequence;
    logRegistrationEvent('REQUEST_STARTED', {
      requestId,
      method: 'POST',
      endpoint: '/auth/register',
    });
    try {
      response = await apiClient.post<unknown>(endpoints.register, payload, {
        headers: { Authorization: false },
      });
    } catch (error) {
      const failure = registrationError(error);
      logRegistrationEvent('REQUEST_FAILED', {
        requestId,
        kind: failure.kind,
        status: failure.status,
        invalidFields: Object.keys(failure.fields ?? {}),
      });
      throw failure;
    }
    const result = responseSchema.safeParse(response.data);
    if (response.status !== 201 || !result.success) {
      logRegistrationEvent('RESPONSE_INVALID', {
        requestId,
        status: response.status,
      });
      throw new ApiError(
        'The server returned an unexpected registration response. Please try again later.',
        'unknown',
      );
    }
    logRegistrationEvent('API_ACCEPTED', {
      requestId,
      status: response.status,
      requiresEmailVerification: true,
    });
    return { message: result.data.message, requiresEmailVerification: true };
  },
};
