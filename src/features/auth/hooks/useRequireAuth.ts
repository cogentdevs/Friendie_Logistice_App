import { requireAuth } from '../services/authFlowCoordinator';
// Stable service-backed API works in components and non-React event handlers.
export function useRequireAuth() {
  return requireAuth;
}
