import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NativeModules } from 'react-native';
import { SettingsScreen } from '../src/features/settings/screens/SettingsScreen';
import * as session from '../src/features/auth/services/sessionLogout';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { useLocationStore } from '../src/features/location/store/locationStore';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
let tree: ReactTestRenderer, client: QueryClient;
const nav = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true };
const metadata = NativeModules.FriendieAppMetadata;
async function mount() {
  client = new QueryClient();
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <SettingsScreen
          route={{ name: 'Settings', key: 'settings' }}
          navigation={
            nav as unknown as React.ComponentProps<
              typeof SettingsScreen
            >['navigation']
          }
        />
      </QueryClientProvider>,
    );
  });
}
async function press(label: string) {
  await Renderer.act(async () => {
    await tree.root
      .findAll(
        n =>
          n.props.accessibilityLabel === label &&
          typeof n.props.onPress === 'function',
      )[0]
      .props.onPress();
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
  useDevelopmentStore.setState({ previewActive: false });
  useLocationStore.setState({ selection: { mode: 'worldwide' } });
  NativeModules.FriendieAppMetadata = { version: '2.1.0' };
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client?.clear();
  });
  NativeModules.FriendieAppMetadata = metadata;
  jest.restoreAllMocks();
});
test('section hierarchy and real destinations; unsupported features are transparent', async () => {
  await mount();
  for (const title of [
    'Account',
    'Preferences',
    'Privacy & Legal',
    'Information',
    'Account actions',
    'App version 2.1.0',
  ])
    expect(
      tree.root.findAll(n => n.props.children === title).length,
    ).toBeGreaterThan(0);
  const notifications = tree.root.findAll(
    n =>
      n.props.accessibilityLabel === 'Notification Preferences' &&
      n.props.accessibilityRole === 'button',
  )[0];
  expect(notifications.props.disabled).toBe(true);
  for (const label of ['Language', 'Account Verification'])
    expect(
      tree.root.findAll(n => n.props.accessibilityLabel === label),
    ).toHaveLength(0);
  for (const [label, route] of [
    ['Privacy Policy', 'PrivacyPolicy'],
    ['Terms & Conditions', 'TermsConditions'],
    ['Disclaimer', 'Disclaimer'],
    ['About Us', 'About'],
    ['Contact Us', 'ContactSupport'],
    ['Help & Support', 'HelpSupport'],
  ]) {
    await press(label);
    expect(nav.navigate).toHaveBeenLastCalledWith(route);
  }
  await press('Change Password');
  expect(nav.navigate).toHaveBeenLastCalledWith('ChangePassword', {
    returnTo: undefined,
  });
  await press('Edit Profile');
  expect(nav.navigate).toHaveBeenLastCalledWith('MainTabs', {
    screen: 'ProfileStack',
    params: { screen: 'EditProfile', initial: false },
  });
  await press('Location Preferences');
  expect(nav.navigate).toHaveBeenLastCalledWith('MainTabs', {
    screen: 'ListingsStack',
    params: { screen: 'Filters', initial: false },
  });
  await press('Back from Settings');
  expect(nav.goBack).toHaveBeenCalled();
});
test('location summary reads existing saved mode/radius without requesting GPS or exposing precise coordinates', async () => {
  useLocationStore.setState({
    selection: {
      mode: 'radius',
      filter: {
        source: 'manual',
        latitude: 24.86,
        longitude: 67.01,
        radiusKm: 37,
      },
    },
  });
  await mount();
  expect(
    tree.root.findAll(
      n =>
        typeof n.props.children === 'string' &&
        n.props.children.includes('Manual search center - 37 km'),
    ).length,
  ).toBeGreaterThan(0);
  expect(
    tree.root.findAll(
      n =>
        typeof n.props.children === 'string' &&
        n.props.children.includes('24.86'),
    ),
  ).toHaveLength(0);
});
test('logout requires confirmation and failures preserve the screen with an honest error', async () => {
  const logout = jest
    .spyOn(session, 'logoutSession')
    .mockRejectedValue(new Error('Keychain failed'));
  await mount();
  await press('Logout');
  expect(logout).not.toHaveBeenCalled();
  await press('Cancel logout');
  expect(logout).not.toHaveBeenCalled();
  await press('Logout');
  await press('Confirm logout');
  expect(logout).toHaveBeenCalledTimes(1);
  expect(
    tree.root.findAll(
      n =>
        n.props.children ===
        'Could not clear your secure session. Please try Logout again.',
    ).length,
  ).toBeGreaterThan(0);
  expect(useAuthStore.getState().status).toBe('authenticated');
});
test('pending logout blocks duplicate confirmation and cancellation', async () => {
  let resolve!: (value: { cacheCleared: boolean }) => void;
  const logout = jest.spyOn(session, 'logoutSession').mockImplementation(
    () =>
      new Promise(r => {
        resolve = r;
      }),
  );
  await mount();
  await press('Logout');
  await Renderer.act(async () => {
    tree.root
      .findAll(
        n => n.props.accessibilityLabel === 'Confirm logout' && n.props.onPress,
      )[0]
      .props.onPress();
  });
  await Renderer.act(async () => {
    tree.root
      .findAll(
        n => n.props.accessibilityLabel === 'Confirm logout' && n.props.onPress,
      )[0]
      .props.onPress();
  });
  expect(logout).toHaveBeenCalledTimes(1);
  expect(
    tree.root.findAll(
      n => n.props.accessibilityLabel === 'Cancel logout' && n.props.onPress,
    )[0].props.disabled,
  ).toBe(true);
  await Renderer.act(async () => {
    resolve({ cacheCleared: true });
  });
});
