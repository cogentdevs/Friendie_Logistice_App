import axios from 'axios';
const { randomBytes } = require('node:crypto') as {
  randomBytes: (size: number) => { toString: (encoding: string) => string };
};
const { env } = require('node:process') as {
  env: Record<string, string | undefined>;
};
import { apiClient } from '../src/services/api/apiClient';
import { appConfig } from '../src/constants/appConfig';
import { registrationService } from '../src/features/auth/services/registrationService';
import { useAuthStore } from '../src/store/authStore';
import { secureStorage } from '../src/services/storage/secureStorage';

// Explicit opt-in only: this exercises a real registration and creates a synthetic
// unverified customer through the API. Ordinary regression runs never write to a server.
const liveTest = env.FRIENDIE_RUN_REGISTER_LIVE === 'true' ? test : test.skip;
liveTest(
  'configured Laravel accepts public registration, returns neutral duplicate response and real 422 validation',
  async () => {
    if (
      !appConfig.registrationApiEnabled ||
      !appConfig.apiBaseUrl ||
      !appConfig.registrationCountryIds.PK
    )
      throw new Error(
        'Configure the registration base URL and verified PK ID before live testing.',
      );
    const originalAdapter = apiClient.defaults.adapter;
    const nodeAxios = require((
      require as unknown as { resolve: (id: string) => string }
    )
      .resolve('axios/package.json')
      .replace(/package\.json$/, 'dist/node/axios.cjs')) as typeof axios;
    apiClient.defaults.adapter = nodeAxios.getAdapter('http');
    const setToken = jest.spyOn(secureStorage, 'setToken');
    useAuthStore.getState().clear();
    try {
      await expect(
        apiClient.post(
          '/auth/register',
          {},
          { headers: { Authorization: false } },
        ),
      ).rejects.toMatchObject({
        status: 422,
        kind: 'validation',
        fields: {
          name: expect.any(Array),
          email: expect.any(Array),
          country_id: expect.any(Array),
        },
      });
      const identifier = randomBytes(8).toString('hex');
      const password = 'Registration-' + randomBytes(12).toString('hex') + '!';
      const values = {
        fullName: 'Mobile Registration Integration Test',
        email: `mobile-registration-${identifier}@example.test`,
        country: 'PK' as const,
        phone:
          '+92300' +
          String(parseInt(identifier.slice(0, 8), 16) % 10000000).padStart(
            7,
            '0',
          ),
        password,
        confirmPassword: password,
        acceptedTerms: true,
      };
      const first = await registrationService.register(values);
      expect(first.requiresEmailVerification).toBe(true);
      expect(first.message).toBe(
        'If registration is available for these details, a verification email will be sent. Please check your inbox and spam folder.',
      );
      const duplicate = await registrationService.register(values);
      expect(duplicate).toEqual(first);
      expect(useAuthStore.getState().status).toBe('guest');
      expect(setToken).not.toHaveBeenCalled();
    } finally {
      apiClient.defaults.adapter = originalAdapter;
      jest.restoreAllMocks();
    }
  },
  60000,
);
