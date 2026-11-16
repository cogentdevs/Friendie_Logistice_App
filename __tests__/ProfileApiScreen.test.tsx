import React from 'react';
import { Image, Text } from 'react-native';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Keychain from 'react-native-keychain';
import { ProfileScreen } from '../src/features/profile/screens/ProfileScreen';
import { useProfile } from '../src/features/profile/hooks/useProfile';
import { logoutSession } from '../src/features/auth/services/sessionLogout';
import { apiClient } from '../src/services/api/apiClient';
import { appConfig } from '../src/constants/appConfig';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
const member = { id: 8, name: 'Login Member', email: 'member@example.test' };
const raw = {
  ...member,
  name: 'Backend Member',
  phone: null,
  country_id: null,
  country: null,
  image_url: 'https://example.test/avatar.jpg',
  is_verified: true,
  email_verified_at: null,
};
const originalAdapter = apiClient.defaults.adapter,
  previousFlag = appConfig.profileApiVerified,
  previousPreview = appConfig.uiPreviewEnabled;
let client: QueryClient,
  tree: ReactTestRenderer,
  count: number,
  record: { username: string; password: string } | false;
function Probe() {
  const { query } = useProfile();
  return <Text>{query.data?.name ?? 'No profile'}</Text>;
}
function content(probe = false) {
  return (
    <QueryClientProvider client={client}>
      {probe ? (
        <Probe />
      ) : (
        <ProfileScreen
          navigation={
            { navigate: jest.fn() } as unknown as React.ComponentProps<
              typeof ProfileScreen
            >['navigation']
          }
          route={{ key: 'profile-api', name: 'Profile' }}
        />
      )}
    </QueryClientProvider>
  );
}
async function settle() {
  await Renderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 30));
  });
}
async function mount(probe = false) {
  await Renderer.act(async () => {
    tree = Renderer.create(content(probe));
  });
  await settle();
}
function textPresent(value: string) {
  return tree.root.findAll(node => node.props.children === value).length > 0;
}
function respond() {
  apiClient.defaults.adapter = async config => {
    count++;
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data: { success: true, data: raw },
    };
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  count = 0;
  appConfig.profileApiVerified = true;
  useAuthStore.getState().setUser(member);
  useDevelopmentStore.setState({ previewActive: false });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  record = {
    username: JSON.stringify(member),
    password: 'screen-contract-token',
  };
  jest
    .spyOn(Keychain, 'getGenericPassword')
    .mockImplementation(async () => record as never);
  jest.spyOn(Keychain, 'resetGenericPassword').mockImplementation(async () => {
    record = false;
    return true;
  });
  respond();
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client.clear();
  });
  apiClient.defaults.adapter = originalAdapter;
  appConfig.profileApiVerified = previousFlag;
  appConfig.uiPreviewEnabled = previousPreview;
  jest.restoreAllMocks();
});
test('real service data reaches existing name/avatar/verification UI without fabricated statistics or fetch loops', async () => {
  await mount();
  expect(textPresent('Backend Member')).toBe(true);
  expect(textPresent('Verified Member')).toBe(true);
  expect(tree.root.findByType(Image).props.source.uri).toBe(raw.image_url);
  expect(textPresent('0.0')).toBe(false);
  expect(textPresent('\u2014')).toBe(true);
  expect(count).toBe(1);
  await Renderer.act(async () => {
    tree.update(content());
  });
  await settle();
  expect(count).toBe(1);
  expect(client.getQueryData(['profile', 8])).toMatchObject({
    name: 'Backend Member',
    verified: true,
  });
});
test('loading uses existing indicator until backend response resolves', async () => {
  let finish!: () => void;
  apiClient.defaults.adapter = config =>
    new Promise(resolve => {
      finish = () =>
        resolve({
          status: 200,
          statusText: '',
          headers: {},
          config,
          data: { success: true, data: raw },
        });
    });
  await mount();
  expect(
    tree.root.findAll(
      node => node.props.accessibilityLabel === 'Loading profile',
    ).length,
  ).toBeGreaterThan(0);
  expect(textPresent('Backend Member')).toBe(false);
  await Renderer.act(async () => {
    finish();
  });
  await settle();
  expect(textPresent('Backend Member')).toBe(true);
});
test('failed refresh keeps valid cached identity visible and existing Retry refetches', async () => {
  await mount();
  apiClient.defaults.adapter = async () => {
    throw new Error('offline');
  };
  await Renderer.act(async () => {
    await client.refetchQueries({ queryKey: ['profile', 8] });
  });
  await settle();
  expect(textPresent('Backend Member')).toBe(true);
  expect(
    textPresent('Profile details could not be loaded. Please try again.'),
  ).toBe(true);
  expect(useAuthStore.getState().status).toBe('authenticated');
  respond();
  await Renderer.act(async () => {
    tree.root
      .findAll(
        node =>
          node.props.accessibilityLabel === 'Retry profile' &&
          node.props.onPress,
      )[0]
      .props.onPress();
  });
  await settle();
  expect(textPresent('Backend Member')).toBe(true);
});
test('guest hook is disabled while demo stays in separate local cache without any API call', async () => {
  useAuthStore.getState().clear();
  await mount(true);
  expect(count).toBe(0);
  expect(textPresent('No profile')).toBe(true);
  appConfig.uiPreviewEnabled = true;
  await Renderer.act(async () => {
    useDevelopmentStore.setState({ previewActive: true });
  });
  await settle();
  expect(count).toBe(0);
  expect(textPresent('Demo Traveller')).toBe(true);
  expect(client.getQueryData(['profile', 'demo'])).toBeDefined();
  expect(client.getQueryData(['profile', 8])).toBeUndefined();
});
test('account replacement never displays previous owner cached profile', async () => {
  await mount();
  const other = { id: 9, name: 'Other Login', email: 'other@example.test' };
  apiClient.defaults.adapter = async config => ({
    status: 200,
    statusText: '',
    headers: {},
    config,
    data: { success: true, data: { ...raw, ...other, name: 'Other Backend' } },
  });
  record = { username: JSON.stringify(other), password: 'other-token' };
  await Renderer.act(async () => {
    useAuthStore.getState().setUser(other);
  });
  await settle();
  expect(textPresent('Backend Member')).toBe(false);
  expect(textPresent('Other Backend')).toBe(true);
  expect(client.getQueryData(['profile', 9])).toMatchObject({ id: 9 });
});
test('successful existing Logout clears private profile cache and exposes no stale data to guest', async () => {
  await mount(true);
  expect(textPresent('Backend Member')).toBe(true);
  apiClient.defaults.adapter = async config => ({
    status: 200,
    statusText: '',
    headers: {},
    config,
    data: { success: true, message: 'Logout successful.', data: {} },
  });
  await Renderer.act(async () => {
    await logoutSession(client);
  });
  await settle();
  expect(client.getQueryData(['profile', 8])).toBeUndefined();
  expect(textPresent('Backend Member')).toBe(false);
  expect(textPresent('No profile')).toBe(true);
  expect(record).toBe(false);
  expect(useAuthStore.getState().status).toBe('guest');
});
