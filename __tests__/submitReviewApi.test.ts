import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { ApiError } from '../src/types/api';
import { getPublicListingDetails } from '../src/features/listings/services/publicListingsService';
import {
  submitReview,
  reviewSubmission,
  validateReviewDraft,
  submitReviewErrorMessage,
} from '../src/features/reviews/services/submitReviewService';
import { publicListingFixture as row } from '../test/fixtures/publicListing';
import { submittedReviewFixture as result } from '../test/fixtures/submittedReview';
const adapter = apiClient.defaults.adapter;
let post: jest.SpyInstance;
const draft = { rating: 0, review: 'Excellent experience!' };
const listing = () => getPublicListingDetails('123');
beforeEach(() => {
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
  useDevelopmentStore.setState({ previewActive: false });
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('review-test-token');
  jest
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ status: 200, data: { success: true, data: row } });
  post = jest
    .spyOn(apiClient, 'post')
    .mockResolvedValue({ status: 201, data: result });
});
afterEach(() => {
  apiClient.defaults.adapter = adapter;
  jest.restoreAllMocks();
  useAuthStore.getState().clear();
});
test.each([0, 1, 2, 3, 4, 5])(
  'explicit integer rating %i is preserved with exact endpoint/payload/header',
  async rating => {
    post.mockResolvedValue({
      status: 201,
      data: { ...result, data: { ...result.data, rating } },
    });
    expect(
      await submitReview(await listing(), { ...draft, rating }),
    ).toMatchObject({ data: { id: 71, rating } });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      '/customer/reviews',
      { post_ads_id: 123, rating, review: draft.review },
      {
        signal: undefined,
        headers: { Authorization: 'Bearer review-test-token' },
      },
    );
  },
);
test.each([null, undefined, -1, 6, 0.5, NaN, Infinity, '0'])(
  'invalid/unselected rating (%#) never POSTs',
  async rating => {
    await expect(
      submitReview(await listing(), { ...draft, rating: rating as number }),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(post).not.toHaveBeenCalled();
  },
);
test.each(['', ' \n\t', 'bad\0text'])(
  'invalid text (%#) never POSTs',
  async review => {
    await expect(
      submitReview(await listing(), { ...draft, review }),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(post).not.toHaveBeenCalled();
  },
);
test('no invented maximum; whitespace around meaningful text is not silently stripped', async () => {
  const review = '  ' + 'x'.repeat(10001) + '  ';
  expect(() => validateReviewDraft({ ...draft, review })).not.toThrow();
  post.mockResolvedValue({
    status: 201,
    data: { ...result, data: { ...result.data, review } },
  });
  await submitReview(await listing(), { ...draft, review });
  expect(post.mock.calls[0][1]).toEqual({
    post_ads_id: 123,
    rating: 0,
    review,
  });
});
test.each([
  { id: 123, ownerId: 9 },
  { id: 900001, ownerId: 9 },
  { id: 0, ownerId: 9 },
  { id: NaN, ownerId: 9 },
])(
  'unverified numeric/fixture/invalid target (%#) cannot submit',
  async target => {
    await expect(submitReview(target, draft)).rejects.toMatchObject({
      kind: 'validation',
    });
    expect(post).not.toHaveBeenCalled();
  },
);
test('cloned/modified remote identity cannot bypass provenance', async () => {
  const remote = await listing();
  await expect(submitReview({ ...remote }, draft)).rejects.toMatchObject({
    kind: 'validation',
  });
  remote.id = 456;
  await expect(submitReview(remote, draft)).rejects.toMatchObject({
    kind: 'validation',
  });
  expect(post).not.toHaveBeenCalled();
});
test('self-review is rejected without a mutation', async () => {
  jest
    .mocked(apiClient.get)
    .mockResolvedValue({
      status: 200,
      data: { success: true, data: { ...row, owner: { ...row.owner, id: 8 } } },
    });
  await expect(submitReview(await listing(), draft)).rejects.toMatchObject({
    status: 422,
  });
  expect(post).not.toHaveBeenCalled();
});
test.each(['guest', 'demo'])(
  '%s cannot submit with fake credentials',
  async mode => {
    const remote = await listing();
    useAuthStore.getState().clear();
    useDevelopmentStore.setState({ previewActive: mode === 'demo' });
    await expect(submitReview(remote, draft)).rejects.toMatchObject({
      status: 401,
    });
    expect(post).not.toHaveBeenCalled();
  },
);
test('missing real secure token clears only current invalid session', async () => {
  const remote = await listing();
  jest.mocked(secureStorage.getToken).mockResolvedValue(null);
  const remove = jest
    .spyOn(secureStorage, 'removeTokenIfCurrent')
    .mockResolvedValue(true);
  await expect(submitReview(remote, draft)).rejects.toMatchObject({
    status: 401,
  });
  expect(remove).toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
});
test('synchronous per-session/listing guard prevents concurrent POSTs', async () => {
  const remote = await listing();
  let resolve!: (value: unknown) => void;
  post.mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const first = submitReview(remote, draft);
  await expect(submitReview(remote, draft)).rejects.toMatchObject({
    kind: 'validation',
  });
  await Promise.resolve();
  resolve({ status: 201, data: result });
  await first;
  expect(post).toHaveBeenCalledTimes(1);
  await expect(submitReview(remote, draft)).rejects.toMatchObject({
    kind: 'validation',
  });
  expect(post).toHaveBeenCalledTimes(1);
});
test.each([400, 401, 403, 404, 422, 429])(
  'HTTP %i rejection preserves retry eligibility without fake success',
  async status => {
    post.mockRejectedValue(
      new ApiError('Backend rejected', 'validation', status),
    );
    await expect(submitReview(await listing(), draft)).rejects.toMatchObject({
      status,
    });
    expect(reviewSubmission(123)).toBeUndefined();
  },
);
test('409 remains duplicate rejection, never a fabricated 201 or automatic retry', async () => {
  const remote = await listing();
  post.mockRejectedValue(new ApiError('Already reviewed', 'unknown', 409));
  await expect(submitReview(remote, draft)).rejects.toMatchObject({
    status: 409,
  });
  expect(reviewSubmission(123)?.state).toBe('duplicate');
  await expect(submitReview(remote, draft)).rejects.toMatchObject({
    kind: 'validation',
  });
  expect(post).toHaveBeenCalledTimes(1);
});
test.each([
  new ApiError('Timeout', 'network'),
  new ApiError('Offline', 'network'),
  new ApiError('Internal exception', 'server', 500),
])(
  'ambiguous outcome (%#) retains draft and blocks automatic/repeated POST',
  async error => {
    const remote = await listing();
    post.mockRejectedValue(error);
    await expect(submitReview(remote, draft)).rejects.toThrow();
    expect(reviewSubmission(123)).toEqual({ state: 'unknown', draft });
    await expect(submitReview(remote, draft)).rejects.toMatchObject({
      kind: 'validation',
    });
    expect(post).toHaveBeenCalledTimes(1);
  },
);
test.each([
  { ...result, data: { ...result.data, id: 0 } },
  { ...result, data: { ...result.data, listing: { id: 999, title: null } } },
  {
    ...result,
    data: { ...result.data, reviewer: { id: 55, display_name: null } },
  },
  { ...result, data: { ...result.data, rating: 5 } },
  { ...result, data: { ...result.data, review: null } },
  { success: true, data: {} },
])(
  'invalid success response (%#) remains uncertain without guessed review data',
  async data => {
    post.mockResolvedValue({ status: 201, data });
    await expect(submitReview(await listing(), draft)).rejects.toMatchObject({
      kind: 'unknown',
    });
    expect(reviewSubmission(123)?.state).toBe('unknown');
  },
);
test.each(['logout', 'switch', 'token', 'abort'])(
  'stale completion after %s cannot publish a review',
  async mode => {
    const remote = await listing(),
      control = new AbortController();
    post.mockImplementation(async () => {
      if (mode === 'logout') useAuthStore.getState().clear();
      if (mode === 'switch')
        useAuthStore
          .getState()
          .setUser({ id: 55, name: 'Other', email: 'other@example.test' });
      if (mode === 'token')
        jest
          .mocked(secureStorage.getToken)
          .mockResolvedValue('replacement-token');
      if (mode === 'abort') control.abort();
      return { status: 201, data: result };
    });
    await expect(
      submitReview(remote, draft, control.signal),
    ).rejects.toMatchObject({ kind: 'cancelled' });
  },
);
test('error copy never exposes arbitrary backend exception details', () => {
  expect(
    submitReviewErrorMessage(
      new ApiError('SQL password secret', 'server', 500),
    ),
  ).not.toContain('SQL');
  expect(
    submitReviewErrorMessage(new ApiError('Hidden', 'unknown', 409)),
  ).toContain('already reviewed');
});
test('actual central Axios adapter receives only public GET then authenticated review POST', async () => {
  jest.restoreAllMocks();
  jest
    .spyOn(secureStorage, 'getToken')
    .mockResolvedValue('review-adapter-token');
  const calls: string[] = [];
  apiClient.defaults.adapter = async config => {
    calls.push(config.method + ' ' + config.url);
    if (config.method === 'get') {
      expect(config.headers.Authorization).toBe(false);
      return {
        status: 200,
        statusText: '',
        headers: {},
        config,
        data: { success: true, data: row },
      };
    }
    expect(config.headers.Authorization).toBe('Bearer review-adapter-token');
    expect(JSON.parse(config.data)).toEqual({ post_ads_id: 123, ...draft });
    expect(config.headers['Idempotency-Key']).toBeUndefined();
    return { status: 201, statusText: '', headers: {}, config, data: result };
  };
  await submitReview(await listing(), draft);
  expect(calls).toEqual(['get /listings/123', 'post /customer/reviews']);
});
