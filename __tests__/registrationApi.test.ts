import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios';
import { apiClient } from '../src/services/api/apiClient';
import { appConfig } from '../src/constants/appConfig';
import { registrationService } from '../src/features/auth/services/registrationService';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';

const original = {
  base: appConfig.apiBaseUrl,
  enabled: appConfig.registrationApiEnabled,
  countries: appConfig.registrationCountryIds,
  clientBase: apiClient.defaults.baseURL,
  adapter: apiClient.defaults.adapter,
};
const values = {
  fullName: '  Example Customer ',
  email: ' CUSTOMER@Example.test ',
  country: 'PK' as const,
  phone: '0300 1234567',
  password: 'ExamplePassword123!',
  confirmPassword: 'ExamplePassword123!',
  acceptedTerms: true,
};
const message =
  'If registration is available for these details, a verification email will be sent. Please check your inbox and spam folder.';
let requests: InternalAxiosRequestConfig[];
function response(
  config: InternalAxiosRequestConfig,
  status = 201,
  data: unknown = { success: true, message, data: {} },
) {
  return {
    status,
    data,
    statusText: String(status),
    headers: new AxiosHeaders(),
    config,
  };
}
function install(adapter?: AxiosAdapter) {
  apiClient.defaults.adapter = async config => {
    requests.push(config);
    return adapter ? adapter(config) : response(config);
  };
}
beforeEach(() => {
  jest.spyOn(console, 'info').mockImplementation(() => {});
  requests = [];
  appConfig.apiBaseUrl = 'https://registration.example.test/api/v1';
  apiClient.defaults.baseURL = appConfig.apiBaseUrl;
  appConfig.registrationApiEnabled = true;
  appConfig.registrationCountryIds = { PK: 179 };
  useAuthStore.getState().clear();
  install();
});
afterEach(() => {
  appConfig.apiBaseUrl = original.base;
  appConfig.registrationApiEnabled = original.enabled;
  appConfig.registrationCountryIds = original.countries;
  apiClient.defaults.baseURL = original.clientBase;
  apiClient.defaults.adapter = original.adapter;
  useAuthStore.getState().clear();
  useDevelopmentStore.getState().exitPreview();
  jest.restoreAllMocks();
});

test('one public Axios POST uses the verified URL, exact six-field payload and no Keychain/token access', async () => {
  const getToken = jest.spyOn(secureStorage, 'getToken');
  const setToken = jest.spyOn(secureStorage, 'setToken');
  await expect(registrationService.register(values)).resolves.toEqual({
    message,
    requiresEmailVerification: true,
  });
  expect(requests).toHaveLength(1);
  const request = requests[0];
  expect(apiClient.getUri(request)).toBe(
    'https://registration.example.test/api/v1/auth/register',
  );
  expect(request.method).toBe('post');
  expect(JSON.parse(request.data)).toEqual({
    name: 'Example Customer',
    email: 'customer@example.test',
    phone: '+923001234567',
    country_id: 179,
    password: values.password,
    password_confirmation: values.confirmPassword,
  });
  expect(request.headers.get('Accept')).toBe('application/json');
  expect(request.headers.get('Content-Type')).toBe('application/json');
  expect(request.headers.toJSON()).not.toHaveProperty('Authorization');
  expect(getToken).not.toHaveBeenCalled();
  expect(setToken).not.toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
  expect(console.info).toHaveBeenCalledWith('[Register] API_ACCEPTED', {
    requestId: expect.any(Number),
    status: 201,
    requiresEmailVerification: true,
  });
  const output = JSON.stringify(jest.mocked(console.info).mock.calls);
  for (const sensitive of [
    values.fullName.trim(),
    values.email.trim().toLowerCase(),
    '+923001234567',
    values.password,
  ])
    expect(output).not.toContain(sensitive);
});

test('real registration still sends its request while the UI demo preview is active', async () => {
  useDevelopmentStore.setState({ previewActive: true });
  await registrationService.register(values);
  expect(requests).toHaveLength(1);
  expect(useDevelopmentStore.getState().previewActive).toBe(true);
  expect(useAuthStore.getState().status).toBe('guest');
});

test('country IDs must be explicitly configured; no guessed default ID or other API call', async () => {
  appConfig.registrationCountryIds = {};
  await expect(registrationService.register(values)).rejects.toMatchObject({
    kind: 'validation',
    fields: { country: expect.any(Array) },
  });
  expect(requests).toHaveLength(0);
});

test('422 Laravel fields are mapped to the unchanged form; unknown/malformed fields are discarded', async () => {
  install(async config => {
    throw new AxiosError(
      'validation',
      'ERR_BAD_REQUEST',
      config,
      undefined,
      response(config, 422, {
        success: false,
        message: 'Validation failed',
        errors: {
          name: ['The name field is required.'],
          email: ['The email field is invalid.'],
          phone: ['The phone field is required.'],
          country_id: ['The selected country id is invalid.'],
          password: ['The password field is invalid.'],
          password_confirmation: ['The password confirmation does not match.'],
          ignored: ['Unexpected'],
          malformed: { nested: 'bad' },
        },
      }),
    );
  });
  await expect(registrationService.register(values)).rejects.toMatchObject({
    kind: 'validation',
    status: 422,
    fields: {
      fullName: ['The name field is required.'],
      email: ['The email field is invalid.'],
      phone: ['The phone field is required.'],
      country: ['The selected country id is invalid.'],
      password: ['The password field is invalid.'],
      confirmPassword: ['The password confirmation does not match.'],
    },
  });
});

test.each([400, 401, 403, 409, 429, 500])(
  'HTTP %s stays retryable and never exposes a server trace or authenticates',
  async status => {
    install(async config => {
      throw new AxiosError(
        'failure',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        response(config, status, {
          message: 'PRIVATE_SERVER_TRACE',
          errors: { email: { bad: true } },
        }),
      );
    });
    await expect(registrationService.register(values)).rejects.toMatchObject({
      status,
      message: expect.not.stringContaining('PRIVATE_SERVER_TRACE'),
    });
    expect(useAuthStore.getState().status).toBe('guest');
  },
);

test.each(['ERR_NETWORK', 'ECONNABORTED'])(
  '%s is normalized as a friendly network error',
  async code => {
    install(async config => {
      throw new AxiosError('internal transport details', code, config);
    });
    await expect(registrationService.register(values)).rejects.toMatchObject({
      kind: 'network',
      message: 'Unable to connect. Check your connection and try again.',
    });
  },
);

test.each([
  { success: false, message, data: {} },
  { success: true, message, data: { token: 'unexpected-session' } },
  { success: true, message },
  '<html>server failure</html>',
])(
  'unexpected successful HTTP bodies never report accepted registration',
  async data => {
    install(async config => response(config, 201, data));
    await expect(registrationService.register(values)).rejects.toMatchObject({
      kind: 'unknown',
      message: expect.stringContaining('unexpected registration response'),
    });
  },
);

test('a public 401 cannot revoke an existing authenticated session', async () => {
  useAuthStore
    .getState()
    .setUser({ id: 71, name: 'Member', email: 'member@example.test' });
  const remove = jest.spyOn(secureStorage, 'removeTokenIfCurrent');
  install(async config => {
    throw new AxiosError(
      'unauthorized',
      'ERR_BAD_REQUEST',
      config,
      undefined,
      response(config, 401, { message: 'Unauthenticated' }),
    );
  });
  await expect(registrationService.register(values)).rejects.toMatchObject({
    kind: 'unauthorized',
  });
  expect(remove).not.toHaveBeenCalled();
  expect(useAuthStore.getState().user?.id).toBe(71);
});

test('validation diagnostics include status and field names without response contents', async () => {
  install(async config => {
    throw new AxiosError(
      'private-error-detail',
      'ERR_BAD_REQUEST',
      config,
      undefined,
      response(config, 422, {
        message: 'private-server-message',
        errors: { email: ['private-email-value'] },
      }),
    );
  });
  await expect(registrationService.register(values)).rejects.toMatchObject({
    status: 422,
  });
  expect(console.info).toHaveBeenCalledWith('[Register] REQUEST_FAILED', {
    requestId: expect.any(Number),
    kind: 'validation',
    status: 422,
    invalidFields: ['email'],
  });
  expect(JSON.stringify(jest.mocked(console.info).mock.calls)).not.toContain(
    'private-',
  );
});

test('normal production runtime does not emit registration diagnostics', async () => {
  const previousStatic = appConfig.staticTestingBuild;
  jest.replaceProperty(
    globalThis as typeof globalThis & { __DEV__: boolean },
    '__DEV__',
    false,
  );
  appConfig.staticTestingBuild = false;
  try {
    await registrationService.register(values);
    expect(console.info).not.toHaveBeenCalled();
  } finally {
    appConfig.staticTestingBuild = previousStatic;
  }
});
