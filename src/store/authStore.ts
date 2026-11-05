import { create } from 'zustand';
import { User } from '../types/user';
interface AuthState {
  status: 'restoring' | 'guest' | 'authenticated';
  user: User | null;
  setUser: (user: User) => void;
  clear: () => void;
}
export const useAuthStore = create<AuthState>(set => ({
  status: 'restoring',
  user: null,
  setUser: user => set({ user, status: 'authenticated' }),
  clear: () => set({ user: null, status: 'guest' }),
}));
