import { useBrowseFiltersStore } from '../src/features/listings/store/browseFiltersStore';
import { RequestConfirmationDialog } from '../src/features/listings/components/RequestConfirmationDialog';
import { ListingsScreen } from '../src/features/listings/screens/ListingsScreen';
import { GuestProfileScreen } from '../src/features/profile/screens/GuestProfileScreen';
import {
  requireAuth,
  cancelAuthentication,
} from '../src/features/auth/services/authFlowCoordinator';
import { useAuthFlowStore } from '../src/features/auth/store/authFlowStore';
import { ContactUsScreen } from '../src/features/support/screens/ContactUsScreen';
import { uiTestingLogin } from '../src/features/auth/development/uiTestingLogin';
import { MyReviewsScreen } from '../src/features/reviews/screens/MyReviewsScreen';
import { LogoutConfirmationModal } from '../src/features/auth/components/LogoutConfirmationModal';
import { AppButton } from '../src/components/ui/AppButton';
import { DrawerItem } from '@react-navigation/drawer';
import { DisclaimerScreen } from '../src/features/legal/screens/DisclaimerScreen';
import { TermsConditionsScreen } from '../src/features/legal/screens/TermsConditionsScreen';
import { PrivacyPolicyScreen } from '../src/features/legal/screens/PrivacyPolicyScreen';
import { ContactSupportScreen } from '../src/features/support/screens/ContactSupportScreen';
import { ProfileDashboardScreen } from '../src/features/dashboard/screens/ProfileDashboardScreen';
import { ProfileScreen } from '../src/features/profile/screens/ProfileScreen';
import { ChangePasswordScreen } from '../src/features/settings/screens/ChangePasswordScreen';
import { SettingsScreen } from '../src/features/settings/screens/SettingsScreen';
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
  // Navigation scenarios use the explicit public UI-testing login gate.
  if (label === 'Sign In' && route === 'Login' && appConfig.uiPreviewEnabled) {
    await Renderer.act(async () => {
      for (const [name, value] of [
        ['Email Address', uiTestingLogin.email],
        ['Password', uiTestingLogin.password],
      ]) {
        tree!.root
          .findAllByType(TextInput)
          .find(node => node.props.accessibilityLabel === name)!
          .props.onChangeText(value);
      }
    });
  }
  const scope =
    route === 'Listings' && label.startsWith('Open listing ')
      ? tree!.root.findByType(ListingsScreen)
      : useAuthStore.getState().status !== 'authenticated' &&
        label === 'Sign In' &&
        [
          'MyReviews',
          'ProfileDashboard',
          'Settings',
          'ChangePassword',
        ].includes(route ?? '')
      ? tree!.root
      : route === 'MyReviews'
      ? tree!.root.findByType(MyReviewsScreen)
      : route === 'Disclaimer'
      ? tree!.root.findByType(DisclaimerScreen)
      : route === 'TermsConditions'
      ? tree!.root.findByType(TermsConditionsScreen)
      : route === 'PrivacyPolicy'
      ? tree!.root.findByType(PrivacyPolicyScreen)
      : route === 'ContactSupport'
      ? tree!.root.findByType(ContactSupportScreen)
      : route === 'ProfileDashboard'
      ? tree!.root.findByType(ProfileDashboardScreen)
      : route === 'Profile'
      ? tree!.root.findByType(
          useAuthStore.getState().status === 'authenticated'
            ? ProfileScreen
            : GuestProfileScreen,
        )
      : route === 'Settings'
      ? tree!.root.findByType(SettingsScreen)
      : route === 'ChangePassword'
      ? tree!.root.findByType(ChangePasswordScreen)
      : route === 'ForgotPassword'
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
  useBrowseFiltersStore.getState().reset();
  cancelAuthentication();
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
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  expect(routeNames()).toEqual(['AppDrawer']);
  expect(useAuthStore.getState().status).toBe('guest');
  expect(useUIStore.getState().onboardingComplete).toBe(true);
  expect(navigationRef.canGoBack()).toBe(false);
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
  const drawerMenu = tree!.root; // Drawer invokes custom content as a render callback.
  const drawerLabels = drawerMenu
    .findAllByType(DrawerItem)
    .map(item => item.props.label);
  for (const label of ['Tracking', 'Notifications', 'Help & Support'])
    expect(drawerLabels).not.toContain(label);
  for (const [label, route, backLabel] of [
    ['Contact Us', 'ContactSupport', 'Back from Contact Us'],
    ['Privacy Policy', 'PrivacyPolicy', 'Back from Privacy Policy'],
    ['Terms & Conditions', 'TermsConditions', 'Back from Terms & Conditions'],
    ['Disclaimer', 'Disclaimer', 'Back from Disclaimer'],
  ]) {
    await Renderer.act(async () => {
      drawerMenu
        .findAllByType(DrawerItem)
        .find(item => item.props.label === label)!
        .props.onPress();
    });
    await settle();
    expect(navigationRef.getCurrentRoute()?.name).toBe(route);
    await press(backLabel);
    expect(navigationRef.getCurrentRoute()?.name).toBe('SavedListings');
  }

  await Renderer.act(async () => {
    navigationRef.navigate('AppDrawer', { screen: 'HelpSupport' });
  });
  await settle();
  await press('Contact Us');
  expect(navigationRef.getCurrentRoute()?.name).toBe('ContactUs');
  await press('Back from Contact Us');
  expect(navigationRef.getCurrentRoute()?.name).toBe('HelpSupport');
  await Renderer.act(async () => {
    navigationRef.navigate('AppDrawer', { screen: 'About' });
  });
  await settle();
  expect(navigationRef.getCurrentRoute()?.name).toBe('About');
  await press('Disclaimer');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Disclaimer');
  await press('Back from Disclaimer');
  expect(navigationRef.getCurrentRoute()?.name).toBe('About');
  await press('Terms & Conditions');
  expect(navigationRef.getCurrentRoute()?.name).toBe('TermsConditions');
  await press('Privacy Policy');
  expect(navigationRef.getCurrentRoute()?.name).toBe('PrivacyPolicy');
  await press('Back from Privacy Policy');
  expect(navigationRef.getCurrentRoute()?.name).toBe('TermsConditions');
  await press('Back from Terms & Conditions');
  expect(navigationRef.getCurrentRoute()?.name).toBe('About');
  await press('Privacy Policy');
  expect(navigationRef.getCurrentRoute()?.name).toBe('PrivacyPolicy');
  await press('Back from Privacy Policy');
  expect(navigationRef.getCurrentRoute()?.name).toBe('About');
  await press('Contact Us');
  expect(navigationRef.getCurrentRoute()?.name).toBe('ContactUs');
  const drawerLogout = () =>
    tree!.root
      .findAllByType(AppButton)
      .find(node => node.props.title === 'Logout')!;
  await Renderer.act(async () => {
    drawerLogout().props.onPress();
  });
  await settle();
  let logoutModal = tree!.root
    .findAllByType(LogoutConfirmationModal)
    .find(node => node.props.visible)!;
  expect(logoutModal).toBeDefined();
  await Renderer.act(async () => {
    logoutModal.props.onCancel();
  });
  expect(useAuthStore.getState().status).toBe('authenticated');
  queryClient.setQueryData(['drawer-private'], { private: true });
  await Renderer.act(async () => {
    drawerLogout().props.onPress();
  });
  await settle();
  logoutModal = tree!.root
    .findAllByType(LogoutConfirmationModal)
    .find(node => node.props.visible)!;
  await Renderer.act(async () => {
    logoutModal.props.onConfirm();
  });
  await settle();
  await settle();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  expect(queryClient.getQueryData(['drawer-private'])).toBeUndefined();
  expect(routeNames()).toEqual(['AppDrawer']);
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

test('final onboarding persists completion, opens Home and returning guest skips onboarding', async () => {
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
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  expect(routeNames()).toEqual(['AppDrawer']);
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
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  expect(routeNames()).toEqual(['AppDrawer']);
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
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
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
  await Renderer.act(async () => {
    useSearchStore.getState().setFilters({
      from: routeFixture.from,
      to: routeFixture.to,
      query: '  Dubai to London  ',
    });
  });
  await settle();
  await press('Submit keyword and selected filters');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Results');
  expect(useSearchStore.getState().filters).toMatchObject({
    query: 'Dubai to London',
    from: routeFixture.from,
    to: routeFixture.to,
  });
  await back();
  // The development marketplace is public even when login preview is inactive.
  expect(
    home().findAll(
      node => node.props.accessibilityLabel === 'Search listings in Pakistan',
    ).length,
  ).toBeGreaterThan(0);
  await press('View all locations');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  await press('Close directory');
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

test('UI testing credentials open Home without a real login, token or authenticated state', async () => {
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
    expect(navigationRef.getRootState()?.routeNames).toContain('AppDrawer');
  } finally {
    appConfig.uiPreviewEnabled = original;
    login.mockRestore();
  }
});

test('Filters applies manual geometry through the existing Search stack and resets worldwide', async () => {
  useSearchStore.getState().reset();
  useBrowseFiltersStore.getState().reset();
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
  await Renderer.act(async () => {
    navigationRef.navigate('AppDrawer', {
      screen: 'MainTabs',
      params: { screen: 'HomeStack', params: { screen: 'Search' } },
    });
  });
  await settle();
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
    await authenticatePhase3();
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

test('UI preview never grants Post or Messages membership', async () => {
  await mountGuest();
  await press('Sign In');
  await press('Sign In');
  await press('Post');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
  expect(useAuthStore.getState().status).toBe('guest');
  expect(useAuthFlowStore.getState().flow?.action.type).toBe('POST_LISTING');
  await press('Cancel sign in');
  await press('Messages');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
  expect(useAuthFlowStore.getState().flow?.action.type).toBe('OPEN_MESSAGES');
});

test('demo listing Message requires actual authentication before private chat', async () => {
  await mountGuest();
  await press('Sign In');
  await press('Sign In');
  await Renderer.act(async () => {
    useSearchStore.getState().reset();
    useLocationStore.getState().useWorldwide();
  });
  await press('Listings');
  await press('Open listing Traveller to Dubai');
  await press('Message traveller');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
  expect(useAuthFlowStore.getState().flow?.action).toEqual({
    type: 'OPEN_MESSAGES',
    params: {
      conversationId: 'demo-listing-900001',
      returnTo: { stack: 'ListingsStack', listingId: '900001' },
    },
  });
  expect(useAuthStore.getState().status).toBe('guest');
});

test('guest drawer My Listings is guarded and resumes only after membership', async () => {
  await openPhase2GuestHome();
  await Renderer.act(async () => {
    tree!.root
      .findAllByType(DrawerItem)
      .find(item => item.props.label === 'My Listings')!
      .props.onPress();
  });
  await settle();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
  expect(useAuthFlowStore.getState().flow?.action).toEqual({
    type: 'OPEN_ACCOUNT',
    params: { destination: 'MyListings' },
  });
  await authenticatePhase3();
  expect(navigationRef.getCurrentRoute()?.name).toBe('MyListings');
});

test('authenticated Profile preserves seven menu actions; confirmed logout returns Guest Home', async () => {
  await openPhase2GuestHome();
  await authenticatePhase3();
  await press('Profile');
  for (const label of [
    'Dashboard',
    'Edit Profile',
    'My Listing',
    'Messages',
    'Reviews',
    'Change Password',
    'Logout',
  ])
    expect(
      tree!.root
        .findByType(ProfileScreen)
        .findAll(node => node.props.accessibilityLabel === label).length,
    ).toBeGreaterThan(0);
  await press('Dashboard');
  expect(navigationRef.getCurrentRoute()?.name).toBe('ProfileDashboard');
  await press('Back to Profile');
  await press('Edit Profile');
  expect(navigationRef.getCurrentRoute()?.name).toBe('EditProfile');
  await back();
  await press('Change Password');
  expect(navigationRef.getCurrentRoute()?.name).toBe('ChangePassword');
  await press('Back to Profile');
  await press('Logout');
  await press('Cancel logout');
  expect(useAuthStore.getState().status).toBe('authenticated');
  queryClient.setQueryData(['private-phase3'], { secret: true });
  await press('Logout');
  await press('Confirm logout');
  await settle();
  await settle();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  expect(routeNames()).toEqual(['AppDrawer']);
  expect(navigationRef.canGoBack()).toBe(false);
  expect(useUIStore.getState().onboardingComplete).toBe(true);
  expect(queryClient.getQueryData(['private-phase3'])).toBeUndefined();
  expect(
    tree!.root.findAll(
      node => node.props.accessibilityLabel === 'Browse category Food Items',
    ).length,
  ).toBeGreaterThan(0);
  expect(
    tree!.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Open listing Traveller to Dubai',
    ).length,
  ).toBeGreaterThan(0);
  await press('Profile');
  expect(tree!.root.findAllByType(GuestProfileScreen)).toHaveLength(1);
});

test('Register opens from Sign In and returns through its existing auth stack', async () => {
  await mountGuest();
  await press('Sign In');
  await press('Register');
  await settle();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Register');
  await press('Terms & Conditions');
  expect(navigationRef.getCurrentRoute()?.name).toBe('TermsConditions');
  await press('Back from Terms & Conditions');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Register');
  await Renderer.act(async () => {
    tree!.root
      .findByType(RegisterScreen)
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Full Name')!
      .props.onChangeText('Draft Member');
  });
  await press('Privacy Policy');
  expect(navigationRef.getCurrentRoute()?.name).toBe('PrivacyPolicy');
  await press('Back from Privacy Policy');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Register');
  expect(
    tree!.root
      .findByType(RegisterScreen)
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Full Name')!.props.value,
  ).toBe('Draft Member');
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

test('Profile Settings exposes Change Password and returns through the existing drawer', async () => {
  const original = appConfig.uiPreviewEnabled;
  appConfig.uiPreviewEnabled = true;
  try {
    await mountGuest();
    await press('Sign In');
    await press('Sign In');
    await authenticatePhase3();
    await press('Profile');
    await press('Profile Settings');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Settings');
    await press('Privacy Policy');
    expect(navigationRef.getCurrentRoute()?.name).toBe('PrivacyPolicy');
    await press('Back from Privacy Policy');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Settings');
    await press('Contact Us');
    expect(navigationRef.getCurrentRoute()?.name).toBe('ContactSupport');
    await press('Back from Contact Us');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Settings');
    await press('Change Password');
    expect(navigationRef.getCurrentRoute()?.name).toBe('ChangePassword');
    await press('Back to Settings');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Settings');
  } finally {
    appConfig.uiPreviewEnabled = original;
  }
});

test('guest disclaimer footer uses public legal/support routes and Back returns to the source', async () => {
  await mountGuest();
  await Renderer.act(async () => {
    navigationRef.navigate('Disclaimer');
  });
  await settle();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Disclaimer');
  await press('Contact Us');
  expect(navigationRef.getCurrentRoute()?.name).toBe('ContactSupport');
  await press('Back from Contact Us');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Disclaimer');
  await press('Terms & Conditions');
  expect(navigationRef.getCurrentRoute()?.name).toBe('TermsConditions');
  await press('Back from Terms & Conditions');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Disclaimer');
  await press('Privacy Policy');
  expect(navigationRef.getCurrentRoute()?.name).toBe('PrivacyPolicy');
  await press('Back from Privacy Policy');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Disclaimer');
  expect(routeNames()).not.toContain('AppDrawer');
  expect(useAuthStore.getState().status).toBe('guest');
  await press('Back from Disclaimer');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Welcome');
}, 15000);

test('returning guest opens public Home, public navigation works, and private screens remain unmounted', async () => {
  await AsyncStorage.setItem(
    'friendie.preferences',
    JSON.stringify({ state: { onboardingComplete: true }, version: 0 }),
  );
  await mountGuest();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  expect(navigationRef.canGoBack()).toBe(false);
  expect(useAuthStore.getState().status).toBe('guest');
  for (const heading of ['Our Categories', 'Popular Locations', 'Latest Ads'])
    expect(
      tree!.root.findAll(node => node.props.children === heading).length,
    ).toBeGreaterThan(0);
  expect(
    tree!.root.findAll(
      node => node.props.accessibilityLabel === 'Open navigation menu',
    ).length,
  ).toBeGreaterThan(0);
  const toHome = async () => {
    await Renderer.act(async () => {
      navigationRef.navigate('AppDrawer', {
        screen: 'MainTabs',
        params: { screen: 'HomeStack', params: { screen: 'Home' } },
      });
    });
    await settle();
  };
  await press('Listings');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Listings');
  await toHome();
  await Renderer.act(async () => {
    navigationRef.navigate('AppDrawer', {
      screen: 'MainTabs',
      params: { screen: 'HomeStack', params: { screen: 'Search' } },
    });
  });
  await settle();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Search');
  await press('Open advanced filters');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Filters');
  await press('Apply Filters');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Search');
  await toHome();
  await press('Profile');
  expect(tree!.root.findAllByType(GuestProfileScreen)).toHaveLength(1);
  await toHome();
  for (const tab of ['Messages', 'Post']) {
    await press(tab);
    expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
    expect(tree!.root.findAllByType(ProfileScreen)).toHaveLength(0);
    await press('Cancel sign in');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  }
  await Renderer.act(async () => {
    navigationRef.navigate('AppDrawer', { screen: 'About' });
  });
  await settle();
  await press('Contact Us');
  expect(navigationRef.getCurrentRoute()?.name).toBe('ContactUs');
  expect(tree!.root.findAllByType(ContactUsScreen)).toHaveLength(1);
  await toHome();
  await press('Profile');
  await press('Sign In');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
  await press('Register');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Register');
  await press('Back to Sign In');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
});

test('Skip on first introduction persists completion and root Home has no onboarding back history', async () => {
  await mountGuest();
  await press('Get Started');
  await press('Skip onboarding');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  expect(navigationRef.canGoBack()).toBe(false);
  expect(
    JSON.parse((await AsyncStorage.getItem('friendie.preferences'))!).state
      .onboardingComplete,
  ).toBe(true);
});

test('returning authenticated session opens Home directly while preserving identity and credentials', async () => {
  const restore = jest
    .spyOn(authService, 'restore')
    .mockImplementation(async () => {
      useAuthStore.getState().setUser({
        id: 73,
        name: 'Restored member',
        email: 'restored@example.test',
      });
    });
  try {
    await mountGuest();
    expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
    expect(routeNames()).toEqual(['AppDrawer']);
    expect(navigationRef.canGoBack()).toBe(false);
    expect(useAuthStore.getState().user?.id).toBe(73);
    await Renderer.act(async () => {
      useAuthStore.getState().clear();
    });
    await settle();
    expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
    expect(routeNames()).toEqual(['AppDrawer']);
    expect(useUIStore.getState().onboardingComplete).toBe(false);
  } finally {
    restore.mockRestore();
  }
});

test('a rapid double Skip persists onboarding once and opens a single Home route', async () => {
  await mountGuest();
  await press('Get Started');
  const before = jest
    .mocked(AsyncStorage.setItem)
    .mock.calls.filter(([key]) => key === 'friendie.preferences').length;
  const skip = tree!.root.findAll(
    node =>
      node.props.accessibilityLabel === 'Skip onboarding' &&
      typeof node.props.onPress === 'function',
  )[0].props.onPress;
  await Renderer.act(async () => {
    await Promise.all([skip(), skip()]);
  });
  await settle();
  expect(
    jest
      .mocked(AsyncStorage.setItem)
      .mock.calls.filter(([key]) => key === 'friendie.preferences').length -
      before,
  ).toBe(1);
  expect(routeNames()).toEqual(['AppDrawer']);
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
});

test('failed Skip persistence remains on onboarding with a retryable error', async () => {
  await mountGuest();
  await press('Get Started');
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('storage full'));
  await press('Skip onboarding');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Onboarding');
  expect(useUIStore.getState().onboardingComplete).toBe(false);
  await press('Skip onboarding');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
});

async function openPhase2GuestHome() {
  await mountGuest();
  await press('Get Started');
  await press('Skip onboarding');
}
test('Phase 2: repeated protected action opens one Login; Register and Forgot retain intent; Cancel restores public origin', async () => {
  await openPhase2GuestHome();
  const originKey = navigationRef.getRootState()!.routes[0].key;
  await Renderer.act(async () => {
    requireAuth({ type: 'POST_LISTING', params: { listingType: 'carry' } });
    requireAuth({ type: 'OPEN_PROFILE' });
  });
  await settle();
  expect(routeNames()).toEqual(['AppDrawer', 'AuthStack']);
  const intended = useAuthFlowStore.getState().flow?.id;
  await press('Register');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Register');
  expect(useAuthFlowStore.getState().flow?.id).toBe(intended);
  await back();
  await press('Forgot Password?');
  expect(navigationRef.getCurrentRoute()?.name).toBe('ForgotPassword');
  expect(useAuthFlowStore.getState().flow?.id).toBe(intended);
  await back();
  await press('Cancel sign in');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  expect(navigationRef.getRootState()!.routes[0].key).toBe(originKey);
  expect(useAuthFlowStore.getState().flow).toBeNull();
  expect(useAuthStore.getState().status).toBe('guest');
});
test('Phase 2: validated authentication resumes original Post flow once without Login in history', async () => {
  await openPhase2GuestHome();
  const originKey = navigationRef.getRootState()!.routes[0].key;
  await Renderer.act(async () => {
    requireAuth({ type: 'POST_LISTING', params: { listingType: 'carry' } });
  });
  await settle();
  // Inject the result of the separately tested validated authentication service.
  await Renderer.act(async () => {
    useAuthStore
      .getState()
      .setUser({ id: 55, name: 'Member', email: 'member@example.test' });
  });
  await settle();
  await settle();
  expect(navigationRef.getCurrentRoute()?.name).toBe('CarryParcel');
  expect(useListingDraft.getState().values.type).toBe('carry');
  expect(routeNames()).toEqual(['AppDrawer']);
  expect(navigationRef.getRootState()!.routes[0].key).toBe(originKey);
  expect(useAuthFlowStore.getState().flow).toBeNull();
});
test('Phase 2: Android/root Back cancels pending authentication', async () => {
  await openPhase2GuestHome();
  await Renderer.act(async () => {
    requireAuth({ type: 'OPEN_MESSAGES' });
  });
  await settle();
  await back();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  expect(useAuthFlowStore.getState().flow).toBeNull();
});

async function authenticatePhase3() {
  await Renderer.act(async () => {
    useAuthStore
      .getState()
      .setUser({ id: 55, name: 'Member', email: 'member@example.test' });
  });
  await settle();
  await settle();
}
test.each([
  ['Post', 'POST_LISTING', 'PostListing'],
  ['Messages', 'OPEN_MESSAGES', 'Conversations'],
] as const)(
  'Phase 3 guest %s preserves origin, prevents duplicate Login and resumes %s',
  async (tab, action, destination) => {
    await openPhase2GuestHome();
    await press(tab);
    await Renderer.act(async () => {
      requireAuth({ type: action });
    });
    await settle();
    expect(routeNames()).toEqual(['AppDrawer', 'AuthStack']);
    expect(useAuthFlowStore.getState().flow?.action.type).toBe(action);
    await press('Cancel sign in');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
    await press(tab);
    await authenticatePhase3();
    expect(navigationRef.getCurrentRoute()?.name).toBe(destination);
    expect(routeNames()).toEqual(['AppDrawer']);
  },
);
test.each([
  ['Send Parcel', 'send', 'SendParcel'],
  ['Carry Parcel', 'carry', 'CarryParcel'],
] as const)(
  'Phase 3 %s preserves listing type through Register and Login',
  async (label, type, destination) => {
    await openPhase2GuestHome();
    await press(label);
    await press('Register');
    await press('Back to Sign In');
    expect(useAuthFlowStore.getState().flow?.action).toEqual({
      type: 'POST_LISTING',
      params: { listingType: type },
    });
    await authenticatePhase3();
    expect(navigationRef.getCurrentRoute()?.name).toBe(destination);
    expect(useListingDraft.getState().values.type).toBe(type);
  },
);
test.each([
  ['Sign In', 'Login'],
  ['Create Account', 'Register'],
] as const)(
  'Phase 3 Guest Profile %s returns to authenticated Profile',
  async (label, authRoute) => {
    await openPhase2GuestHome();
    await press('Profile');
    expect(tree!.root.findAllByType(GuestProfileScreen)).toHaveLength(1);
    expect(tree!.root.findAllByType(ProfileScreen)).toHaveLength(0);
    await press(label);
    expect(navigationRef.getCurrentRoute()?.name).toBe(authRoute);
    await authenticatePhase3();
    expect(navigationRef.getCurrentRoute()?.name).toBe('Profile');
    expect(tree!.root.findAllByType(ProfileScreen)).toHaveLength(1);
    expect(tree!.root.findAllByType(GuestProfileScreen)).toHaveLength(0);
  },
);
test('Phase 3 direct Post and private Profile routes hide content from guest and after expiry', async () => {
  await openPhase2GuestHome();
  await Renderer.act(async () => {
    navigationRef.navigate('AppDrawer', {
      screen: 'MainTabs',
      params: { screen: 'PostListingStack', params: { screen: 'SendParcel' } },
    });
  });
  await settle();
  expect(
    tree!.root.findAll(node => node.props.children === 'Account access').length,
  ).toBeGreaterThan(0);
  await press('Sign In');
  expect(useAuthFlowStore.getState().flow?.action).toEqual({
    type: 'POST_LISTING',
    params: { listingType: 'send' },
  });
  await authenticatePhase3();
  expect(navigationRef.getCurrentRoute()?.name).toBe('SendParcel');
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
  });
  await settle();
  await settle();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  expect(navigationRef.canGoBack()).toBe(false);
  await Renderer.act(async () => {
    navigationRef.navigate('AppDrawer', {
      screen: 'MainTabs',
      params: { screen: 'ProfileStack', params: { screen: 'EditProfile' } },
    });
  });
  await settle();
  expect(
    tree!.root.findAll(node => node.props.children === 'Account access').length,
  ).toBeGreaterThan(0);
  await press('Sign In');
  expect(useAuthFlowStore.getState().flow?.action).toEqual({
    type: 'OPEN_ACCOUNT',
    params: { destination: 'EditProfile' },
  });
});

test.each([
  'ProfileDashboard',
  'EditProfile',
  'MyListings',
  'MyReviews',
  'ChangePassword',
] as const)(
  'Phase 3 direct %s route gates account content and restores exact destination',
  async destination => {
    await openPhase2GuestHome();
    await Renderer.act(async () => {
      navigationRef.navigate(
        'AppDrawer',
        destination === 'ProfileDashboard' || destination === 'EditProfile'
          ? {
              screen: 'MainTabs',
              params: {
                screen: 'ProfileStack',
                params: { screen: destination },
              },
            }
          : { screen: destination },
      );
    });
    await settle();
    expect(
      tree!.root.findAll(node => node.props.children === 'Account access')
        .length,
    ).toBeGreaterThan(0);
    await press('Sign In');
    expect(useAuthFlowStore.getState().flow?.action).toEqual({
      type: 'OPEN_ACCOUNT',
      params: { destination },
    });
    await authenticatePhase3();
    expect(navigationRef.getCurrentRoute()?.name).toBe(destination);
  },
);
test('Phase 3 authenticated Messages and Post open directly; account switch clears private history', async () => {
  await openPhase2GuestHome();
  await authenticatePhase3();
  await press('Messages');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Conversations');
  await Renderer.act(async () => {
    navigationRef.navigate('AppDrawer', {
      screen: 'MainTabs',
      params: { screen: 'HomeStack', params: { screen: 'Home' } },
    });
  });
  await settle();
  await press('Post');
  expect(navigationRef.getCurrentRoute()?.name).toBe('PostListing');
  await Renderer.act(async () => {
    queryClient.setQueryData(['old-account-secret'], { private: true });
    useListingDraft
      .getState()
      .update({ ...useListingDraft.getState().values, weight: '33' });
    useAuthStore
      .getState()
      .setUser({ id: 56, name: 'Other member', email: 'other@example.test' });
  });
  await settle();
  await settle();
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  expect(navigationRef.canGoBack()).toBe(false);
  expect(useAuthFlowStore.getState().flow).toBeNull();
  expect(queryClient.getQueryData(['old-account-secret'])).toBeUndefined();
  expect(useListingDraft.getState().values.weight).toBe('');
  expect(routeNames()).toEqual(['AppDrawer']);
});

test('Phase 3 guest Profile tab recovers from a stale private nested destination', async () => {
  await openPhase2GuestHome();
  await Renderer.act(async () => {
    navigationRef.navigate('AppDrawer', {
      screen: 'MainTabs',
      params: { screen: 'ProfileStack', params: { screen: 'EditProfile' } },
    });
  });
  await settle();
  await press('Browse Home');
  await press('Profile');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Profile');
  expect(tree!.root.findAllByType(GuestProfileScreen)).toHaveLength(1);
  expect(useAuthFlowStore.getState().flow).toBeNull();
});

test('Phase 4 public Details request returns through Register/Login to the same listing for explicit review', async () => {
  const get = jest
    .spyOn(detailsService, 'getListingDetails')
    .mockResolvedValue({
      id: 42,
      ownerId: 7,
      status: 'active',
      type: 'carry',
      title: 'Public route',
      origin: 'Karachi',
      destination: 'Dubai',
      departureDate: '2099-11-12',
      category: 'Documents',
      price: 120,
      currency: 'USD',
      requestStatus: 'accepted',
      contact: { phone: '+923001234567', callPermitted: true },
    });
  try {
    await openPhase2GuestHome();
    await Renderer.act(async () => {
      navigationRef.navigate('AppDrawer', {
        screen: 'MainTabs',
        params: {
          screen: 'HomeStack',
          params: { screen: 'ListingDetails', params: { listingId: '42' } },
        },
      });
    });
    await settle();
    const detailKey = navigationRef.getCurrentRoute()?.key;
    expect(
      tree!.root.findAll(
        node =>
          typeof node.props.children === 'string' &&
          node.props.children.includes('+923001234567'),
      ),
    ).toHaveLength(0);
    await press('Request Now');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
    await press('Register');
    await press('Back to Sign In');
    expect(useAuthFlowStore.getState().flow?.action).toEqual({
      type: 'REQUEST_LISTING',
      params: { listingId: '42' },
    });
    await press('Cancel sign in');
    expect(navigationRef.getCurrentRoute()?.key).toBe(detailKey);
    await press('Sign In to Request');
    await authenticatePhase3();
    await settle();
    expect(navigationRef.getCurrentRoute()?.name).toBe('ListingDetails');
    expect(navigationRef.getCurrentRoute()?.key).toBe(detailKey);
    expect(routeNames()).toEqual(['AppDrawer']);
    expect(tree!.root.findByType(RequestConfirmationDialog).props.visible).toBe(
      true,
    );
    expect(
      tree!.root.findAll(
        node =>
          typeof node.props.children === 'string' &&
          node.props.children.includes('+923001234567'),
      ),
    ).toHaveLength(0);
    expect(
      tree!.root.findAll(
        node =>
          node.props.accessibilityLabel === 'Send Request' &&
          node.props.disabled === true,
      ).length,
    ).toBeGreaterThan(0);
    await press('Cancel request');
    await back();
    expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  } finally {
    get.mockRestore();
  }
});

test('static marketplace browsing stays public while request, Post and Messages still require login', async () => {
  const originalUi = appConfig.uiPreviewEnabled;
  appConfig.uiPreviewEnabled = false;
  useDevelopmentStore.setState({ previewActive: false });
  try {
    await openPhase2GuestHome();
    expect(useAuthStore.getState().status).toBe('guest');
    await press('Browse category Documents');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Results');
    expect(useSearchStore.getState().filters.category).toBe('Documents');
    await back();
    await press('Search listings in UAE');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Results');
    expect(useSearchStore.getState().filters.destinationCountry?.code).toBe(
      'AE',
    );
    await back();
    await press('Open listing Traveller to Dubai');
    expect(navigationRef.getCurrentRoute()?.name).toBe('ListingDetails');
    expect(navigationRef.getCurrentRoute()?.params).toMatchObject({
      listingId: '900001',
    });
    expect(useAuthStore.getState().status).toBe('guest');
    await press('Request Now');
    expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
    expect(useAuthFlowStore.getState().flow?.action).toEqual({
      type: 'REQUEST_LISTING',
      params: { listingId: '900001' },
    });
    await press('Cancel sign in');
    expect(navigationRef.getCurrentRoute()?.name).toBe('ListingDetails');
    await back();
    for (const label of ['Post', 'Messages']) {
      await press(label);
      expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
      await press('Cancel sign in');
      expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
    }
  } finally {
    appConfig.uiPreviewEnabled = originalUi;
  }
});

test('public Listings filters are isolated from intentional Home search and radius preferences', async () => {
  await openPhase2GuestHome();
  useSearchStore
    .getState()
    .setFilters({ query: 'London', category: 'Documents' });
  useLocationStore.getState().setLocation({
    source: 'manual',
    latitude: 51.5,
    longitude: -0.1,
    radiusKm: 1,
  });
  const homeFilters = useSearchStore.getState().filters;
  const homeLocation = useLocationStore.getState().selection;
  await press('Listings');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Listings');
  expect(useBrowseFiltersStore.getState().filters).toEqual({});
  await press('Filter listings');
  expect(useSearchStore.getState().filters).toEqual({});
  expect(useLocationStore.getState().selection).toEqual({ mode: 'worldwide' });
  await press('Verified Users Only');
  await press('Apply Filters');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Listings');
  expect(useBrowseFiltersStore.getState().filters.verifiedOnly).toBe(true);
  expect(useSearchStore.getState().filters).toBe(homeFilters);
  expect(useLocationStore.getState().selection).toBe(homeLocation);
  await press('Go back');
  expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  expect(useSearchStore.getState().filters.query).toBe('London');
  expect(useAuthStore.getState().status).toBe('guest');
});

test.each([
  ['Post', 'PostListing'],
  ['Send Parcel', 'SendParcel'],
  ['Carry Parcel', 'CarryParcel'],
  ['Messages', 'Conversations'],
] as const)('STATIC_TESTING demo Login resumes %s without a server session', async (entry, destination) => {
  const previousStatic = appConfig.staticTestingBuild;
  const previousUi = appConfig.uiPreviewEnabled;
  try {
    appConfig.staticTestingBuild = true;
    appConfig.uiPreviewEnabled = true;
    await openPhase2GuestHome();
    await press(entry);
    expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
    await press('Sign In');
    await settle();
    expect(navigationRef.getCurrentRoute()?.name).toBe(destination);
    expect(useAuthStore.getState().status).toBe('guest');
    expect(useDevelopmentStore.getState().previewActive).toBe(true);
    expect(useAuthFlowStore.getState().flow).toBeNull();
  } finally {
    appConfig.staticTestingBuild = previousStatic;
    appConfig.uiPreviewEnabled = previousUi;
  }
}, 30000);

test('every cold launch shows Splash before returning guest Home without repeating onboarding', async () => {
  const { SplashScreen } = require('../src/features/onboarding/screens/SplashScreen');
  await AsyncStorage.setItem('friendie.preferences', JSON.stringify({ state: { onboardingComplete: true }, version: 0 }));
  for (let launch = 0; launch < 2; launch++) {
    await Renderer.act(async () => { tree = Renderer.create(<App />); });
    expect(tree!.root.findAllByType(SplashScreen)).toHaveLength(1);
    await Renderer.act(async () => { jest.advanceTimersByTime(999); });
    expect(tree!.root.findAllByType(SplashScreen)).toHaveLength(1);
    await Renderer.act(async () => { jest.advanceTimersByTime(1); });
    await settle();
    expect(tree!.root.findAllByType(SplashScreen)).toHaveLength(0);
    expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
    await Renderer.act(async () => { tree!.unmount(); tree = undefined; });
  }
}, 30000);
