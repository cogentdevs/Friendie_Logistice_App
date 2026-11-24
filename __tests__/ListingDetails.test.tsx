import { SubmitReviewDialog } from '../src/features/reviews/components/SubmitReviewDialog';
import { InitialMessageDialog } from '../src/features/listings/components/InitialMessageDialog';
import { getPublicListingDetails } from '../src/features/listings/services/publicListingsService';
import { publicListingFixture } from '../test/fixtures/publicListing';
import { RequestConfirmationDialog } from '../src/features/listings/components/RequestConfirmationDialog';
import * as authFlow from '../src/features/auth/services/authFlowCoordinator';
import { apiClient } from '../src/services/api/apiClient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ListingsStackParamList } from '../src/navigation/navigationTypes';
import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { Alert, Image, Linking, Share, Text } from 'react-native';
import {
  QueryClient,
  QueryClientProvider,
  notifyManager,
} from '@tanstack/react-query';
import { ListingDetailsScreen } from '../src/features/listings/screens/ListingDetailsScreen';
import * as service from '../src/features/listings/services/listingDetailsService';
import * as ownDetails from '../src/features/listings/services/ownListingDetailsService';
import { ownListingFixture } from '../test/fixtures/myListings';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useListingBookmarks } from '../src/features/listings/store/bookmarkStore';
import { navigationRef } from '../src/navigation/navigationRef';
import { ApiError } from '../src/types/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Resolve lazy native component modules before Jest starts the first interaction
// timer; keep the real preset components rather than replacing screen behavior.
const nativeViews = require('react-native');
[
  'View',
  'Text',
  'ScrollView',
  'Modal',
  'TextInput',
  'Pressable',
  'Image',
  'KeyboardAvoidingView',
  'StatusBar',
  'ActivityIndicator',
  'TouchableOpacity',
].forEach(name => Reflect.get(nativeViews, name));
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
const editNavigate = jest.fn();
const nav = {
  getParent: () => ({ navigate: editNavigate }),
  getState: () => ({ routeNames: ['Listings'] }),
  setOptions: jest.fn(),
  canGoBack: () => true,
  goBack: jest.fn(),
};
async function settle() {
  await Renderer.act(async () => {
    await Promise.resolve();
  });
}
async function mount(returnTo?: 'MyReviews' | 'MyListings') {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <ListingDetailsScreen
          route={{
            key: 'detail',
            name: 'ListingDetails',
            params: { listingId: '12', ...(returnTo ? { returnTo } : {}) },
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
  notifyManager.setScheduler(callback => callback());
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
  });
  client?.clear();
  notifyManager.setScheduler(callback => setTimeout(callback, 0));
  jest.restoreAllMocks();
});

test('My Listings opens the owner endpoint without public/demo data or demo cover', async () => {
  const publicGet = jest.spyOn(service, 'getListingDetails');
  const privateGet = jest
    .spyOn(ownDetails, 'getOwnListingDetails')
    .mockResolvedValue({
      ...fixture,
      ownerId: 88,
      traveller: undefined,
      contact: undefined,
      coverImageUrl: 'http://media.example.test/own.jpg',
      price: null,
      currency: null,
      status: 'pending',
      backend: { ...ownListingFixture, status: 0 },
    });
  await mount('MyListings');
  expect(privateGet).toHaveBeenCalledWith('12', expect.any(Object));
  expect(privateGet).toHaveBeenCalledTimes(1);
  expect(publicGet).not.toHaveBeenCalled();
  expect(
    tree.root
      .findAllByType(Image)
      .some(
        node => node.props.source?.uri === 'http://media.example.test/own.jpg',
      ),
  ).toBe(true);
  expect(
    tree.root.findAll(node => node.props.children === 'Price unavailable')
      .length,
  ).toBeGreaterThan(0);
  expect(
    tree.root.findAll(node => node.props.title === 'Manage Listing').length,
  ).toBeGreaterThan(0);
  await press('Edit');
  expect(editNavigate).toHaveBeenCalledWith('PostListingStack', {
    screen: 'PostListing',
    params: { editListingId: '12' },
  });
  expect(client.getQueryData(['ownListingDetails', 88, '12'])).toBeDefined();
  expect(client.getQueryData(['listingDetails', '12', 'demo'])).toBeUndefined();
});
test('a new backend cover URL retries a failed image for the same owner listing; old errors cannot hide it', async () => {
  const original = {
    ...fixture,
    ownerId: 88,
    status: 'pending' as const,
    backend: { ...ownListingFixture, status: 0 as const },
    coverImageUrl: 'https://media.example.test/old.jpg',
  };
  jest.spyOn(ownDetails, 'getOwnListingDetails').mockResolvedValue(original);
  await mount('MyListings');
  const old = tree.root
    .findAllByType(Image)
    .find(node => node.props.source?.uri === original.coverImageUrl)!;
  const oldError = old.props.onError;
  await Renderer.act(async () => oldError());
  expect(
    tree.root
      .findAllByType(Image)
      .some(node => node.props.source?.uri === original.coverImageUrl),
  ).toBe(false);
  const updated = {
    ...original,
    coverImageUrl: 'https://media.example.test/new_unique.jpg',
  };
  await Renderer.act(async () => {
    client.setQueryData(['ownListingDetails', 88, '12'], updated);
  });
  await settle();
  expect(
    tree.root
      .findAllByType(Image)
      .some(node => node.props.source?.uri === updated.coverImageUrl),
  ).toBe(true);
  await Renderer.act(async () => oldError());
  expect(
    tree.root
      .findAllByType(Image)
      .some(node => node.props.source?.uri === updated.coverImageUrl),
  ).toBe(true);
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
        node.props.accessibilityLabel === 'Request Now' && !node.props.disabled,
    ).length,
  ).toBeGreaterThan(0);
});
test('login and callPermitted alone never open dialer; message uses supplied conversation ID', async () => {
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
  expect(service.permittedPhone(fixture)).toBeUndefined();
  expect(alert).not.toHaveBeenCalled();
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
  expect(alert).not.toHaveBeenCalled();
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

test('details opened from a review return to the existing Reviews route without resetting its selected tab', async () => {
  jest.spyOn(service, 'getListingDetails').mockResolvedValue(fixture);
  jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
  const navigate = jest
    .spyOn(navigationRef, 'navigate')
    .mockImplementation(() => {});
  await mount('MyReviews');
  await Renderer.act(async () => {
    nav.setOptions.mock.calls.at(-1)![0].headerLeft().props.onPress();
  });
  expect(navigate).toHaveBeenCalledWith('AppDrawer', { screen: 'MyReviews' });
});

test('guest Request Now delegates listing ID to existing guard without exposing contact', async () => {
  useAuthStore.getState().clear();
  const guard = jest.spyOn(authFlow, 'requireAuth').mockReturnValue(true);
  jest.spyOn(service, 'getListingDetails').mockResolvedValue(fixture);
  await mount();
  await press('Request Now');
  expect(guard).toHaveBeenCalledWith({
    type: 'REQUEST_LISTING',
    params: { listingId: '12' },
  });
  expect(tree.root.findByType(RequestConfirmationDialog).props.visible).toBe(
    false,
  );
  expect(JSON.stringify(tree.toJSON())).not.toContain('+92 300 1234567');
});
test('authenticated review revalidates once on rapid taps and never fabricates submission', async () => {
  let finish!: (detail: service.ListingDetail) => void;
  const get = jest
    .spyOn(service, 'getListingDetails')
    .mockResolvedValueOnce(fixture)
    .mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
  const post = jest.spyOn(apiClient, 'post');
  await mount();
  await Renderer.act(async () => {
    const action = tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Request Now' &&
        typeof node.props.onPress === 'function',
    )[0];
    action.props.onPress();
    action.props.onPress();
  });
  expect(get).toHaveBeenCalledTimes(2);
  await Renderer.act(async () => {
    finish(fixture);
  });
  await settle();
  expect(tree.root.findByType(RequestConfirmationDialog).props.visible).toBe(
    true,
  );
  expect(
    tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Send Request' &&
        node.props.disabled === true,
    ).length,
  ).toBeGreaterThan(0);
  expect(post).not.toHaveBeenCalled();
  await press('Cancel request');
  expect(tree.root.findByType(RequestConfirmationDialog).props.visible).toBe(
    false,
  );
});
test('own listing has management action and no self-request CTA', async () => {
  jest
    .spyOn(service, 'getListingDetails')
    .mockResolvedValue({ ...fixture, ownerId: 88 });
  await mount();
  expect(
    tree.root.findAll(node => node.props.accessibilityLabel === 'Request Now'),
  ).toHaveLength(0);
  expect(
    tree.root.findAll(
      node => node.props.accessibilityLabel === 'Manage Listing',
    ).length,
  ).toBeGreaterThan(0);
});
test('availability change during revalidation blocks confirmation', async () => {
  jest
    .spyOn(service, 'getListingDetails')
    .mockResolvedValueOnce(fixture)
    .mockResolvedValue({ ...fixture, status: 'expired' });
  await mount();
  await press('Request Now');
  expect(tree.root.findByType(RequestConfirmationDialog).props.visible).toBe(
    false,
  );
  expect(
    tree.root.findAll(
      node => node.props.children === 'This listing has expired.',
    ).length,
  ).toBeGreaterThan(0);
});
test('session expiry during revalidation cannot reopen confirmation', async () => {
  let finish!: (detail: service.ListingDetail) => void;
  jest
    .spyOn(service, 'getListingDetails')
    .mockResolvedValueOnce(fixture)
    .mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
  await mount();
  await press('Request Now');
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
    finish(fixture);
  });
  await settle();
  expect(tree.root.findByType(RequestConfirmationDialog).props.visible).toBe(
    false,
  );
});

test('offline revalidation keeps confirmation closed and never submits', async () => {
  jest
    .spyOn(service, 'getListingDetails')
    .mockResolvedValueOnce(fixture)
    .mockRejectedValue(new Error('Offline'));
  const post = jest.spyOn(apiClient, 'post');
  await mount();
  await press('Request Now');
  expect(tree.root.findByType(RequestConfirmationDialog).props.visible).toBe(
    false,
  );
  expect(post).not.toHaveBeenCalled();
});

test('real public identity enables the existing Message traveller icon and opens input without POST', async () => {
  jest.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: { success: true, data: { ...publicListingFixture, id: 12 } },
  });
  const remote = await getPublicListingDetails('12');
  jest.spyOn(service, 'getListingDetails').mockResolvedValue(remote);
  const post = jest.spyOn(apiClient, 'post');
  await mount();
  const button = tree.root.findAll(
    node =>
      node.props.accessibilityLabel === 'Message traveller' &&
      typeof node.props.onPress === 'function',
  )[0];
  expect(button.props.disabled).toBe(false);
  await press('Message traveller');
  expect(tree.root.findByType(InitialMessageDialog).props.visible).toBe(true);
  expect(post).not.toHaveBeenCalled();
});

test('real Public Listing Details opens authorized review input without altering parcel requests', async () => {
  jest.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: { success: true, data: { ...publicListingFixture, id: 12 } },
  });
  const remote = await getPublicListingDetails('12');
  jest.spyOn(service, 'getListingDetails').mockResolvedValue(remote);
  const post = jest.spyOn(apiClient, 'post');
  await mount();
  await press('Write a review');
  expect(tree.root.findByType(SubmitReviewDialog).props.visible).toBe(true);
  expect(
    tree.root.findByType(SubmitReviewDialog).props.draft.rating,
  ).toBeNull();
  expect(tree.root.findByType(RequestConfirmationDialog).props.visible).toBe(
    false,
  );
  expect(post).not.toHaveBeenCalled();
});
test('static public listing keeps Write a review disabled', async () => {
  jest.spyOn(service, 'getListingDetails').mockResolvedValue(fixture);
  await mount();
  const button = tree.root.findAll(
    node =>
      node.props.accessibilityLabel === 'Write a review' &&
      typeof node.props.onPress === 'function',
  )[0];
  expect(button.props.disabled).toBe(true);
});

test('verified owner pins are selectable, refresh after editing, and disappear on account switching', async () => {
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('phase4-dummy-token');
  const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: {
      success: true,
      message: 'Listing',
      data: {
        ...ownListingFixture,
        id: 12,
        from_latitude: 0,
        from_longitude: 0,
        to_latitude: -33.8688197,
        to_longitude: 151.2092955,
      },
    },
  });
  await mount('MyListings');
  const values = () =>
    tree.root
      .findAllByType(Text)
      .filter(node => node.props.selectable === true)
      .map(node => node.props.children);
  expect(values()).toEqual(['0, 0', '-33.8688197, 151.2092955']);
  get.mockResolvedValue({
    status: 200,
    data: {
      success: true,
      message: 'Listing',
      data: {
        ...ownListingFixture,
        id: 12,
        from_latitude: 24.86,
        from_longitude: 67.01,
        to_latitude: null,
        to_longitude: null,
      },
    },
  });
  await Renderer.act(async () => {
    await client.invalidateQueries({
      queryKey: ['ownListingDetails', 88, '12'],
    });
  });
  await settle();
  expect(values()).toEqual(['24.86, 67.01']);
  get.mockRejectedValue(new ApiError('Not found.', 'not-found', 404));
  await Renderer.act(async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 99, name: 'Other', email: 'other@example.test' },
    });
  });
  expect(values()).not.toContain('24.86, 67.01');
  await Renderer.act(async () =>
    useAuthStore.setState({ status: 'guest', user: undefined }),
  );
  expect(values()).toEqual([]);
});

test('public details and unverified cached owner records never display exact pins', async () => {
  const privateRecord = {
    ...fixture,
    status: 'active' as const,
    backend: {
      ...ownListingFixture,
      from_latitude: 24.86,
      from_longitude: 67.01,
    },
  };
  jest.spyOn(service, 'getListingDetails').mockResolvedValue(privateRecord);
  await mount();
  expect(
    tree.root.findAll(node => node.props.children === 'From Location Pin'),
  ).toHaveLength(0);
  await Renderer.act(async () => tree.unmount());
  jest
    .spyOn(ownDetails, 'getOwnListingDetails')
    .mockResolvedValue(privateRecord);
  await mount('MyListings');
  expect(
    tree.root.findAll(node => node.props.children === 'From Location Pin'),
  ).toHaveLength(0);
});
