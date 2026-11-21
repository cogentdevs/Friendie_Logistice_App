import { useAuthStore } from '../src/store/authStore';
import React from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PostListingScreen } from '../src/features/post-listing/screens/PostListingScreen';
import { ListingLocationPicker } from '../src/features/post-listing/components/ListingLocationPicker';
import { listingGpsService } from '../src/features/post-listing/services/listingGpsService';
import { ListingReferencePicker } from '../src/features/post-listing/components/ListingReferencePicker';
import { SearchDatePicker } from '../src/features/search/components/SearchDatePicker';
import { useListingDraft } from '../src/features/post-listing/store/listingDraftStore';
import { listingDraftSchema } from '../src/features/post-listing/types/listingDraft';
import {
  createListingDraft,
  referenceResponse,
} from '../test/fixtures/createListing';
import { apiClient } from '../src/services/api/apiClient';
import { localDate } from '../src/features/search/types/search';
import { KeyboardScrollView } from '../src/components/layout/KeyboardScrollView';
import { keyboardMeasurements } from '../test/fixtures/keyboard';
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
test('Task 35 manual addresses are independent, persisted in draft and use existing multiline inputs', async () => {
  await mount();
  for (const [label, value, key] of [['From Address', '12 Pickup Street', 'fromAddress'], ['To Address', '34 Delivery Road', 'toAddress']] as const) {
    const input = tree.root.findAllByType(TextInput).filter(node => node.props.accessibilityLabel === label);
    expect(input).toHaveLength(1);
    expect(input[0].props.multiline).toBe(true);
    expect(input[0].props.maxLength).toBe(255);
    await Renderer.act(async () => input[0].props.onChangeText(value));
    expect(useListingDraft.getState().values[key]).toBe(value);
  }
  expect(useListingDraft.getState().values.fromAddress).toBe('12 Pickup Street');
});
test('Task 35 automatic GPS fills From Address only and keeps manual destination', async () => {
  useListingDraft.getState().update({ ...useListingDraft.getState().values, toAddress: 'Manual destination' });
  jest.spyOn(listingGpsService, 'hasPermission').mockResolvedValue(true);
  jest.spyOn(listingGpsService, 'enabled').mockResolvedValue(true);
  jest.spyOn(listingGpsService, 'detect').mockResolvedValue({ country: createListingDraft.from!.country, city: createListingDraft.from!.city, address: '12 GPS Street' });
  await mount();
  expect(useListingDraft.getState().values).toMatchObject({fromAddress: '12 GPS Street', toAddress: 'Manual destination'});
});
test('Task 35 manual address typed during GPS wins over late result', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof listingGpsService.detect>>) => void;
  jest.spyOn(listingGpsService, 'hasPermission').mockResolvedValue(true);
  jest.spyOn(listingGpsService, 'enabled').mockResolvedValue(true);
  jest.spyOn(listingGpsService, 'detect').mockImplementation(() => new Promise(done => { resolve = done; }));
  await mount();
  await Renderer.act(async () => tree.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === 'From Address')!.props.onChangeText('Manual origin'));
  await Renderer.act(async () => resolve({country: createListingDraft.from!.country, city: createListingDraft.from!.city, address: 'Stale GPS Street'}));
  expect(useListingDraft.getState().values.fromAddress).toBe('Manual origin');
});
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
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
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
  jest
    .spyOn(apiClient, 'get')
    .mockImplementation(async (url, config) => referenceResponse(url, config));
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

test('Create Listing retains the lower-field draft across keyboard focus/resize without submitting', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const post = jest.spyOn(apiClient, 'post');
  await mount();
  expect(tree.root.findByType(KeyboardAvoidingView).props.behavior).toBe(
    'height',
  );
  expect(
    tree.root.findByType(KeyboardAvoidingView).props.keyboardVerticalOffset,
  ).toBe(56);
  expect(tree.root.findAllByType(KeyboardScrollView)).toHaveLength(1);
  const geometry = keyboardMeasurements();
  const nativeInput = geometry.input;
  jest
    .spyOn(TextInput.State, 'currentlyFocusedInput')
    .mockReturnValue(nativeInput as never);
  const scroll = tree.root.findByType(ScrollView);
  jest
    .spyOn(scroll.instance, 'getNativeScrollRef')
    .mockReturnValue(geometry.viewport);
  jest
    .spyOn(scroll.instance, 'getInnerViewRef')
    .mockReturnValue(geometry.content);
  const reveal = jest
    .spyOn(scroll.instance, 'scrollTo')
    .mockImplementation(() => {});
  await weight('0');
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
  await Renderer.act(async () => {
    scroll.props.onFocus({});
    scroll.props.onLayout({ nativeEvent: { layout: { height: 350 } } });
  });
  expect(reveal).toHaveBeenCalledWith({ y: 514, animated: true });
  jest.mocked(Keyboard.isVisible).mockReturnValue(false);
  await Renderer.act(async () => {
    scroll.props.onLayout({ nativeEvent: { layout: { height: 750 } } });
  });
  expect(useListingDraft.getState().values.weight).toBe('0');
  expect(post).not.toHaveBeenCalled();
  expect(navigation.navigate).not.toHaveBeenCalled();
});
test('real reference selectors, title, two dates and integer capacity reach review', async () => {
  await mount();
  await Renderer.act(async () =>
    tree.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Title')!
      .props.onChangeText('Travel parcel space'),
  );
  await press('Select Category');
  await Renderer.act(async () =>
    tree.root.findByType(ListingReferencePicker).props.onSelect({
      key: '7',
      label: 'Documents',
      value: createListingDraft.category,
    }),
  );
  await press('Select Currency');
  await Renderer.act(async () =>
    tree.root
      .findByType(ListingReferencePicker)
      .props.onSelect({ key: 'PKR', label: 'PKR', value: 'PKR' }),
  );
  await press('Select From');
  await Renderer.act(async () =>
    tree.root
      .findByType(ListingLocationPicker)
      .props.onSelect(createListingDraft.from),
  );
  await press('Select To');
  await Renderer.act(async () =>
    tree.root
      .findByType(ListingLocationPicker)
      .props.onSelect(createListingDraft.to),
  );
  await press('Select Departure Date');
  expect(tree.root.findByType(SearchDatePicker).props.mode).toBe('single');
  await press('Choose ' + localDate(new Date()));
  await press('Apply date');
  await press('Select Arrival / Reached Date');
  await press('Choose ' + localDate(new Date()));
  await press('Apply date');
  await weight('15');
  await press('Continue');
  expect(navigation.navigate).toHaveBeenCalledWith('ListingReview');
  expect(useListingDraft.getState().values).toMatchObject({
    from: createListingDraft.from,
    to: createListingDraft.to,
    weight: '15',
    title: 'Travel parcel space',
    category: createListingDraft.category,
    currency: 'PKR',
    reachedOn: localDate(new Date()),
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
test.each(['-1', 'NaN', 'Infinity', '1.5', '1e3', '1.2.3', '2147483648'])(
  'rejects invalid weight %s',
  weightText => {
    expect(
      listingDraftSchema.safeParse({
        ...createListingDraft,
        weight: weightText,
      }).success,
    ).toBe(false);
  },
);
test('backend permits same route and past dates; invalid dates and arrival order are rejected', () => {
  const base = {
    ...createListingDraft,
  };
  expect(listingDraftSchema.safeParse({ ...base, type: 'send' }).success).toBe(
    true,
  );
  expect(
    listingDraftSchema.safeParse({
      ...base,
      type: 'carry',
      to: createListingDraft.from,
    }).success,
  ).toBe(true);
  expect(
    listingDraftSchema.safeParse({ ...base, type: 'send', date: '2020-02-31' })
      .success,
  ).toBe(false);
  expect(
    listingDraftSchema.safeParse({ ...base, type: 'send', date: '2000-01-01' })
      .success,
  ).toBe(true);
  expect(
    listingDraftSchema.safeParse({ ...base, reachedOn: '2000-01-01' }).success,
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

test('optional Description and Price per KG appear once and persist real user input without submitting', async () => {
  const post = jest.spyOn(apiClient, 'post');
  await mount();
  for (const [label, value, key] of [
    ['Description (optional)', 'My parcel description', 'description'],
    ['Price per KG (optional)', '0', 'weightPrice'],
  ] as const) {
    const inputs = tree.root
      .findAllByType(TextInput)
      .filter(node => node.props.accessibilityLabel === label);
    expect(inputs).toHaveLength(1);
    if (key === 'description') expect(inputs[0].props.multiline).toBe(true);
    await Renderer.act(async () => inputs[0].props.onChangeText(value));
    expect(useListingDraft.getState().values[key]).toBe(value);
  }
  expect(post).not.toHaveBeenCalled();
});

test('Create From picker restores accessible GPS action without changing searchable selectors or destination', async () => {
  await mount();
  await press('Select From');
  expect(tree.root.findByType(ListingLocationPicker).props.gps).toBeDefined();
  expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Use Current Location' && typeof node.props.onPress === 'function')).toHaveLength(1);
  await press('Cancel location');
  await press('Select To');
  expect(tree.root.findByType(ListingLocationPicker).props.gps).toBeUndefined();
});
test('already-enabled automatic GPS fills only real origin IDs and preserves destination and price zero', async () => {
  useListingDraft.getState().update({ ...useListingDraft.getState().values, to: createListingDraft.to, weightPrice: '0' });
  jest.spyOn(listingGpsService, 'hasPermission').mockResolvedValue(true);
  jest.spyOn(listingGpsService, 'enabled').mockResolvedValue(true);
  jest.spyOn(listingGpsService, 'detect').mockResolvedValue({ country: createListingDraft.from!.country, city: createListingDraft.from!.city, area: 'Detected area' });
  const post = jest.spyOn(apiClient, 'post');
  await mount();
  expect(useListingDraft.getState().values).toMatchObject({ from: { country: createListingDraft.from!.country, city: createListingDraft.from!.city, source: 'api', area: { name: 'Detected area' } }, to: createListingDraft.to, weightPrice: '0' });
  expect(post).not.toHaveBeenCalled();
});
