import { ForgotPasswordScreen } from '../src/features/auth/screens/ForgotPasswordScreen';
import { RegisterScreen } from '../src/features/auth/screens/RegisterScreen';
import { useMyListingsTabs } from '../src/features/listings/store/myListingsStore';
import { routeFixture } from '../test/fixtures/search';
import { useListingDraft } from '../src/features/post-listing/store/listingDraftStore';
import { queryClient } from '../src/app/AppProviders';
import * as chatService from '../src/features/messages/services/chatService';
import * as listingService from '../src/features/listings/services/listingsService';
import * as detailsService from '../src/features/listings/services/listingDetailsService';
import { useLocationStore } from '../src/features/location/store/locationStore';
import { useFilterDraftStore } from '../src/features/search/store/filterDraftStore';
import React from 'react';
import { appConfig } from '../src/constants/appConfig';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { authService } from '../src/features/auth/services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlobalReachIntroScreen } from '../src/features/onboarding/screens/GlobalReachIntroScreen';
import { Alert, AppState, BackHandler, TextInput } from 'react-native';
import { HomeScreen } from '../src/features/home/screens/HomeScreen';
import { useSearchStore } from '../src/features/search/store/searchStore';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import App from '../App';
import { WelcomeScreen } from '../src/features/onboarding/screens/WelcomeScreen';
import { SendCarryIntroScreen } from '../src/features/onboarding/screens/SendCarryIntroScreen';
import { VerifiedIntroScreen } from '../src/features/onboarding/screens/VerifiedIntroScreen';
import { navigationRef } from '../src/navigation/navigationRef';
import { useUIStore } from '../src/store/uiStore';
import { useAuthStore } from '../src/store/authStore';

let tree: ReactTestRenderer | undefined;
const settle = async () => {
  await Renderer.act(async () => {
    jest.advanceTimersByTime(1000);
  });
};
const routeNames = () =>
  navigationRef.getRootState()!.routes.map(route => route.name);
async function mountGuest() {
  useUIStore.setState({ onboardingComplete: false });
  useAuthStore.setState({ status: 'guest', user: null });
  await Renderer.act(async () => {
    tree = Renderer.create(<App />);
  });
  await settle();
}
async function press(label: string) {
  const route = navigationRef.getCurrentRoute()?.name;
  const scope =
    route === 'ForgotPassword'
      ? tree!.root.findByType(ForgotPasswordScreen)
      : route === 'Register'
      ? tree!.root.findByType(RegisterScreen)
      : route === 'GlobalReach'
      ? tree!.root.findByType(GlobalReachIntroScreen)
      : route === 'VerifiedReliable'
      ? tree!.root.findByType(VerifiedIntroScreen)
      : route === 'Onboarding'
      ? tree!.root.findByType(SendCarryIntroScreen)
      : route === 'Welcome'
      ? tree!.root.findByType(WelcomeScreen)
      : tree!.root;
  await Renderer.act(async () => {
    scope
      .findAll(
        node =>
          node.props.accessibilityLabel === label &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
  });
  await settle();
}
async function back() {
  await Renderer.act(async () => {
    navigationRef.goBack();
  });
  await settle();
}
beforeEach(async () => {
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
  });
  queryClient.clear();
  useListingDraft.getState().discard();
  useMyListingsTabs.getState().clear();
  useDevelopmentStore.setState({
    previewActive: false,
    authEntryRequested: false,
  });
  jest.useFakeTimers();
  await AsyncStorage.removeItem('friendie.preferences');
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
  });
  tree = undefined;
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('guest onboarding supports both introductions, Global Reach, Back and Skip without authenticating', async () => {
  await mountGuest();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Welcome');
  await press('Get Started');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Onboarding');
  expect(routeNames()).toEqual(['Welcome', 'Onboarding']);
  await back();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Welcome');
  await press('Get Started');
  await press('Next');
  expect(navigationRef.getCurrentRoute()?.name).toBe('VerifiedReliable');
  expect(
    tree!.root
      .findByType(VerifiedIntroScreen)
      .findAll(
        node => node.props.accessibilityLabel === 'Introduction, page 2 of 4',
      ).length,
  ).toBeGreaterThan(0);
  await press('Next');
  expect(navigationRef.getCurrentRoute()?.name).toBe('GlobalReach');
  await back();
  expect(navigationRef.getCurrentRoute()?.name).toBe('VerifiedReliable');
  await back();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Onboarding');
  await press('Next');
  await press('Skip onboarding');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
  expect(routeNames()).toEqual(['AuthStack']);
  expect(useAuthStore.getState().status).toBe('guest');
  expect(useUIStore.getState().onboardingComplete).toBe(false);
  await Renderer.act(async () => {
    navigationRef.resetRoot({ index: 0, routes: [{ name: 'Welcome' }] });
  });
  await settle();
  await press('Get Started');
  await press('Skip onboarding');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
  expect(routeNames()).toEqual(['AuthStack']);
});

// Real routers are exercised; native gestures still require device validation.
test('protected navigation exposes tabs, nested Post routes, and drawer pages', async () => {
  await mountGuest();
  await Renderer.act(async () => {
    useAuthStore
      .getState()
      .setUser({ id: 1, name: 'Test traveller', email: 'test@example.test' });
  });
  await settle();
  await settle();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  const tabs = tree!.root.findAll(
    node =>
      node.props.accessibilityRole === 'tab' &&
      typeof node.props.onPress === 'function',
  );
  expect(
    ['Home', 'Listings', 'Post', 'Messages', 'Profile'].every(label =>
      tabs.some(node => node.props.accessibilityLabel === label),
    ),
  ).toBe(true);
  await Renderer.act(async () => {
    tabs
      .find(node => node.props.accessibilityLabel === 'Post')!
      .props.onPress();
  });
  await settle();
  expect(navigationRef.getCurrentRoute()?.name).toBe('PostListing');
  await Renderer.act(async () => {
    navigationRef.navigate('AppDrawer', {
      screen: 'MainTabs',
      params: { screen: 'PostListingStack', params: { screen: 'CarryParcel' } },
    });
  });
  await settle();
  expect(navigationRef.getCurrentRoute()?.name).toBe('CarryParcel');
  await back();
  expect(navigationRef.getCurrentRoute()?.name).toBe('PostListing');
  await Renderer.act(async () => {
    navigationRef.navigate('AppDrawer', { screen: 'SavedListings' });
  });
  await settle();
  expect(navigationRef.getCurrentRoute()?.name).toBe('SavedListings');
});

test('welcome Sign In replaces welcome with Login without exposing protected tabs', async () => {
  await mountGuest();
  await press('Sign In');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
  expect(routeNames()).toEqual(['AuthStack']);
  expect(useAuthStore.getState().status).toBe('guest');
  expect(useUIStore.getState().onboardingComplete).toBe(false);
});

test('hardware Back from direct verified entry restores Send & Carry and Welcome history', async () => {
  const backSpy = jest.spyOn(BackHandler, 'addEventListener');
  try {
    await mountGuest();
    await Renderer.act(async () => {
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: 'VerifiedReliable' }],
      });
    });
    await settle();
    const hardwareBack = () => {
      const calls = backSpy.mock.calls.filter(
        ([event]) => event === 'hardwareBackPress',
      );
      return calls[calls.length - 1][1]({
        type: 'hardwareBackPress',
        timeStamp: Date.now(),
      });
    };
    await Renderer.act(async () => {
      expect(hardwareBack()).toBe(true);
    });
    await settle();
    expect(navigationRef.getCurrentRoute()?.name).toBe('Onboarding');
    expect(routeNames()).toEqual(['Welcome', 'Onboarding']);
    await Renderer.act(async () => {
      expect(hardwareBack()).toBe(true);
    });
    await settle();
    expect(navigationRef.getCurrentRoute()?.name).toBe('Welcome');
    expect(routeNames()).toEqual(['Welcome']);
    expect(useAuthStore.getState().status).toBe('guest');
  } finally {
    backSpy.mockRestore();
  }
});

test('final onboarding persists completion, opens only Login and skips onboarding after remount', async () => {
  await mountGuest();
  await press('Get Started');
  await press('Next');
  await press('Next');
  const final = tree!.root.findByType(GlobalReachIntroScreen);
  expect(
    final.findAll(
      node => node.props.accessibilityLabel === 'Introduction, page 4 of 4',
    ).length,
  ).toBeGreaterThan(0);
  expect(
    final.findAll(node => node.props.accessibilityLabel === 'Skip onboarding')
      .length,
  ).toBe(0);
  await press('Get Started');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
  expect(routeNames()).toEqual(['AuthStack']);
  expect(useAuthStore.getState().status).toBe('guest');
  expect(
    JSON.parse((await AsyncStorage.getItem('friendie.preferences'))!).state
      .onboardingComplete,
  ).toBe(true);
  await Renderer.act(async () => {
    tree!.unmount();
  });
  tree = undefined;
  await mountGuest();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
  expect(routeNames()).toEqual(['AuthStack']);
});

test('failed completion save stays on Global Reach and permits retry', async () => {
  await mountGuest();
  await Renderer.act(async () => {
    navigationRef.navigate('GlobalReach');
  });
  await settle();
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('disk full'));
  await press('Get Started');
  expect(navigationRef.getCurrentRoute()?.name).toBe('GlobalReach');
  expect(useUIStore.getState().onboardingComplete).toBe(false);
  expect(
    tree!.root.findAll(node => node.props.accessibilityRole === 'alert').length,
  ).toBeGreaterThan(0);
  await press('Get Started');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
});

test('hardware Back from direct Global Reach restores Verified and its preceding history', async () => {
  const spy = jest.spyOn(BackHandler, 'addEventListener');
  try {
    await mountGuest();
    await Renderer.act(async () => {
      navigationRef.resetRoot({ index: 0, routes: [{ name: 'GlobalReach' }] });
    });
    await settle();
    const calls = spy.mock.calls.filter(
      ([event]) => event === 'hardwareBackPress',
    );
    await Renderer.act(async () => {
      expect(
        calls[calls.length - 1][1]({
          type: 'hardwareBackPress',
          timeStamp: Date.now(),
        }),
      ).toBe(true);
    });
    await settle();
    expect(navigationRef.getCurrentRoute()?.name).toBe('VerifiedReliable');
    expect(routeNames()).toEqual(['Welcome', 'Onboarding', 'VerifiedReliable']);
  } finally {
    spy.mockRestore();
  }
});

test('Home dashboard uses the real first name and routes every action through existing navigators', async () => {
  await mountGuest();
  await Renderer.act(async () => {
    useAuthStore.getState().setUser({
      id: 10,
      name: 'Ayesha Traveller',
      email: 'ayesha@example.test',
    });
  });
  await settle();
  const home = () => tree!.root.findByType(HomeScreen);
  expect(
    home().findAll(
      node =>
        Array.isArray(node.props.children) &&
        node.props.children.includes('Ayesha'),
    ).length,
  ).toBeGreaterThan(0);
  const returnHome = async () => {
    await Renderer.act(async () => {
      navigationRef.navigate('AppDrawer', {
        screen: 'MainTabs',
        params: { screen: 'HomeStack', params: { screen: 'Home' } },
      });
    });
    await settle();
  };
  for (const [label, route] of [
    ['Notifications', 'Notifications'],
    ['Open profile', 'Profile'],
    ['Send Parcel', 'SendParcel'],
    ['Carry Parcel', 'CarryParcel'],
    ['Open Listings', 'Listings'],
    ['Open Saved', 'SavedListings'],
    ['Open Messages', 'Conversations'],
    ['Open Reviews', 'MyReviews'],
  ]) {
    await press(label);
    expect(navigationRef.getCurrentRoute()?.name).toBe(route);
    await returnHome();
  }
  await Renderer.act(async () => {
    home()
      .findAllByType(TextInput)
      .find(
        node =>
          node.props.accessibilityLabel ===
          'Search listings, routes or locations',
      )!
      .props.onChangeText('  Dubai to London  ');
  });
  await press('Search listings');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Search');
  expect(useSearchStore.getState().filters).toEqual({
    query: 'Dubai to London',
  });
  await back();
  await press('Search listings in Pakistan');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Search');
  expect(useSearchStore.getState().filters).toEqual({
    destination: 'Pakistan',
  });
  await back();
  await press('View all locations');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Search');
  expect(useSearchStore.getState().filters).toEqual({});
});

test('direct Search entry hides Home tabs and hardware Back restores Home', async () => {
  const spy = jest.spyOn(BackHandler, 'addEventListener');
  try {
    await mountGuest();
    await Renderer.act(async () => {
      useAuthStore.getState().setUser({
        id: 1,
        name: 'Test traveller',
        email: 'traveller@example.test',
      });
    });
    await settle();
    await Renderer.act(async () => {
      navigationRef.resetRoot({
        index: 0,
        routes: [
          {
            name: 'AppDrawer',
            state: {
              routes: [
                {
                  name: 'MainTabs',
                  state: {
                    routes: [
                      {
                        name: 'HomeStack',
                        state: { routes: [{ name: 'Search' }] },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      });
    });
    await settle();
    expect(navigationRef.getCurrentRoute()?.name).toBe('Search');
    expect(
      tree!.root.findAll(
        node =>
          node.props.accessibilityRole === 'tab' &&
          node.props.accessibilityLabel === 'Home',
      ),
    ).toHaveLength(0);
    const calls = spy.mock.calls.filter(
      ([event]) => event === 'hardwareBackPress',
    );
    await Renderer.act(async () => {
      expect(
        calls[calls.length - 1][1]({
          type: 'hardwareBackPress',
          timeStamp: Date.now(),
        }),
      ).toBe(true);
    });
    await settle();
    expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
    expect(
      tree!.root.findAll(
        node =>
          node.props.accessibilityRole === 'tab' &&
          node.props.accessibilityLabel === 'Home',
      ).length,
    ).toBeGreaterThan(0);
  } finally {
    spy.mockRestore();
  }
});

test('debug Sign In opens Home with empty fields without login, token or authenticated state', async () => {
  const original = appConfig.uiPreviewEnabled;
  appConfig.uiPreviewEnabled = true;
  const login = jest.spyOn(authService, 'login');
  try {
    await mountGuest();
    await press('Sign In');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
    await press('Sign In');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
    expect(useAuthStore.getState().status).toBe('guest');
    expect(useAuthStore.getState().user).toBeNull();
    expect(login).not.toHaveBeenCalled();
    await Renderer.act(async () => {
      useDevelopmentStore.getState().exitPreview();
    });
    await settle();
    expect(navigationRef.getRootState()?.routeNames).not.toContain('AppDrawer');
  } finally {
    appConfig.uiPreviewEnabled = original;
    login.mockRestore();
  }
});

test('Filters applies manual geometry through the existing Search stack and resets worldwide', async () => {
  useSearchStore.getState().reset();
  useLocationStore.getState().useWorldwide();
  useFilterDraftStore.getState().reset();
  await mountGuest();
  await Renderer.act(async () => {
    useAuthStore.getState().setUser({
      id: 1,
      name: 'Test traveller',
      email: 'traveller@example.test',
    });
  });
  await settle();
  await press('Search listings');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Search');
  await press('Open advanced filters');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Filters');
  await press('Select Location Manually');
  await Renderer.act(async () => {
    useFilterDraftStore
      .getState()
      .setExactPin({ latitude: 24.8, longitude: 67.1 });
    useFilterDraftStore.getState().setRadius(42);
  });
  await press('Verified Users Only');
  await press('Match destination');
  await press('Apply Filters');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Search');
  expect(useLocationStore.getState().selection).toMatchObject({
    mode: 'radius',
    filter: { latitude: 24.8, longitude: 67.1, radiusKm: 42, source: 'manual' },
  });
  expect(useSearchStore.getState().filters).toMatchObject({
    verifiedOnly: true,
    radiusTarget: 'destination',
  });
  await press('Open advanced filters');
  expect(useFilterDraftStore.getState().radiusKm).toBe(42);
  expect(
    tree!.root.findAll(
      node =>
        node.props.accessibilityRole === 'tab' &&
        node.props.accessibilityLabel === 'Home',
    ),
  ).toHaveLength(0);
  await press('Reset filters');
  await press('Apply Filters');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Search');
  expect(useLocationStore.getState().selection).toEqual({ mode: 'worldwide' });
  await back();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
});

test('UI preview Listings uses its own Filters route and returns to results after Apply', async () => {
  const original = appConfig.uiPreviewEnabled;
  appConfig.uiPreviewEnabled = true;
  try {
    await mountGuest();
    await press('Sign In');
    await press('Sign In');
    await press('Listings');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Listings');
    await press('Filter listings');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Filters');
    await press('Reset filters');
    await press('Apply Filters');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Listings');
    await press('Go back');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
    expect(useAuthStore.getState().status).toBe('guest');
  } finally {
    appConfig.uiPreviewEnabled = original;
  }
});

test('Listings card opens the actual details ID and Back returns to results', async () => {
  const original = appConfig.uiPreviewEnabled;
  appConfig.uiPreviewEnabled = true;
  const get = jest.spyOn(listingService, 'getListings').mockResolvedValue({
    data: [
      {
        id: 42,
        type: 'carry',
        title: 'Test route',
        origin: 'Karachi',
        destination: 'Dubai',
        departureDate: '2099-11-12',
        category: 'Documents',
        price: 120,
        currency: 'USD',
      },
    ],
    meta: { current_page: 1, last_page: 1, total: 1 },
  });
  const details = jest
    .spyOn(detailsService, 'getListingDetails')
    .mockRejectedValue(Error('Details offline'));
  try {
    await mountGuest();
    await press('Sign In');
    await press('Sign In');
    await press('Listings');
    await press('Open listing Test route');
    expect(navigationRef.getCurrentRoute()?.name).toBe('ListingDetails');
    expect(navigationRef.getCurrentRoute()?.params).toEqual({
      listingId: '42',
    });
    expect(details).toHaveBeenCalledWith('42', expect.any(Object));
    await press('Back to listings');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Listings');
  } finally {
    appConfig.uiPreviewEnabled = original;
    get.mockRestore();
    details.mockRestore();
  }
});

test('Listing Details opens its conversation and hardware Back restores that listing', async () => {
  const hardware = jest.spyOn(BackHandler, 'addEventListener');
  const detail = jest
    .spyOn(detailsService, 'getListingDetails')
    .mockResolvedValue({
      id: 52,
      ownerId: 7,
      status: 'active',
      type: 'carry',
      title: 'Test listing',
      origin: 'Karachi',
      destination: 'Dubai',
      departureDate: '2099-11-12',
      category: 'Documents',
      price: 120,
      currency: 'USD',
      contact: { conversationId: 'conversation-52' },
    });
  const conversation = jest
    .spyOn(chatService, 'getConversation')
    .mockResolvedValue({
      id: 'conversation-52',
      canSend: false,
      participant: { id: 7, name: 'Test traveller', deleted: false },
    });
  const messages = jest
    .spyOn(chatService, 'getMessages')
    .mockResolvedValue({ data: [], nextCursor: null });
  try {
    await mountGuest();
    await Renderer.act(async () => {
      useAuthStore
        .getState()
        .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
    });
    await settle();
    await Renderer.act(async () => {
      navigationRef.navigate('AppDrawer', {
        screen: 'MainTabs',
        params: {
          screen: 'ListingsStack',
          params: { screen: 'ListingDetails', params: { listingId: '52' } },
        },
      });
    });
    await settle();
    await press('Message traveller');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Chat');
    expect(navigationRef.getCurrentRoute()?.params).toMatchObject({
      conversationId: 'conversation-52',
      returnTo: { stack: 'ListingsStack', listingId: '52' },
    });
    const calls = hardware.mock.calls.filter(
      ([event]) => event === 'hardwareBackPress',
    );
    await Renderer.act(async () => {
      expect(
        calls.at(-1)![1]({ type: 'hardwareBackPress', timeStamp: Date.now() }),
      ).toBe(true);
    });
    await settle();
    expect(navigationRef.getCurrentRoute()?.name).toBe('ListingDetails');
    expect(navigationRef.getCurrentRoute()?.params).toEqual({
      listingId: '52',
    });
  } finally {
    hardware.mockRestore();
    detail.mockRestore();
    conversation.mockRestore();
    messages.mockRestore();
  }
});

test('Post form continues to draft review and preserves values through Back and Keep Draft', async () => {
  const original = appConfig.uiPreviewEnabled;
  appConfig.uiPreviewEnabled = true;
  const hardware = jest.spyOn(BackHandler, 'addEventListener'),
    alert = jest.spyOn(Alert, 'alert');
  try {
    await mountGuest();
    await press('Sign In');
    await press('Sign In');
    await Renderer.act(async () => {
      useListingDraft.getState().update({
        type: 'carry',
        from: routeFixture.from,
        to: routeFixture.to,
        date: '2099-01-01',
        weight: '12',
      });
      useListingDraft.getState().keep();
    });
    await press('Post');
    expect(navigationRef.getCurrentRoute()?.name).toBe('PostListing');
    await Renderer.act(async () => {
      tree!.root
        .findAllByType(TextInput)
        .find(node => node.props.accessibilityLabel === 'Carrying Capacity')!
        .props.onChangeText('20');
    });
    await press('Continue');
    expect(navigationRef.getCurrentRoute()?.name).toBe('ListingReview');
    expect(useListingDraft.getState().values.weight).toBe('20');
    await back();
    expect(navigationRef.getCurrentRoute()?.name).toBe('PostListing');
    expect(
      tree!.root
        .findAllByType(TextInput)
        .find(node => node.props.accessibilityLabel === 'Carrying Capacity')!
        .props.value,
    ).toBe('20');
    const calls = hardware.mock.calls.filter(
      ([event]) => event === 'hardwareBackPress',
    );
    await Renderer.act(async () => {
      calls.at(-1)![1]({ type: 'hardwareBackPress', timeStamp: Date.now() });
    });
    expect(navigationRef.getCurrentRoute()?.name).toBe('PostListing');
    await Renderer.act(async () => {
      alert.mock.calls.at(-1)![2]!.find(button => button.text === 'Keep Draft')!
        .onPress!();
    });
    await settle();
    expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
    expect(useListingDraft.getState().values.weight).toBe('20');
  } finally {
    appConfig.uiPreviewEnabled = original;
    hardware.mockRestore();
    alert.mockRestore();
  }
});

test('UI preview keeps screen access visible and opens a working local demo chat', async () => {
  const original = appConfig.uiPreviewEnabled;
  appConfig.uiPreviewEnabled = true;
  try {
    await mountGuest();
    await press('Sign In');
    await press('Sign In');
    useSearchStore.getState().reset();
    useLocationStore.getState().useWorldwide();
    await press('Listings');
    expect(
      tree!.root.findAll(
        node =>
          node.props.accessibilityRole === 'tab' &&
          node.props.accessibilityLabel === 'Post',
      ).length,
    ).toBeGreaterThan(0);
    await press('Messages');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Conversations');
    await press('Preview Post a Listing');
    expect(navigationRef.getCurrentRoute()?.name).toBe('PostListing');
    await press('Messages');
    await press('Preview Filters');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Filters');
    await press('Messages');
    await press('Open demo chat with Ali Raza');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Chat');
    expect(navigationRef.getCurrentRoute()?.params).toMatchObject({
      conversationId: 'demo-chat-ali',
    });
    await settle();
    await settle();
    await Renderer.act(async () => {
      tree!.root
        .findAllByType(TextInput)
        .find(node => node.props.accessibilityLabel === 'Message draft')!
        .props.onChangeText('Preview hello');
    });
    await press('Send message');
    await settle();
    expect(
      tree!.root.findAll(node => node.props.children === 'Preview hello')
        .length,
    ).toBeGreaterThan(0);
    expect(useAuthStore.getState().status).toBe('guest');
    expect(useAuthStore.getState().user).toBeNull();
    await press('Post');
    expect(navigationRef.getCurrentRoute()?.name).toBe('PostListing');
  } finally {
    appConfig.uiPreviewEnabled = original;
  }
}, 15000);

test('demo listing Message opens its sample conversation without real authentication', async () => {
  const original = appConfig.uiPreviewEnabled;
  appConfig.uiPreviewEnabled = true;
  try {
    await mountGuest();
    await press('Sign In');
    await press('Sign In');
    useSearchStore.getState().reset();
    useLocationStore.getState().useWorldwide();
    await press('Listings');
    await press('Open listing Traveller to Dubai');
    expect(navigationRef.getCurrentRoute()?.name).toBe('ListingDetails');
    await press('Message traveller');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Chat');
    expect(navigationRef.getCurrentRoute()?.params).toMatchObject({
      conversationId: 'demo-listing-900001',
    });
    expect(useAuthStore.getState().status).toBe('guest');
  } finally {
    appConfig.uiPreviewEnabled = original;
  }
});

test('preview My Listings status filters and details Back preserve the selected tab', async () => {
  const original = appConfig.uiPreviewEnabled;
  appConfig.uiPreviewEnabled = true;
  const hardware = jest.spyOn(BackHandler, 'addEventListener');
  try {
    await mountGuest();
    await press('Sign In');
    await press('Sign In');
    await press('Open My Listings');
    expect(navigationRef.getCurrentRoute()?.name).toBe('MyListings');
    await settle();
    expect(
      tree!.root.findAll(node => node.props.children === 'Active (3)').length,
    ).toBeGreaterThan(0);
    await press('Completed listings');
    await settle();
    expect(useMyListingsTabs.getState().tabs.demo).toBe('completed');
    await press('Expired listings');
    await settle();
    await press('Open my listing 930005');
    expect(navigationRef.getCurrentRoute()?.name).toBe('ListingDetails');
    expect(navigationRef.getCurrentRoute()?.params).toEqual({
      listingId: '930005',
      returnTo: 'MyListings',
    });
    const calls = hardware.mock.calls.filter(
      ([event]) => event === 'hardwareBackPress',
    );
    await Renderer.act(async () => {
      expect(
        calls.at(-1)![1]({ type: 'hardwareBackPress', timeStamp: Date.now() }),
      ).toBe(true);
    });
    await settle();
    expect(navigationRef.getCurrentRoute()?.name).toBe('MyListings');
    expect(useMyListingsTabs.getState().tabs.demo).toBe('expired');
    expect(
      tree!.root.findAll(node => node.props.children === 'Expired (1)').length,
    ).toBeGreaterThan(0);
  } finally {
    appConfig.uiPreviewEnabled = original;
    hardware.mockRestore();
  }
});

test('Profile preview menus, edit entry and confirmed Logout return to Login', async () => {
  const original = appConfig.uiPreviewEnabled;
  appConfig.uiPreviewEnabled = true;
  const alert = jest.spyOn(Alert, 'alert');
  try {
    await mountGuest();
    await press('Sign In');
    await press('Sign In');
    await press('Profile');
    await settle();
    expect(navigationRef.getCurrentRoute()?.name).toBe('Profile');
    expect(
      tree!.root.findAll(
        node =>
          node.props.children === 'UI demo - sample profile and statistics',
      ).length,
    ).toBeGreaterThan(0);
    await press('Edit Profile');
    expect(navigationRef.getCurrentRoute()?.name).toBe('EditProfile');
    await back();
    await press('Payment Methods');
    expect(alert).toHaveBeenCalledWith(
      'Payment Methods unavailable',
      expect.any(String),
    );
    await press('Logout');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Profile');
    await Renderer.act(async () =>
      alert.mock.calls.at(-1)![2]!.find(button => button.text === 'Cancel')!
        .onPress!(),
    );
    expect(navigationRef.getCurrentRoute()?.name).toBe('Profile');
    queryClient.setQueryData(['private-profile-test'], { private: true });
    await press('Logout');
    await Renderer.act(async () =>
      alert.mock.calls.at(-1)![2]!.find(button => button.text === 'Logout')!
        .onPress!(),
    );
    await settle();
    await settle();
    expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
    expect(useAuthStore.getState().status).toBe('guest');
    expect(useUIStore.getState().onboardingComplete).toBe(false);
    expect(queryClient.getQueryData(['private-profile-test'])).toBeUndefined();
    await press('Sign In');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  } finally {
    appConfig.uiPreviewEnabled = original;
    alert.mockRestore();
  }
}, 15000);

test('Register opens from Sign In and returns through its existing auth stack', async () => {
  await mountGuest();
  await press('Sign In');
  await press('Register');
  await settle();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Register');
  expect(
    tree!.root.findAll(node => node.props.children === 'Create Account').length,
  ).toBeGreaterThan(0);
  await press('Back to Sign In');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
  await press('Register');
  await press('Sign In');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
  expect(
    navigationRef
      .getRootState()!
      .routes.some(route => route.name === 'AppDrawer'),
  ).toBe(false);
});

test('Forgot Password and labeled preview confirmation return to Login without extra auth screens', async () => {
  const original = appConfig.uiPreviewEnabled;
  appConfig.uiPreviewEnabled = true;
  try {
    await mountGuest();
    await press('Sign In');
    await press('Forgot Password?');
    expect(navigationRef.getCurrentRoute()?.name).toBe('ForgotPassword');
    await press('Preview confirmation (UI only)');
    expect(
      tree!.root.findAll(node => node.props.children === 'Check Your Email')
        .length,
    ).toBeGreaterThan(0);
    await press('Back to Sign In');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
    await press('Forgot Password?');
    await press('Back to Sign In footer');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
    expect(useAuthStore.getState().status).toBe('guest');
  } finally {
    appConfig.uiPreviewEnabled = original;
  }
});
