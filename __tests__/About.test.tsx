import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { Linking, NativeModules } from 'react-native';
import { AboutScreen } from '../src/features/about/screens/AboutScreen';
import { BrandLogo } from '../src/components/common/BrandLogo';
import { appConfig } from '../src/constants/appConfig';
import { getNativeAppVersion } from '../src/features/about/services/appMetadata';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
let tree: ReactTestRenderer;
const nav = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true };
const legal = { privacy: appConfig.privacyUrl, terms: appConfig.termsUrl };
const originalMetadata = NativeModules.FriendieAppMetadata;
async function mount() {
  await Renderer.act(async () => {
    tree = Renderer.create(
      <AboutScreen
        route={{ name: 'About', key: 'about' }}
        navigation={
          nav as unknown as React.ComponentProps<
            typeof AboutScreen
          >['navigation']
        }
      />,
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
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  await Renderer.act(async () => tree?.unmount());
  jest.restoreAllMocks();
  appConfig.privacyUrl = legal.privacy;
  appConfig.termsUrl = legal.terms;
  NativeModules.FriendieAppMetadata = originalMetadata;
});
test('draft copy, four steps and logo1; version comes from installed native metadata', async () => {
  NativeModules.FriendieAppMetadata = { version: '3.2.1' };
  await mount();
  expect(tree.root.findByType(BrandLogo).props.variant).toBe('color');
  for (const label of [
    'Connecting People Across Borders',
    'Our Mission',
    'How It Works',
    'Create a Listing',
    'Find a Traveller or Sender',
    'Connect & Agree',
    'Complete the Arrangement',
    'Why Friendie Logistics?',
    'App version 3.2.1',
  ])
    expect(
      tree.root.findAll(n => n.props.children === label).length,
    ).toBeGreaterThan(0);
  expect(
    tree.root.findAll(n => n.props.children === 'User Verification'),
  ).toHaveLength(0);
  await press('Back from About Us');
  expect(nav.goBack).toHaveBeenCalled();
  await press('Contact Us');
  expect(nav.navigate).toHaveBeenCalledWith('ContactUs');
});
test('both legal links navigate to existing native root routes', async () => {
  const open = jest.spyOn(Linking, 'openURL');
  await mount();
  await press('Privacy Policy');
  expect(nav.navigate).toHaveBeenCalledWith('PrivacyPolicy');
  await press('Terms & Conditions');
  expect(nav.navigate).toHaveBeenCalledWith('TermsConditions');
  expect(open).not.toHaveBeenCalled();
});
test('unknown native version never falls back to package version', async () => {
  NativeModules.FriendieAppMetadata = undefined;
  expect(getNativeAppVersion()).toBeNull();
  await mount();
  expect(
    tree.root.findAll(n => n.props.children === 'App version unavailable')
      .length,
  ).toBeGreaterThan(0);
});
