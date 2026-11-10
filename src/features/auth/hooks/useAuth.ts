import { logoutSession } from '../services/sessionLogout';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LoginInput } from '../schemas/loginSchema';
import { authService } from '../services/authService';
export function useLogin(signal?: AbortSignal) {
  return useMutation({
    mutationFn: (input: LoginInput) => authService.login(input, signal),
  });
}
export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => logoutSession(client),
  });
}
