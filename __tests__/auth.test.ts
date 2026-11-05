import { authService } from '../src/features/auth/services/authService';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { ApiError } from '../src/types/api';
afterEach(() => jest.restoreAllMocks());
test('a revoked session finishes restoration as a guest', async () => {
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('revoked');
  jest.spyOn(authService, 'hydrate').mockImplementation(async () => {
    useAuthStore.getState().clear();
    throw new ApiError('Revoked', 'unauthorized', 401);
  });
  await expect(authService.restore()).resolves.toBeUndefined();
  expect(useAuthStore.getState().status).toBe('guest');
});
test('an offline restore keeps the credential and exposes retry to bootstrap', async () => {
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('saved');
  const remove = jest.spyOn(secureStorage, 'removeToken');
  jest
    .spyOn(authService, 'hydrate')
    .mockRejectedValue(new ApiError('Offline', 'network'));
  await expect(authService.restore()).rejects.toMatchObject({
    kind: 'network',
  });
  expect(remove).not.toHaveBeenCalled();
});

test('an incompatible profile response never authenticates the user', async () => {
  const { apiClient } = require('../src/services/api/apiClient');
  useAuthStore.getState().clear();
  jest.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: { id: 1 } } });
  await expect(authService.hydrate()).rejects.toThrow();
  expect(useAuthStore.getState().status).toBe('guest');
});
