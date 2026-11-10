import { useAuthStore } from '../src/store/authStore';
import React from 'react';
import { Alert, TextInput } from 'react-native';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PostListingScreen } from '../src/features/post-listing/screens/PostListingScreen';
import { RouteLocationPicker } from '../src/features/location/components/RouteLocationPicker';
import { SearchDatePicker } from '../src/features/search/components/SearchDatePicker';
import { useListingDraft } from '../src/features/post-listing/store/listingDraftStore';
import { listingDraftSchema } from '../src/features/post-listing/types/listingDraft';
import { routeFixture } from '../test/fixtures/search';
import { localDate } from '../src/features/search/types/search';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
  usePreventRemove: jest.fn(),
}));
jest.mock('@react-navigation/elements', () => ({
  ...jest.requireActual('@react-navigation/elements'),
  useHeaderHeight: () => 56,
}));
let tree: ReactTestRenderer, client: QueryClient;
const parentNavigate = jest.fn(),
  navigation = {
    navigate: jest.fn(),
    setOptions: jest.fn(),
    getState: () => ({ index: 0 }),
    getParent: () => ({ navigate: parentNavigate }),
    dispatch: jest.fn(),
    goBack: jest.fn(),
  };
async function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <PostListingScreen
          navigation={
            navigation as unknown as React.ComponentProps<
              typeof PostListingScreen
            >['navigation']
          }
          route={{ key: 'post', name: 'PostListing' }}
        />
      </QueryClientProvider>,
    );
  });
}
async function press(label: string) {
  await Renderer.act(async () => {
    await tree.root
      .findAll(
        node =>
          node.props.accessibilityLabel === label &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
  });
}
async function weight(value: string) {
  await Renderer.act(async () =>
    tree.root
      .findAllByType(TextInput)
      .find(node =>
        ['Carrying Capacity', 'Parcel Weight'].includes(
          node.props.accessibilityLabel,
        ),
      )!
      .props.onChangeText(value),
  );
}
beforeEach(() => {
  useAuthStore
    .getState()
    .setUser({ id: 9, name: 'Member', email: 'member@example.test' });
  jest.clearAllMocks();
  useListingDraft.getState().discard();
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client?.clear();
  });
  jest.restoreAllMocks();
});
test('empty/negative input cannot continue; switching type updates labels and preserves draft', async () => {
  await mount();
  await press('Continue');
  expect(navigation.navigate).not.toHaveBeenCalled();
  await weight('-2');
  await press('Continue');
  expect(navigation.navigate).not.toHaveBeenCalled();
  await press('Send Parcel');
  expect(
    tree.root
      .findAllByType(TextInput)
      .some(node => node.props.accessibilityLabel === 'Parcel Weight'),
  ).toBe(true);
  expect(useListingDraft.getState().values.weight).toBe('-2');
});
test('structured route, single date and positive capacity reach next draft step', async () => {
  await mount();
  await press('Select From');
  await Renderer.act(async () =>
    tree.root.findByType(RouteLocationPicker).props.onSelect(routeFixture.from),
  );
  await press('Select To');
  await Renderer.act(async () =>
    tree.root.findByType(RouteLocationPicker).props.onSelect(routeFixture.to),
  );
  await press('Select Travel Date');
  expect(tree.root.findByType(SearchDatePicker).props.mode).toBe('single');
  await press('Choose ' + localDate(new Date()));
  await press('Apply date');
  await weight('15.5');
  await press('Continue');
  expect(navigation.navigate).toHaveBeenCalledWith('ListingReview');
  expect(useListingDraft.getState().values).toMatchObject({
    from: routeFixture.from,
    to: routeFixture.to,
    weight: '15.5',
    date: localDate(new Date()),
  });
});
test('draft survives remount and Back offers keep/discard without automatic data loss', async () => {
  await mount();
  await weight('7');
  await Renderer.act(async () => tree.unmount());
  await mount();
  expect(
    tree.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Carrying Capacity')!
      .props.value,
  ).toBe('7');
  const alert = jest.spyOn(Alert, 'alert');
  await Renderer.act(async () =>
    navigation.setOptions.mock.calls.at(-1)![0].headerLeft().props.onPress(),
  );
  expect(parentNavigate).not.toHaveBeenCalled();
  await Renderer.act(async () =>
    alert.mock.calls.at(-1)![2]!.find(button => button.text === 'Keep Draft')!
      .onPress!(),
  );
  expect(useListingDraft.getState().values.weight).toBe('7');
  expect(parentNavigate).toHaveBeenCalledWith('HomeStack');
  expect(useListingDraft.getState().dirty).toBe(false);
});
test.each(['-1', 'NaN', 'Infinity', '0', '1e3', '1.2.3'])(
  'rejects invalid weight %s',
  weightText => {
    expect(
      listingDraftSchema.safeParse({
        type: 'carry',
        from: routeFixture.from,
        to: routeFixture.to,
        date: localDate(new Date()),
        weight: weightText,
      }).success,
    ).toBe(false);
  },
);
test('separate business labels, same-route and invalid/past dates are rejected', () => {
  const base = {
    from: routeFixture.from,
    to: routeFixture.to,
    date: localDate(new Date()),
    weight: '3.5',
  };
  expect(listingDraftSchema.safeParse({ ...base, type: 'send' }).success).toBe(
    true,
  );
  expect(
    listingDraftSchema.safeParse({
      ...base,
      type: 'carry',
      to: routeFixture.from,
    }).success,
  ).toBe(false);
  expect(
    listingDraftSchema.safeParse({ ...base, type: 'send', date: '2020-02-31' })
      .success,
  ).toBe(false);
  expect(
    listingDraftSchema.safeParse({ ...base, type: 'send', date: '2000-01-01' })
      .success,
  ).toBe(false);
});

test('Stay preserves editing and Discard clears the draft before leaving', async () => {
  await mount();
  await weight('9');
  const alert = jest.spyOn(Alert, 'alert');
  await Renderer.act(async () =>
    navigation.setOptions.mock.calls.at(-1)![0].headerLeft().props.onPress(),
  );
  await Renderer.act(async () =>
    alert.mock.calls.at(-1)![2]!.find(button => button.text === 'Stay')!
      .onPress!(),
  );
  expect(parentNavigate).not.toHaveBeenCalled();
  expect(useListingDraft.getState().values.weight).toBe('9');
  await Renderer.act(async () =>
    navigation.setOptions.mock.calls.at(-1)![0].headerLeft().props.onPress(),
  );
  await Renderer.act(async () =>
    alert.mock.calls.at(-1)![2]!.find(button => button.text === 'Discard')!
      .onPress!(),
  );
  expect(useListingDraft.getState().values.weight).toBe('');
  expect(useListingDraft.getState().dirty).toBe(false);
  expect(parentNavigate).toHaveBeenCalledWith('HomeStack');
});
