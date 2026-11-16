import { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../src/services/api/apiClient';
import { ApiError } from '../src/types/api';
import { appConfig } from '../src/constants/appConfig';
import {
  getCategories,
  categoriesDataSource,
  categoriesErrorMessage,
} from '../src/features/home/services/categoriesService';
import { homeService } from '../src/features/home/services/homeService';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
const original = {
  adapter: apiClient.defaults.adapter,
  base: apiClient.defaults.baseURL,
  testing: appConfig.staticTestingBuild,
};
let requests: InternalAxiosRequestConfig[];
const items = [
  { id: 72, name: 'Documents', image_url: null },
  {
    id: 9,
    name: 'Food Items',
    image_url: 'https://media.example.test/food.jpg',
  },
];
let body: unknown;
beforeEach(() => {
  requests = [];
  body = {
    success: true,
    message: 'Categories retrieved successfully.',
    data: { items },
  };
  appConfig.staticTestingBuild = false;
  apiClient.defaults.baseURL = 'https://api.example.test/api/v1';
  apiClient.defaults.adapter = async config => {
    requests.push(config);
    return {
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
      data: body,
    };
  };
  useAuthStore.getState().clear();
});
afterEach(() => {
  apiClient.defaults.adapter = original.adapter;
  apiClient.defaults.baseURL = original.base;
  appConfig.staticTestingBuild = original.testing;
  jest.restoreAllMocks();
});
test.each(['guest', 'member'])(
  'public %s request preserves IDs, names, server order and image mapping without a token',
  async state => {
    if (state === 'member')
      useAuthStore
        .getState()
        .setUser({ id: 3, name: 'Member', email: 'member@example.test' });
    const token = jest.spyOn(secureStorage, 'getToken');
    expect(await homeService.categories()).toEqual([
      { id: '72', name: 'Documents' },
      { id: '9', name: 'Food Items', imageUrl: items[1].image_url },
    ]);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'get',
      url: '/categories',
      baseURL: 'https://api.example.test/api/v1',
    });
    expect(requests[0].headers.Authorization).toBe(false);
    expect(requests[0].params).toBeUndefined();
    expect(token).not.toHaveBeenCalled();
  },
);
test('optional search only sends the documented trimmed parameter', async () => {
  await getCategories(undefined, ' Food ');
  expect(requests[0].params).toEqual({ search: 'Food' });
  await expect(getCategories(undefined, 'x'.repeat(101))).rejects.toMatchObject(
    { kind: 'validation' },
  );
  expect(requests).toHaveLength(1);
});
test('empty result remains empty without fixtures', async () => {
  body = { success: true, message: 'OK', data: { items: [] } };
  expect(await getCategories()).toEqual([]);
});
test.each([
  {},
  { success: false, message: 'failed', data: { items } },
  { success: true, message: 'OK', data: { categories: items } },
  {
    success: true,
    message: 'OK',
    data: { items: [{ id: '9', name: 'Wrong ID', image_url: null }] },
  },
  {
    success: true,
    message: 'OK',
    data: {
      items: [
        { id: 1, name: 'Unsafe image', image_url: 'file:///private.jpg' },
      ],
    },
  },
])(
  'malformed responses reject without substituting fixtures: %j',
  async invalid => {
    body = invalid;
    await expect(getCategories()).rejects.toBeInstanceOf(ApiError);
  },
);
test.each([401, 403, 404, 429, 500])(
  'HTTP %s uses existing normalization and public failures never clear login',
  async status => {
    useAuthStore
      .getState()
      .setUser({ id: 7, name: 'Current', email: 'current@example.test' });
    const owner = useAuthStore.getState().user;
    apiClient.defaults.adapter = async config => {
      throw new AxiosError('Failure', 'ERR_BAD_RESPONSE', config, undefined, {
        status,
        statusText: 'Failure',
        config,
        headers: new AxiosHeaders(),
        data: { message: 'Internal private error' },
      });
    };
    const error = await getCategories().catch(value => value);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(status);
    expect(categoriesErrorMessage(error)).not.toContain('Internal private');
    expect(useAuthStore.getState().user).toBe(owner);
  },
);
test.each(['ERR_NETWORK', 'ECONNABORTED'])(
  '%s is a friendly error without fixture fallback',
  async code => {
    apiClient.defaults.adapter = async config => {
      throw new AxiosError('network', code, config);
    };
    const error = await getCategories().catch(value => value);
    expect(error.kind).toBe('network');
    expect(categoriesErrorMessage(error)).toContain('Unable to connect');
  },
);
test('abort prevents an outdated response from resolving', async () => {
  const controller = new AbortController();
  apiClient.defaults.adapter = async config => {
    controller.abort();
    return {
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
      data: body,
    };
  };
  await expect(getCategories(controller.signal)).rejects.toMatchObject({
    kind: 'cancelled',
  });
});
test('only explicitly labelled static testing mode uses the original fixture identities', async () => {
  expect(categoriesDataSource()).toBe('api');
  appConfig.staticTestingBuild = true;
  expect(await homeService.categories()).toEqual([
    { id: 'Food Items', name: 'Food Items' },
    { id: 'Personal Items', name: 'Personal Items' },
    { id: 'Documents', name: 'Documents' },
  ]);
  expect(requests).toHaveLength(0);
});
