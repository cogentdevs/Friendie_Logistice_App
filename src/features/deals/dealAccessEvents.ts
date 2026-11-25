import { useAuthStore } from '../../store/authStore';
const listeners = new Set<(dealId?: number) => void>();
export function subscribeDealRevocation(listener: (dealId?: number) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function revokeDealAccess(dealId?: number) {
  listeners.forEach(listener => listener(dealId));
}
useAuthStore.subscribe((state, previous) => {
  if (state.user !== previous.user || state.status !== previous.status)
    revokeDealAccess();
});
