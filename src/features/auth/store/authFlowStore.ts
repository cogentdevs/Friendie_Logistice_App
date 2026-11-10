import { create } from 'zustand';
import type { PendingAction } from '../types/pendingAction.types';
type Flow = {
  id: number;
  entry: 'Login' | 'Register';
  listingStack: 'HomeStack' | 'ListingsStack';
  action: PendingAction;
  phase: 'waiting' | 'login' | 'resuming';
};
// Intentionally memory-only. No credentials or contact details belong here.
export const useAuthFlowStore = create<{ flow: Flow | null }>(() => ({
  flow: null,
}));
let sequence = 0;
export function beginAuthFlow(
  action: PendingAction,
  listingStack: 'HomeStack' | 'ListingsStack' = 'ListingsStack',
  entry: 'Login' | 'Register' = 'Login',
) {
  if (useAuthFlowStore.getState().flow) return false;
  useAuthFlowStore.setState({
    flow: { id: ++sequence, action, listingStack, entry, phase: 'waiting' },
  });
  return true;
}
export function clearAuthFlow() {
  useAuthFlowStore.setState({ flow: null });
}
