import { appConfig } from '../../../constants/appConfig';
import type { ApiErrorKind } from '../../../types/api';

type RegistrationEvent =
  | 'FORM_VALIDATION_FAILED'
  | 'BLOCKED'
  | 'REQUEST_STARTED'
  | 'API_ACCEPTED'
  | 'REQUEST_FAILED'
  | 'RESPONSE_INVALID';

// Only diagnostic metadata belongs here, never values, error objects or API bodies.
export function logRegistrationEvent(
  event: RegistrationEvent,
  details: {
    requestId?: number;
    method?: 'POST';
    endpoint?: '/auth/register';
    status?: number;
    kind?: ApiErrorKind;
    reason?: 'api-not-configured' | 'country-not-configured';
    invalidFields?: string[];
    requiresEmailVerification?: true;
  },
) {
  if (__DEV__ || appConfig.staticTestingBuild)
    console.info(`[Register] ${event}`, details);
}
