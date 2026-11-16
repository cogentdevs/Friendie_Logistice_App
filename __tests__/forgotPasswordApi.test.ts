import axios from 'axios';
import { apiClient } from '../src/services/api/apiClient';
import { appConfig } from '../src/constants/appConfig';
import {
  passwordResetService,
  passwordResetError,
} from '../src/features/auth/services/passwordResetService';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
const message =
  'If an eligible account matches that email, a link will be sent. Please check your inbox and spam folder.';
const acceptance = { success: true, message, data: {} };
const adapter = apiClient.defaults.adapter;
const member = { id: 8, name: 'Member', email: 'member@example.test' };
function respond(data: unknown = acceptance, status = 200) {
  apiClient.defaults.adapter = async config => ({
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.getState().setUser(member);
  respond();
});
afterEach(() => {
  apiClient.defaults.adapter = adapter;
  jest.restoreAllMocks();
});
test('public recovery uses existing Axios/base URL, only normalized email, no token access and no session mutation', async () => {
  const tokenRead = jest.spyOn(secureStorage, 'getToken');
  const tokenWrite = jest.spyOn(secureStorage, 'setToken');
  const sessionWrite = jest.spyOn(secureStorage, 'setSession');
  const remove = jest.spyOn(secureStorage, 'removeToken');
  const conditionalRemove = jest.spyOn(secureStorage, 'removeTokenIfCurrent');
  let count = 0;
  apiClient.defaults.adapter = async config => {
    count++;
    expect(config.baseURL).toBe(appConfig.apiBaseUrl);
    expect(config.url).toBe('/auth/forgot-password');
    expect(config.method).toBe('post');
    expect(JSON.parse(config.data)).toEqual({ email: 'member@example.test' });
    expect(config.headers.Authorization).toBe(false);
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data: acceptance,
    };
  };
  expect(
    await passwordResetService.request({ email: ' MEMBER@Example.test ' }),
  ).toEqual({ accepted: true });
  expect(count).toBe(1);
  for (const spy of [
    tokenRead,
    tokenWrite,
    sessionWrite,
    remove,
    conditionalRemove,
  ])
    expect(spy).not.toHaveBeenCalled();
  expect(useAuthStore.getState().user).toEqual(member);
  expect(useAuthStore.getState().status).toBe('authenticated');
});
test.each([400, 401, 403, 404, 422, 429, 500])(
  'HTTP %s cannot display success, enumerate account, or revoke an existing session',
  async status => {
    apiClient.defaults.adapter = async config => {
      throw new axios.AxiosError(
        'failed',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        {
          status,
          statusText: '',
          headers: {},
          config,
          data: {
            success: false,
            message: 'Email exists: private@example.test',
            errors: { email: ['Account not found'] },
          },
        },
      );
    };
    try {
      await passwordResetService.request({ email: 'member@example.test' });
      throw new Error('Unexpected success');
    } catch (error) {
      expect(error).toMatchObject({ status });
      expect(passwordResetError(error)).not.toContain('private@example.test');
      expect(passwordResetError(error)).not.toContain('Account not found');
    }
    expect(useAuthStore.getState().status).toBe('authenticated');
  },
);
test('Laravel email format error is retained as safe field-level feedback', async () => {
  apiClient.defaults.adapter = async config => {
    throw new axios.AxiosError(
      'validation',
      'ERR_BAD_RESPONSE',
      config,
      undefined,
      {
        status: 422,
        statusText: '',
        headers: {},
        config,
        data: {
          message: 'Validation failed',
          errors: { email: ['The email field must be a valid email address.'] },
        },
      },
    );
  };
  await expect(
    passwordResetService.request({ email: 'member@example.test' }),
  ).rejects.toMatchObject({
    kind: 'validation',
    fields: { email: ['The email field must be a valid email address.'] },
  });
});
test.each(['ERR_NETWORK', 'ECONNABORTED'])(
  '%s produces friendly failure and keeps authentication unchanged',
  async code => {
    apiClient.defaults.adapter = async config => {
      throw new axios.AxiosError('private details', code, config);
    };
    await expect(
      passwordResetService.request({ email: 'member@example.test' }),
    ).rejects.toMatchObject({
      kind: 'network',
      message:
        'Connection failed or timed out. Check your connection and try again.',
    });
    expect(useAuthStore.getState().status).toBe('authenticated');
  },
);
test.each([
  {},
  { success: false, message, data: {} },
  { success: true, message, data: { token: 'must-not-use' } },
  { success: true, message: 'Email definitely sent!', data: {} },
])('unexpected response never creates fake acceptance', async data => {
  respond(data);
  await expect(
    passwordResetService.request({ email: 'member@example.test' }),
  ).rejects.toMatchObject({ kind: 'unknown' });
  expect(useAuthStore.getState().status).toBe('authenticated');
});
test('unexpected HTTP success status does not count as the verified acceptance', async () => {
  respond(acceptance, 201);
  await expect(
    passwordResetService.request({ email: 'member@example.test' }),
  ).rejects.toMatchObject({ kind: 'unknown' });
});
test.each(['', 'invalid', `${'a'.repeat(250)}@example.test`])(
  'invalid local email never sends a request',
  async email => {
    const post = jest.spyOn(apiClient, 'post');
    await expect(passwordResetService.request({ email })).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  },
);
test('demo testing email never initiates real or fake password recovery', async () => {
  const post = jest.spyOn(apiClient, 'post');
  await expect(
    passwordResetService.request({ email: ' DEMO@FRIENDIE.TEST ' }),
  ).rejects.toThrow('UI testing account');
  expect(post).not.toHaveBeenCalled();
});
test('unknown account receives only neutral acceptance when the server accepts', async () => {
  expect(
    await passwordResetService.request({ email: 'unknown@example.test' }),
  ).toEqual({ accepted: true });
  expect(useAuthStore.getState().user).toEqual(member);
});
