import { logoutSession } from '../services/sessionLogout';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '../services/authService';
export function useLogin() {
  return useMutation({ mutationFn: authService.login });
}
export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => logoutSession(client),
  });
}
