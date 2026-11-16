import axios from 'axios';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { appConfig } from '../src/constants/appConfig';
import { reviewsService } from '../src/features/reviews/services/reviewsService';
const original = {
  adapter: apiClient.defaults.adapter,
  preview: appConfig.uiPreviewEnabled,
};
const member = { id: 8, name: 'Current', email: 'current@example.test' };
let body: unknown;
let count: number;
const raw = {
  id: 91,
  reviewer: { id: 7, display_name: 'Author' },
  reviewed_customer: { id: 8, display_name: 'Recipient' },
  listing: { id: 31, title: 'Historical listing' },
  rating: 0,
  review: 'Real contract text',
  date_time: '2026-11-16',
  created_at: null,
  updated_at: null,
};
function envelope(item = raw, page = 1, total = 23) {
  return {
    success: true,
    message: 'OK',
    data: {
      items: [item],
      pagination: { current_page: page, per_page: 20, total, last_page: 2 },
    },
  };
}
beforeEach(() => {
  count = 0;
  body = envelope();
  useAuthStore.getState().setUser(member);
  useDevelopmentStore.setState({ previewActive: false });
  jest
    .spyOn(secureStorage, 'getToken')
    .mockResolvedValue('my-reviews-contract-test-token');
  apiClient.defaults.adapter = async config => {
    count++;
    return { status: 200, statusText: '', config, headers: {}, data: body };
  };
});
afterEach(() => {
  apiClient.defaults.adapter = original.adapter;
  appConfig.uiPreviewEnabled = original.preview;
  jest.restoreAllMocks();
});
test.each(['received', 'given'] as const)(
  '%s uses the verified Bearer GET, maps the correct person and preserves rating zero',
  async kind => {
    const item =
      kind === 'received'
        ? raw
        : {
            ...raw,
            reviewer: { id: 8, display_name: 'Current author' },
            reviewed_customer: { id: 9, display_name: 'Actual recipient' },
          };
    body = envelope(item);
    apiClient.defaults.adapter = async config => {
      count++;
      expect(config.url).toBe('/customer/reviews/' + kind);
      expect(config.method).toBe('get');
      expect(config.headers.Authorization).toBe(
        'Bearer my-reviews-contract-test-token',
      );
      expect(config.params).toEqual({ page: 1, per_page: 20 });
      expect(config.baseURL).toBe(appConfig.apiBaseUrl);
      return { status: 200, statusText: '', config, headers: {}, data: body };
    };
    const result = await (kind === 'received'
      ? reviewsService.received
      : reviewsService.authored)(8, 1);
    expect(result.items[0]).toMatchObject({
      id: 91,
      rating: 0,
      comment: raw.review,
      date: raw.date_time,
      person:
        kind === 'received'
          ? { id: 7, name: 'Author' }
          : { id: 9, name: 'Actual recipient' },
      listing: { id: 31, title: 'Historical listing', canOpen: false },
    });
    expect(result.items[0].person).not.toHaveProperty('avatarUrl');
    expect(result.total).toBe(23);
    expect(result.nextPage).toBe(2);
    expect(count).toBe(1);
  },
);
test('Given rejects reviews not authored by the current account', async () => {
  await expect(reviewsService.authored(8, 1)).rejects.toMatchObject({
    kind: 'forbidden',
  });
});
test('Given supports last-page pagination and nullable identity/comment/date', async () => {
  body = envelope(
    {
      ...raw,
      reviewer: { id: 8, display_name: null as unknown as string },
      reviewed_customer: { id: 9, display_name: null as unknown as string },
      review: null as unknown as string,
      date_time: null as unknown as string,
    },
    2,
  );
  const result = await reviewsService.authored(8, 2);
  expect(result.nextPage).toBeNull();
  expect(result.items[0].person.name).toBeNull();
  expect(result.items[0].comment).toBeNull();
  expect(result.items[0].date).toBeNull();
});
test.each(['received', 'authored'] as const)(
  '%s remains empty for a valid empty backend page',
  async source => {
    body = {
      success: true,
      message: 'OK',
      data: {
        items: [],
        pagination: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
      },
    };
    expect(await reviewsService[source](8, 1)).toMatchObject({
      items: [],
      total: 0,
      nextPage: null,
    });
  },
);
test.each(['received', 'authored'] as const)(
  '%s rejects unexpected response shapes safely',
  async source => {
    body = { success: true, data: { reviews: [] } };
    await expect(reviewsService[source](8, 1)).rejects.toMatchObject({
      kind: 'unknown',
    });
  },
);
test.each(['guest', 'demo'])(
  '%s never sends private HTTP or reads a token',
  async mode => {
    useAuthStore.getState().clear();
    appConfig.uiPreviewEnabled = true;
    useDevelopmentStore.setState({ previewActive: mode === 'demo' });
    if (mode === 'demo') {
      await expect(reviewsService.received('demo', 1)).resolves.toMatchObject({
        items: [],
      });
      await expect(reviewsService.authored('demo', 1)).resolves.toMatchObject({
        items: [],
      });
    } else
      await expect(reviewsService.authored('guest', 1)).rejects.toMatchObject({
        kind: 'unauthorized',
      });
    expect(count).toBe(0);
    expect(secureStorage.getToken).not.toHaveBeenCalled();
  },
);
test.each([403, 404, 429, 500, undefined])(
  'Given failure %s is normalized without leaking backend details',
  async status => {
    apiClient.defaults.adapter = async config => {
      throw new axios.AxiosError(
        'internal secret',
        'ERR_NETWORK',
        config,
        undefined,
        status
          ? {
              status,
              statusText: '',
              config,
              headers: {},
              data: { message: 'internal secret' },
            }
          : undefined,
      );
    };
    const error = await reviewsService.authored(8, 1).catch(value => value);
    expect(error.message).not.toContain('secret');
    expect(useAuthStore.getState().user).toBe(member);
  },
);
test.each(['logout', 'switch', 'token-change', 'abort'])(
  'Given ignores late %s responses',
  async action => {
    const controller = new AbortController();
    body = envelope({ ...raw, reviewer: { id: 8, display_name: 'Current' } });
    apiClient.defaults.adapter = async config => {
      if (action === 'logout') useAuthStore.getState().clear();
      if (action === 'switch')
        useAuthStore.getState().setUser({ ...member, id: 9 });
      if (action === 'token-change')
        jest
          .mocked(secureStorage.getToken)
          .mockResolvedValue('changed-test-token');
      if (action === 'abort') controller.abort();
      return { status: 200, statusText: '', config, headers: {}, data: body };
    };
    await expect(
      reviewsService.authored(8, 1, controller.signal),
    ).rejects.toMatchObject({ kind: 'cancelled' });
  },
);
