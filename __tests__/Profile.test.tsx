import { ProfileMenuRow } from '../src/features/profile/components/ProfileMenuRow';
import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { Image } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfileScreen } from '../src/features/profile/screens/ProfileScreen';
import * as profileService from '../src/features/profile/services/profileService';
import * as logoutService from '../src/features/auth/services/sessionLogout';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { appConfig } from '../src/constants/appConfig';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
const person = { id: 8, name: 'Real Member', email: 'member@example.test' };
let tree: ReactTestRenderer, client: QueryClient;
const nav = { navigate: jest.fn() };
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
        <ProfileScreen
          route={{ key: 'profile', name: 'Profile' }}
          navigation={
            nav as unknown as React.ComponentProps<
              typeof ProfileScreen
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
    await tree.root
      .findAll(
        node =>
          node.props.accessibilityLabel === label &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
  });
  await settle();
}
beforeEach(() => {
  jest.clearAllMocks();
  useDevelopmentStore.setState({
    previewActive: false,
    authEntryRequested: false,
  });
  useAuthStore.getState().setUser(person);
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client?.clear();
  });
  jest.restoreAllMocks();
});
test('verified backend identity and zero statistics display without reference defaults', async () => {
  jest.spyOn(profileService, 'getProfile').mockResolvedValue({
    ...person,
    verified: true,
    statistics: { listings: 0, reviews: 0, rating: 0 },
  });
  await mount();
  expect(
    tree.root.findAll(node => node.props.children === 'Verified Member').length,
  ).toBeGreaterThan(0);
  expect(
    tree.root.findAll(node => node.props.children === '0.0').length,
  ).toBeGreaterThan(0);
  expect(tree.root.findAll(node => node.props.children === 24)).toHaveLength(0);
  expect(
    tree.root.findAllByType(ProfileMenuRow).map(row => row.props.label),
  ).toEqual([
    'Dashboard',
    'Edit Profile',
    'My Listing',
    'Messages',
    'Reviews',
    'Change Password',
    'Logout',
  ]);
  for (const label of [
    'Saved Listings',
    'Payment Methods',
    'Notifications',
    'Help & Support',
  ])
    expect(
      tree.root
        .findAllByType(ProfileMenuRow)
        .some(row => row.props.label === label),
    ).toBe(false);
  await press('Dashboard');
  expect(nav.navigate).toHaveBeenCalledWith('ProfileDashboard');
  await press('Edit Profile');
  expect(nav.navigate).toHaveBeenCalledWith('EditProfile');
  await press('My Listing');
  expect(nav.navigate).toHaveBeenCalledWith('MyListings');
  await press('Messages');
  expect(nav.navigate).toHaveBeenCalledWith('MainTabs', {
    screen: 'MessagesStack',
    params: { screen: 'Conversations' },
  });
  await press('Reviews');
  expect(nav.navigate).toHaveBeenCalledWith('MyReviews', {
    initialTab: 'visitors',
    returnTo: 'Profile',
  });
  await press('Change Password');
  expect(nav.navigate).toHaveBeenCalledWith('ChangePassword', {
    returnTo: 'Profile',
  });
  await press('Profile Settings');
  expect(nav.navigate).toHaveBeenCalledWith('Settings');
});
test('missing stats/verification are safe and failed avatar falls back', async () => {
  jest.spyOn(profileService, 'getProfile').mockResolvedValue({
    ...person,
    avatarUrl: 'https://example.test/avatar.jpg',
  });
  await mount();
  expect(
    tree.root.findAll(
      node => node.props.accessibilityLabel === 'Verified profile',
    ),
  ).toHaveLength(0);
  expect(
    tree.root.findAll(node => node.props.children === '\u2014').length,
  ).toBeGreaterThan(0);
  await Renderer.act(async () => tree.root.findByType(Image).props.onError());
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
});
test('profile error has a working retry', async () => {
  const get = jest
    .spyOn(profileService, 'getProfile')
    .mockRejectedValueOnce(Error('offline'))
    .mockResolvedValue(person);
  await mount();
  await press('Retry profile');
  expect(get).toHaveBeenCalledTimes(2);
});
test('Logout confirms, cancellation does nothing, failure remains visible and duplicate confirmation is guarded', async () => {
  jest.spyOn(profileService, 'getProfile').mockResolvedValue(person);
  const logout = jest
    .spyOn(logoutService, 'logoutSession')
    .mockRejectedValue(Error('Keychain locked'));
  await mount();
  await press('Logout');
  expect(logout).not.toHaveBeenCalled();
  await press('Cancel logout');
  await press('Logout');
  await press('Confirm logout');
  await settle();
  expect(logout).toHaveBeenCalledTimes(1);
  expect(
    tree.root.findAll(
      node =>
        node.props.children ===
        'Could not clear your secure session. Please try Logout again.',
    ).length,
  ).toBeGreaterThan(0);
});
test('UI preview keeps Edit Profile accessible', async () => {
  const previous = appConfig.uiPreviewEnabled;
  appConfig.uiPreviewEnabled = true;
  useDevelopmentStore.setState({ previewActive: true });
  useAuthStore.getState().clear();
  jest.spyOn(profileService, 'getProfile').mockResolvedValue({
    ...person,
    statistics: { listings: 24, reviews: 128, rating: 4.9 },
  });
  try {
    await mount();
    await press('Edit Profile');
    expect(nav.navigate).toHaveBeenCalledWith('EditProfile');
  } finally {
    appConfig.uiPreviewEnabled = previous;
  }
});
