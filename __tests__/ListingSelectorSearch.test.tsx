import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import {
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ListingReferencePicker } from '../src/features/post-listing/components/ListingReferencePicker';
import { apiClient } from '../src/services/api/apiClient';

let tree: ReactTestRenderer, client: QueryClient;
const selected = jest.fn(),
  closed = jest.fn();
const response = (items: unknown[]) => ({
  status: 200,
  data: { success: true, message: 'OK', data: { items } },
});
const button = (label: string) =>
  tree.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
const input = () => tree.root.findByType(TextInput);
async function settle(read: () => boolean) {
  const deadline = Date.now() + 2000;
  while (!read()) {
    if (Date.now() > deadline)
      throw new Error('Reference query did not settle');
    await Renderer.act(async () => {
      await new Promise<void>(resolve => setImmediate(resolve));
    });
  }
}
beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client.clear();
  });
  jest.restoreAllMocks();
});
test.each(['categories', 'countries', 'cities', 'currencies'] as const)(
  '%s searches complete public options locally, clears and preserves authoritative identity',
  async kind => {
    const rows =
      kind === 'categories'
        ? [
            { id: 7, name: 'Documents', image_url: null },
            { id: 8, name: 'Food', image_url: null },
          ]
        : kind === 'currencies'
        ? [{ code: 'PKR' }, { code: 'AED' }]
        : [
            {
              id: 10,
              name: 'Alpha',
              short_name: null,
              ...(kind === 'cities' ? { country_id: 42 } : { image_url: null }),
            },
            {
              id: 11,
              name: 'Beta',
              short_name: null,
              ...(kind === 'cities' ? { country_id: 42 } : { image_url: null }),
            },
          ];
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue(response(rows));
    const first =
      kind === 'categories'
        ? 'Documents'
        : kind === 'currencies'
        ? 'PKR'
        : 'Alpha';
    const second =
      kind === 'categories' ? 'Food' : kind === 'currencies' ? 'AED' : 'Beta';
    await Renderer.act(async () => {
      tree = Renderer.create(
        <QueryClientProvider client={client}>
          <ListingReferencePicker
            title="Select option"
            kind={kind}
            countryId={kind === 'cities' ? 42 : undefined}
            onSelect={selected}
            onClose={closed}
          />
        </QueryClientProvider>,
      );
    });
    await settle(() => !!button(first));
    expect(get).toHaveBeenCalledWith(
      '/' + kind,
      expect.objectContaining({
        headers: { Authorization: false },
        ...(kind === 'cities' ? { params: { country_id: 42 } } : {}),
      }),
    );
    await Renderer.act(async () =>
      input().props.onChangeText('  ' + first.toLowerCase() + '  '),
    );
    expect(button(first)).toBeDefined();
    expect(button(second)).toBeUndefined();
    await Renderer.act(async () => input().props.onChangeText('no match'));
    expect(JSON.stringify(tree.toJSON())).toContain('No matching options.');
    expect(selected).not.toHaveBeenCalled();
    await Renderer.act(async () => button('Clear search').props.onPress());
    expect(input().props.value).toBe('');
    expect(button(second)).toBeDefined();
    expect(get).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType(KeyboardAvoidingView)).toHaveLength(1);
    expect(
      tree.root.findByType(ScrollView).props.keyboardShouldPersistTaps,
    ).toBe('handled');
    await Renderer.act(async () => button(first).props.onPress());
    expect(selected).toHaveBeenCalledWith(
      expect.objectContaining({
        key: kind === 'categories' ? '7' : kind === 'currencies' ? 'PKR' : '10',
        value:
          kind === 'currencies'
            ? 'PKR'
            : expect.objectContaining({ id: kind === 'categories' ? 7 : 10 }),
      }),
    );
    await Renderer.act(async () =>
      tree.root.findByType(Modal).props.onRequestClose(),
    );
    expect(closed).toHaveBeenCalledTimes(1);
  },
);

test('changing country resets search and ignores late responses for the previous country', async () => {
  let old!: (value: unknown) => void;
  jest.spyOn(apiClient, 'get').mockImplementation(async (_url, config) => {
    const id = (config?.params as { country_id?: number } | undefined)?.country_id;
    if (id === 42)
      return new Promise(resolve => {
        old = resolve;
      });
    return response([
      { id: 777, name: 'New city', short_name: null, country_id: 87 },
    ]);
  });
  const render = (countryId: number) => (
    <QueryClientProvider client={client}>
      <ListingReferencePicker
        title="City"
        kind="cities"
        countryId={countryId}
        onSelect={selected}
        onClose={closed}
      />
    </QueryClientProvider>
  );
  await Renderer.act(async () => {
    tree = Renderer.create(render(42));
  });
  await Renderer.act(async () => input().props.onChangeText('old search'));
  await Renderer.act(async () => tree.update(render(87)));
  await settle(() => !!button('New city'));
  await Renderer.act(async () =>
    old(
      response([
        { id: 501, name: 'Old city', short_name: null, country_id: 42 },
      ]),
    ),
  );
  expect(button('Old city')).toBeUndefined();
  expect(input().props.value).toBe('');
  await Renderer.act(async () => button('New city').props.onPress());
  expect(selected).toHaveBeenCalledWith(
    expect.objectContaining({
      value: { id: 777, name: 'New city', countryId: 87 },
    }),
  );
});

test('empty list remains empty with search, and Cancel makes no selection or mutation', async () => {
  jest.spyOn(apiClient, 'get').mockResolvedValue(response([]));
  const post = jest.spyOn(apiClient, 'post');
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <ListingReferencePicker
          title="Country"
          kind="countries"
          onSelect={selected}
          onClose={closed}
        />
      </QueryClientProvider>,
    );
  });
  await settle(() =>
    JSON.stringify(tree.toJSON()).includes('No options available.'),
  );
  await Renderer.act(async () => input().props.onChangeText('anything'));
  expect(JSON.stringify(tree.toJSON())).toContain('No options available.');
  await Renderer.act(async () => button('Cancel selection').props.onPress());
  expect(selected).not.toHaveBeenCalled();
  expect(closed).toHaveBeenCalledTimes(1);
  expect(post).not.toHaveBeenCalled();
});

test('loading and failed reference request keep search usable; explicit retry recovers', async () => {
  let reject!: (error: Error) => void;
  const get = jest
    .spyOn(apiClient, 'get')
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    )
    .mockResolvedValue(response([{ code: 'PKR' }, { code: 'PKR' }]));
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <ListingReferencePicker
          title="Currency"
          kind="currencies"
          onSelect={selected}
          onClose={closed}
        />
      </QueryClientProvider>,
    );
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Loading options');
  await Renderer.act(async () => {
    input().props.onChangeText('pkr');
    reject(new Error('Test network failure'));
  });
  await settle(() => !!button('Retry options'));
  expect(selected).not.toHaveBeenCalled();
  await Renderer.act(async () => button('Retry options').props.onPress());
  await settle(() => !!button('PKR'));
  expect(
    tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'PKR' &&
        typeof node.props.onPress === 'function',
    ),
  ).toHaveLength(1);
  expect(input().props.value).toBe('pkr');
  expect(get).toHaveBeenCalledTimes(2);
});
