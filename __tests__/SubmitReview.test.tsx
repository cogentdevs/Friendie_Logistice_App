import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KeyboardAvoidingView, Modal } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSubmitReview } from '../src/features/reviews/hooks/useSubmitReview';
import { useYourReviews } from '../src/features/reviews/hooks/useReviews';
import { SubmitReviewDialog } from '../src/features/reviews/components/SubmitReviewDialog';
import { AppInput } from '../src/components/ui/AppInput';
import { AppButton } from '../src/components/ui/AppButton';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { getPublicListingDetails } from '../src/features/listings/services/publicListingsService';
import { reviewSubmission } from '../src/features/reviews/services/submitReviewService';
import * as authFlow from '../src/features/auth/services/authFlowCoordinator';
import { authActionTarget } from '../src/features/auth/services/authActionResolver';
import { ApiError } from '../src/types/api';
import { publicListingFixture } from '../test/fixtures/publicListing';
import { submittedReviewFixture } from '../test/fixtures/submittedReview';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
let tree: ReactTestRenderer,
  client: QueryClient,
  hook: ReturnType<typeof useSubmitReview>;
let row: Awaited<ReturnType<typeof getPublicListingDetails>>;
let focused = true,
  given = false;
function GivenFeed() {
  useYourReviews(true);
  return null;
}
function Harness() {
  hook = useSubmitReview(row, focused);
  return (
    <>
      <SubmitReviewDialog
        visible={hook.visible}
        draft={hook.draft}
        busy={hook.busy}
        blocked={hook.blocked}
        notice={hook.notice}
        onChange={hook.setDraft}
        onSubmit={hook.submit}
        onCancel={hook.close}
      />
      {given && <GivenFeed />}
    </>
  );
}
const mount = async () => {
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );
  });
};
beforeEach(async () => {
  focused = true;
  given = false;
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'm@example.test' });
  useDevelopmentStore.setState({ previewActive: false });
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('review-hook-token');
  jest.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: { success: true, data: publicListingFixture },
  });
  jest
    .spyOn(apiClient, 'post')
    .mockResolvedValue({ status: 201, data: submittedReviewFixture });
  jest.spyOn(Toast, 'show').mockImplementation(() => {});
  row = await getPublicListingDetails('123');
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await mount();
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
  });
  client.clear();
  jest.restoreAllMocks();
});
const open = async (
  rating: number | null = 0,
  review = 'Excellent experience!',
) => {
  await Renderer.act(async () => {
    hook.open();
  });
  await Renderer.act(async () => {
    hook.setDraft({ rating, review });
  });
};
test('dialog opens without submission; accessible selector includes explicit 0..5, initially unselected', async () => {
  await Renderer.act(async () => {
    hook.open();
  });
  expect(hook.draft.rating).toBeNull();
  expect(tree.root.findByType(Modal).props.visible).toBe(true);
  expect(tree.root.findByType(KeyboardAvoidingView)).toBeTruthy();
  const options = tree.root.findAll(
    node =>
      node.props.accessibilityRole === 'radio' &&
      typeof node.props.onPress === 'function',
  );
  expect(options.map(node => node.props.accessibilityLabel)).toEqual(
    [0, 1, 2, 3, 4, 5].map(n => 'Rating ' + n + ' out of 5'),
  );
  expect(options.every(node => !node.props.accessibilityState.checked)).toBe(
    true,
  );
  await Renderer.act(async () => {
    options[0].props.onPress();
  });
  expect(hook.draft.rating).toBe(0);
  expect(tree.root.findByType(AppInput).props.multiline).toBe(true);
  expect(apiClient.post).not.toHaveBeenCalled();
});
test('Cancel preserves local draft and never submits', async () => {
  await open();
  await Renderer.act(async () => {
    tree.root
      .findAllByType(AppButton)
      .find(node => node.props.title === 'Cancel')!
      .props.onPress();
  });
  expect(hook.visible).toBe(false);
  expect(hook.draft).toEqual({ rating: 0, review: 'Excellent experience!' });
  expect(apiClient.post).not.toHaveBeenCalled();
});
test.each([
  { rating: null, review: 'Text' },
  { rating: 0, review: '' },
  { rating: 5, review: ' \n' },
])(
  'invalid input (%#) keeps draft and shows Toast without POST',
  async draft => {
    await open(draft.rating, draft.review);
    await Renderer.act(async () => {
      await hook.submit();
    });
    expect(hook.draft).toEqual(draft);
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
  },
);
test('201 clears submitted fields only after server confirmation; invalidates Given only', async () => {
  const cancel = jest.spyOn(client, 'cancelQueries'),
    invalidate = jest.spyOn(client, 'invalidateQueries');
  client.setQueryDefaults(['reviews.received', 'user:8'], { gcTime: Infinity });
  client.setQueryDefaults(['profileDashboard', 'user:8', 'summary'], {
    gcTime: Infinity,
  });
  client.setQueryData(['reviews.received', 'user:8'], { marker: 'received' });
  client.setQueryData(['profileDashboard', 'user:8', 'summary'], {
    reviews_received: 99,
  });
  await open();
  await Renderer.act(async () => {
    await hook.submit();
  });
  expect(hook.draft).toEqual({ rating: null, review: '' });
  expect(hook.visible).toBe(false);
  expect(cancel).toHaveBeenCalledWith({
    queryKey: ['reviews.authored', 'user:8'],
  });
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['reviews.authored', 'user:8'],
    refetchType: 'active',
  });
  expect(client.getQueryData(['reviews.received', 'user:8'])).toEqual({
    marker: 'received',
  });
  expect(
    client.getQueryData(['profileDashboard', 'user:8', 'summary']),
  ).toEqual({ reviews_received: 99 });
  expect(Toast.show).toHaveBeenCalledTimes(1);
  expect(Toast.show).toHaveBeenCalledWith({
    type: 'success',
    text1: 'Review submitted successfully',
  });
});
test('active Given feed reloads through real read service and preserves pagination without optimistic insertion', async () => {
  let saved = false;
  jest.mocked(apiClient.get).mockImplementation(async path => {
    expect(path).toBe('/customer/reviews/given');
    return {
      status: 200,
      data: {
        success: true,
        message: 'Given reviews retrieved successfully.',
        data: {
          items: saved ? [submittedReviewFixture.data] : [],
          pagination: {
            current_page: 1,
            per_page: 20,
            total: saved ? 1 : 0,
            last_page: 1,
          },
        },
      },
    };
  });
  jest.mocked(apiClient.post).mockImplementation(async () => {
    saved = true;
    return { status: 201, data: submittedReviewFixture };
  });
  given = true;
  await Renderer.act(async () => {
    tree.update(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );
    await client.refetchQueries({ queryKey: ['reviews.authored', 'user:8'] });
  });
  const before = jest.mocked(apiClient.get).mock.calls.length;
  await open();
  await Renderer.act(async () => {
    await hook.submit();
  });
  const cached = client.getQueryData<{
    pageParams: number[];
    pages: Array<{
      items: Array<{ id: number; rating: number }>;
      total: number;
    }>;
  }>(['reviews.authored', 'user:8']);
  expect(cached?.pageParams).toEqual([1]);
  expect(cached?.pages[0].total).toBe(1);
  expect(cached?.pages[0].items).toMatchObject([{ id: 71, rating: 0 }]);
  expect(jest.mocked(apiClient.get).mock.calls.length).toBeGreaterThan(before);
  expect(apiClient.post).toHaveBeenCalledTimes(1);
});
test('newer edits during flight survive confirmed success', async () => {
  let resolve!: (value: unknown) => void;
  jest.mocked(apiClient.post).mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await open();
  let operation!: Promise<void>;
  await Renderer.act(async () => {
    operation = hook.submit();
    await Promise.resolve();
  });
  await Renderer.act(async () => {
    hook.setDraft({ rating: 4, review: 'Newer edits' });
  });
  await Renderer.act(async () => {
    resolve({ status: 201, data: submittedReviewFixture });
    await operation;
  });
  expect(hook.draft).toEqual({ rating: 4, review: 'Newer edits' });
});
test('guest gate preserves listing context and only resumes entry', async () => {
  const gate = jest.spyOn(authFlow, 'requireAuth').mockReturnValue(true);
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
  });
  await Renderer.act(async () => {
    hook.open();
  });
  expect(gate).toHaveBeenCalledWith({
    type: 'SUBMIT_REVIEW',
    params: { listingId: '123' },
  });
  expect(
    authActionTarget({ type: 'SUBMIT_REVIEW', params: { listingId: '123' } }),
  ).toMatchObject({
    params: {
      params: { params: { listingId: '123', resumeAction: 'review' } },
    },
  });
  expect(apiClient.post).not.toHaveBeenCalled();
  expect(hook.visible).toBe(false);
});
test('unverified fixture target cannot open submission', async () => {
  row = { ...row };
  await Renderer.act(async () => {
    tree.update(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  await Renderer.act(async () => {
    hook.open();
  });
  expect(hook.visible).toBe(false);
  expect(apiClient.post).not.toHaveBeenCalled();
});
test('rapid double Submit sends one POST and preserves fields until response', async () => {
  let resolve!: (value: unknown) => void;
  jest.mocked(apiClient.post).mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await open();
  let operation!: Promise<void>;
  await Renderer.act(async () => {
    operation = hook.submit();
    hook.submit();
    await Promise.resolve();
  });
  expect(hook.busy).toBe(true);
  expect(hook.draft.rating).toBe(0);
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => {
    resolve({ status: 201, data: submittedReviewFixture });
    await operation;
  });
});
test.each([422, 429, 403])(
  'HTTP %i preserves input and uses one error Toast',
  async status => {
    jest
      .mocked(apiClient.post)
      .mockRejectedValue(
        new ApiError('Sensitive internals', 'validation', status),
      );
    await open();
    await Renderer.act(async () => {
      await hook.submit();
    });
    expect(hook.draft).toEqual({ rating: 0, review: 'Excellent experience!' });
    expect(Toast.show).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(jest.mocked(Toast.show).mock.calls)).not.toContain(
      'Sensitive internals',
    );
  },
);
test('409 preserves draft and rejects repeat submission without fake success', async () => {
  jest
    .mocked(apiClient.post)
    .mockRejectedValue(new ApiError('Duplicate', 'unknown', 409));
  await open();
  await Renderer.act(async () => {
    await hook.submit();
  });
  expect(hook.draft.rating).toBe(0);
  expect(hook.blocked).toBe(true);
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'rejected' }),
  );
  await Renderer.act(async () => {
    await hook.submit();
  });
  expect(apiClient.post).toHaveBeenCalledTimes(1);
});
test('timeout preserves draft across remount and blocks blind retry', async () => {
  jest
    .mocked(apiClient.post)
    .mockRejectedValue(new ApiError('Timeout', 'network'));
  await open();
  await Renderer.act(async () => {
    await hook.submit();
  });
  expect(hook.blocked).toBe(true);
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'warning' }),
  );
  await Renderer.act(async () => {
    tree.unmount();
  });
  await mount();
  await Renderer.act(async () => {
    hook.open();
  });
  expect(hook.draft).toEqual({ rating: 0, review: 'Excellent experience!' });
  await Renderer.act(async () => {
    await hook.submit();
  });
  expect(apiClient.post).toHaveBeenCalledTimes(1);
});
test.each(['logout', 'switch', 'blur', 'cancel'])(
  'completion after %s cannot publish private state or success Toast',
  async mode => {
    let resolve!: (value: unknown) => void;
    jest.mocked(apiClient.post).mockImplementation(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    await open();
    let operation!: Promise<void>;
    await Renderer.act(async () => {
      operation = hook.submit();
      await Promise.resolve();
    });
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    await Renderer.act(async () => {
      if (mode === 'logout') useAuthStore.getState().clear();
      else if (mode === 'switch')
        useAuthStore
          .getState()
          .setUser({ id: 55, name: 'Other', email: 'o@example.test' });
      else if (mode === 'cancel') hook.close();
      else {
        focused = false;
        tree.update(
          <QueryClientProvider client={client}>
            <Harness />
          </QueryClientProvider>,
        );
      }
    });
    await Renderer.act(async () => {
      resolve({ status: 201, data: submittedReviewFixture });
      await operation;
    });
    expect(invalidate).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
    if (mode === 'logout' || mode === 'switch')
      expect(hook.draft).toEqual({ rating: null, review: '' });
  },
);
test('Given refresh failure after confirmed save never claims submission failed', async () => {
  jest
    .spyOn(client, 'invalidateQueries')
    .mockRejectedValue(new Error('Refresh failed'));
  await open();
  await Renderer.act(async () => {
    await hook.submit();
  });
  expect(reviewSubmission(123)?.state).toBe('confirmed');
  expect(Toast.show).toHaveBeenCalledWith({
    type: 'warning',
    text1: 'Review submitted',
    text2: 'Refresh Your Reviews to load the latest data.',
  });
});

test('verified own listing cannot open submission', async () => {
  jest.mocked(apiClient.get).mockResolvedValue({
    status: 200,
    data: {
      success: true,
      data: {
        ...publicListingFixture,
        owner: { ...publicListingFixture.owner, id: 8 },
      },
    },
  });
  row = await getPublicListingDetails('123');
  await Renderer.act(async () => {
    tree.update(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  await Renderer.act(async () => {
    hook.open();
  });
  expect(hook.visible).toBe(false);
  expect(apiClient.post).not.toHaveBeenCalled();
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'rejected' }),
  );
});

test('a stale pre-switch Submit callback cannot post the prior draft as the next account', async () => {
  await open();
  const stale = hook.submit;
  await Renderer.act(async () => {
    useAuthStore
      .getState()
      .setUser({ id: 55, name: 'Other', email: 'other@example.test' });
    await stale();
  });
  expect(apiClient.post).not.toHaveBeenCalled();
  expect(hook.draft).toEqual({ rating: null, review: '' });
});
