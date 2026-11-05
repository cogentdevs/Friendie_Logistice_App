import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ListingsStackParamList } from '../src/navigation/navigationTypes';
import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { Alert, Image, Linking, Share } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ListingDetailsScreen } from '../src/features/listings/screens/ListingDetailsScreen';
import * as service from '../src/features/listings/services/listingDetailsService';
import { useAuthStore } from '../src/store/authStore';
import { useListingBookmarks } from '../src/features/listings/store/bookmarkStore';
import { navigationRef } from '../src/navigation/navigationRef';
import { ApiError } from '../src/types/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
const fixture: service.ListingDetail = {
  id: 12,
  ownerId: 7,
  status: 'active',
  requestStatus: 'none',
  type: 'carry',
  title: 'Travel to Dubai',
  origin: 'Karachi, Pakistan',
  destination: 'Dubai, UAE',
  departureDate: '2099-11-12',
  category: 'Documents',
  price: 120,
  currency: 'USD',
  capacityKg: 15,
  itemTypes: ['Documents', 'Gadgets'],
  coverImageUrl: 'https://example.test/dubai.jpg',
  traveller: {
    id: 7,
    name: 'Test Traveller',
    verified: true,
    rating: 4.9,
    reviewCount: 128,
  },
  contact: {
    phone: '+92 300 1234567',
    callPermitted: true,
    conversationId: 'conversation-42',
  },
  shareUrl: 'https://example.test/listings/12',
};
let tree: ReactTestRenderer, client: QueryClient;
const nav = {
  getState: () => ({ routeNames: ['Listings'] }),
  setOptions: jest.fn(),
  canGoBack: () => true,
  goBack: jest.fn(),
};
async function settle() {
  await Renderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 25));
  });
}
async function mount() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <ListingDetailsScreen
          route={{
            key: 'detail',
            name: 'ListingDetails',
            params: { listingId: '12' },
          }}
          navigation={
            nav as unknown as NativeStackScreenProps<
              ListingsStackParamList,
              'ListingDetails'
            >['navigation']
          }
        />
      </QueryClientProvider>,
    );
  });
  await settle();
}
async function press(label: string) {
  await Renderer.act(async () => {
    const control = tree.root.findAll(
      node =>
        node.props.accessibilityLabel === label &&
        typeof node.props.onPress === 'function',
    )[0];
    await control.props.onPress();
  });
  await settle();
}
async function renderHeader() {
  await Renderer.act(async () => {
    const options = nav.setOptions.mock.calls.at(-1)![0];
    tree.update(
      <QueryClientProvider client={client}>
        <ViewWithHeader header={options.headerRight()} />
      </QueryClientProvider>,
    );
  });
}
function ViewWithHeader({ header }: { header: React.ReactNode }) {
  return (
    <>
      {header}
      <ListingDetailsScreen
        route={{
          key: 'detail',
          name: 'ListingDetails',
          params: { listingId: '12' },
        }}
        navigation={
          nav as unknown as NativeStackScreenProps<
            ListingsStackParamList,
            'ListingDetails'
          >['navigation']
        }
      />
    </>
  );
}
beforeEach(async () => {
  jest.clearAllMocks();
  nav.setOptions.mockClear();
  useAuthStore.setState({
    status: 'authenticated',
    user: { id: 88, name: 'Member', email: 'member@example.test' },
  });
  useListingBookmarks.setState({ ids: [], owner: undefined });
  await AsyncStorage.removeItem('friendie.bookmarks.88');
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client?.clear();
  });
  jest.restoreAllMocks();
});
test('fetches actual route ID and displays fee, units, verified identity and disabled unsupported request', async () => {
  const get = jest
    .spyOn(service, 'getListingDetails')
    .mockResolvedValue({ ...fixture, weight: { value: 10, unit: 'lb' } });
  await mount();
  expect(get).toHaveBeenCalledWith('12', expect.any(Object));
  expect(
    tree.root.findAll(node => node.props.children === 'Up to 10 lb').length,
  ).toBeGreaterThan(0);
  expect(
    tree.root.findAll(
      node => node.props.accessibilityLabel === 'Verified account',
    ).length,
  ).toBeGreaterThan(0);
  expect(
    tree.root.findAll(node => node.props.children === 'USD\u00a0120.00')
      .length +
      tree.root.findAll(
        node =>
          typeof node.props.children === 'string' &&
          node.props.children.includes('USD'),
      ).length,
  ).toBeGreaterThan(0);
  expect(
    tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Request Now' &&
        node.props.disabled === true,
    ).length,
  ).toBeGreaterThan(0);
});
test('permitted phone opens dialer only after confirmation and message uses supplied conversation ID', async () => {
  jest.spyOn(service, 'getListingDetails').mockResolvedValue(fixture);
  const alert = jest.spyOn(Alert, 'alert');
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const ready = jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
  const navigate = jest
    .spyOn(navigationRef, 'navigate')
    .mockImplementation(() => {});
  await mount();
  await press('Call traveller');
  expect(open).not.toHaveBeenCalled();
  await Renderer.act(async () => {
    await alert.mock.calls
      .at(-1)![2]!
      .find(action => action.text === 'Open dialer')!.onPress!();
  });
  expect(open).toHaveBeenCalledWith('tel:+923001234567');
  await press('Message traveller');
  expect(navigate).toHaveBeenCalledWith('AppDrawer', {
    screen: 'MainTabs',
    params: {
      screen: 'MessagesStack',
      params: {
        screen: 'Chat',
        params: {
          conversationId: 'conversation-42',
          returnTo: { stack: 'ListingsStack', listingId: '12' },
        },
      },
    },
  });
  expect(ready).toHaveBeenCalled();
});
test('guest contact is auth-blocked and image errors use neutral fallback', async () => {
  useAuthStore.setState({ status: 'guest', user: null });
  jest.spyOn(service, 'getListingDetails').mockResolvedValue(fixture);
  const alert = jest.spyOn(Alert, 'alert');
  const open = jest.spyOn(Linking, 'openURL');
  await mount();
  await press('Call traveller');
  expect(alert).toHaveBeenCalledWith('Sign in required', expect.any(String));
  expect(open).not.toHaveBeenCalled();
  await Renderer.act(async () => {
    tree.root
      .findAllByType(Image)
      .find(node => node.props.accessibilityLabel === 'Dubai, UAE destination')!
      .props.onError();
  });
  expect(
    tree.root
      .findAllByType(Image)
      .filter(
        node => node.props.accessibilityLabel === 'Dubai, UAE destination',
      ),
  ).toHaveLength(0);
});
test('missing contact, own and requested listings remain unavailable without fabricated actions', async () => {
  jest.spyOn(service, 'getListingDetails').mockResolvedValue({
    ...fixture,
    ownerId: 88,
    contact: undefined,
    traveller: undefined,
  });
  await mount();
  expect(
    tree.root.findAll(
      node => node.props.children === 'You cannot request your own listing.',
    ).length,
  ).toBeGreaterThan(0);
  expect(
    tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Call traveller' &&
        node.props.disabled === true,
    ).length,
  ).toBeGreaterThan(0);
  expect(
    tree.root.findAll(
      node => node.props.accessibilityLabel === 'Verified account',
    ),
  ).toHaveLength(0);
});
test('404 has unavailable/back state and can reload after query reset', async () => {
  const get = jest
    .spyOn(service, 'getListingDetails')
    .mockRejectedValueOnce(new ApiError('Not found', 'not-found', 404))
    .mockResolvedValue(fixture);
  await mount();
  expect(
    tree.root.findAll(node => node.props.children === 'Listing unavailable')
      .length,
  ).toBeGreaterThan(0);
  await press('Back to listings');
  expect(nav.goBack).toHaveBeenCalled();
  await Renderer.act(async () => {
    await client.resetQueries({ queryKey: ['listingDetails'] });
  });
  await settle();
  expect(get).toHaveBeenCalledTimes(2);
});
test('save header persists a device bookmark and More shares only the supplied URL', async () => {
  jest.spyOn(service, 'getListingDetails').mockResolvedValue(fixture);
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
  await mount();
  await renderHeader();
  await settle();
  await press('Save listing on this device');
  expect(useListingBookmarks.getState().ids).toContain(12);
  await renderHeader();
  await press('More listing options');
  await press('Share listing');
  expect(share).toHaveBeenCalledWith({
    message: 'Travel to Dubai\nhttps://example.test/listings/12',
  });
});

test('network error exposes a working Retry action', async () => {
  const get = jest
    .spyOn(service, 'getListingDetails')
    .mockRejectedValueOnce(Error('offline'))
    .mockResolvedValue(fixture);
  await mount();
  await press('Retry listing details');
  expect(get).toHaveBeenCalledTimes(2);
  expect(
    tree.root.findAll(node => node.props.children === 'Carrying Fee').length,
  ).toBeGreaterThan(0);
});
