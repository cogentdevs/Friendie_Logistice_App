import axios from 'axios';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { appConfig } from '../src/constants/appConfig';
import {
  getReceivedVisitorReviews,
  visitorReviewErrorMessage,
} from '../src/features/reviews/services/visitorReviewsService';
const member = { id: 8, name: 'Member', email: 'member@example.test' };
const item = {
  id: 42,
  listing: { id: 10, title: 'Backend listing' },
  reviewer: { id: 22, display_name: 'Reviewer' },
  reviewed_customer: { id: 8, display_name: 'Member' },
  rating: 0,
  review: 'Actual comment',
  date_time: '2026-11-16',
  created_at: '2026-11-16 10:00:00',
  updated_at: null,
};
const original = {
  adapter: apiClient.defaults.adapter,
  preview: appConfig.uiPreviewEnabled,
};
let token: string | null;
let body: unknown;
let count: number;
beforeEach(() => {
  token = 'received-review-contract-test-token';
  count = 0;
  body = {
    success: true,
    message: 'Received reviews retrieved successfully.',
    data: {
      items: [item],
      pagination: { current_page: 1, per_page: 20, total: 22, last_page: 2 },
    },
  };
  useAuthStore.getState().setUser(member);
  useDevelopmentStore.setState({ previewActive: false });
  jest.spyOn(secureStorage, 'getToken').mockImplementation(async () => token);
  apiClient.defaults.adapter = async config => {
    count++;
    return { status: 200, statusText: 'OK', config, headers: {}, data: body };
  };
});
afterEach(() => {
  apiClient.defaults.adapter = original.adapter;
  appConfig.uiPreviewEnabled = original.preview;
  jest.restoreAllMocks();
});
test('private GET uses captured real Bearer, exact page parameters, and verified fields including rating zero', async () => {
  apiClient.defaults.adapter = async config => {
    count++;
    expect(config.url).toBe('/customer/reviews/received');
    expect(config.method).toBe('get');
    expect(config.baseURL).toBe(appConfig.apiBaseUrl);
    expect(config.headers.Authorization).toBe(
      'Bearer received-review-contract-test-token',
    );
    expect(config.params).toEqual({ page: 1, per_page: 20 });
    expect(config.data).toBeUndefined();
    return { status: 200, statusText: 'OK', config, headers: {}, data: body };
  };
  const result = await getReceivedVisitorReviews();
  expect(result.items).toEqual([item]);
  expect(result.nextPage).toBe(2);
  expect(result.items[0].reviewer).not.toHaveProperty('avatarUrl');
  expect(count).toBe(1);
});
test('last page, nullable metadata and custom supported per_page are preserved', async () => {
  body = {
    success: true,
    message: 'OK',
    data: {
      items: [
        {
          ...item,
          review: null,
          date_time: null,
          created_at: null,
          listing: { id: 10, title: null },
          reviewer: { id: 22, display_name: null },
        },
      ],
      pagination: { current_page: 2, per_page: 3, total: 4, last_page: 2 },
    },
  };
  const result = await getReceivedVisitorReviews(2, undefined, 3);
  expect(result.items[0].review).toBeNull();
  expect(result.items[0].reviewer.display_name).toBeNull();
  expect(result.nextPage).toBeNull();
});
test('empty response stays empty without synthetic reviews', async () => {
  body = {
    success: true,
    message: 'OK',
    data: {
      items: [],
      pagination: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
    },
  };
  expect(await getReceivedVisitorReviews()).toMatchObject({
    items: [],
    nextPage: null,
  });
});
test.each([
  {},
  { success: false },
  { success: true, message: 'OK', data: { items: [item] } },
])('malformed envelope rejects %j', async invalid => {
  body = invalid;
  await expect(getReceivedVisitorReviews()).rejects.toMatchObject({
    kind: 'unknown',
  });
});
test('wrong account reviews are rejected', async () => {
  body = {
    success: true,
    message: 'OK',
    data: {
      items: [{ ...item, reviewed_customer: { id: 9, display_name: 'Other' } }],
      pagination: { current_page: 1, per_page: 20, total: 1, last_page: 1 },
    },
  };
  await expect(getReceivedVisitorReviews()).rejects.toMatchObject({
    kind: 'forbidden',
  });
});
test.each([0, -1, 1.5, 100001])(
  'invalid page %s makes no request',
  async page => {
    await expect(getReceivedVisitorReviews(page)).rejects.toMatchObject({
      kind: 'validation',
    });
    expect(count).toBe(0);
  },
);
test('mismatched response page cannot enter cache', async () => {
  await expect(getReceivedVisitorReviews(2)).rejects.toMatchObject({
    kind: 'unknown',
  });
});
test.each(['guest', 'demo'])(
  '%s cannot read a token or send private HTTP',
  async mode => {
    useAuthStore.getState().clear();
    appConfig.uiPreviewEnabled = true;
    useDevelopmentStore.setState({ previewActive: mode === 'demo' });
    await expect(getReceivedVisitorReviews()).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    expect(count).toBe(0);
    expect(secureStorage.getToken).not.toHaveBeenCalled();
  },
);
test('missing token follows the existing expiry policy', async () => {
  token = null;
  jest.spyOn(secureStorage, 'removeTokenIfCurrent').mockResolvedValue(true);
  await expect(getReceivedVisitorReviews()).rejects.toMatchObject({
    kind: 'unauthorized',
  });
  expect(useAuthStore.getState().status).toBe('guest');
  expect(count).toBe(0);
});
test.each(['logout', 'switch', 'relogin', 'token-change', 'abort'])(
  'late %s response is cancelled',
  async action => {
    const controller = new AbortController();
    apiClient.defaults.adapter = async config => {
      if (action === 'logout') useAuthStore.getState().clear();
      if (action === 'switch')
        useAuthStore.getState().setUser({ ...member, id: 9 });
      if (action === 'relogin') useAuthStore.getState().setUser({ ...member });
      if (action === 'token-change') token = 'new-contract-test-token';
      if (action === 'abort') controller.abort();
      return { status: 200, statusText: 'OK', config, headers: {}, data: body };
    };
    await expect(
      getReceivedVisitorReviews(1, controller.signal),
    ).rejects.toMatchObject({ kind: 'cancelled' });
  },
);
test.each([403, 404, 422, 429, 500, undefined])(
  'failure %s preserves session and uses safe notification text',
  async status => {
    apiClient.defaults.adapter = async config => {
      throw new axios.AxiosError(
        'private',
        'ERR_NETWORK',
        config,
        undefined,
        status
          ? {
              status,
              statusText: '',
              config,
              headers: {},
              data: { message: 'private exception' },
            }
          : undefined,
      );
    };
    const error = await getReceivedVisitorReviews().catch(value => value);
    expect(visitorReviewErrorMessage(error)).not.toContain('private');
    expect(useAuthStore.getState().user).toBe(member);
  },
);
test('401 clears only the captured session using existing interceptor policy', async () => {
  jest.spyOn(secureStorage, 'removeTokenIfCurrent').mockResolvedValue(true);
  apiClient.defaults.adapter = async config => {
    throw new axios.AxiosError(
      'expired',
      'ERR_BAD_RESPONSE',
      config,
      undefined,
      { status: 401, statusText: '', config, headers: {}, data: {} },
    );
  };
  await expect(getReceivedVisitorReviews()).rejects.toMatchObject({
    kind: 'unauthorized',
  });
  expect(useAuthStore.getState().status).toBe('guest');
});
