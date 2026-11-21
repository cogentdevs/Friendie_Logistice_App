import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import {
  Dimensions,
  Image,
  Linking,
  NativeModules,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { AboutScreen } from '../src/features/about/screens/AboutScreen';
import { BrandLogo } from '../src/components/common/BrandLogo';
import { appConfig } from '../src/constants/appConfig';
import { getNativeAppVersion } from '../src/features/about/services/appMetadata';
import { AppText } from '../src/components/ui/AppText';
import { aboutContent } from '../src/features/about/content/aboutContent';
import {
  aboutAssets,
  aboutLocations,
} from '../src/features/about/content/aboutAssets';
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
test('original website sections, three steps and branding; native version and navigation are preserved', async () => {
  NativeModules.FriendieAppMetadata = { version: '3.2.1' };
  await mount();
  expect(tree.root.findByType(BrandLogo).props.variant).toBe('color');
  for (const label of [
    'About Friendie Logistics',
    'What We Do',
    'Our Vision',
    'Our Values',
    'Get Involved',
    'Create Account',
    'Post An Ad',
    'Find, Carry Or Send',
    'App version 3.2.1',
  ])
    expect(
      tree.root.findAll(n => n.props.children === label).length,
    ).toBeGreaterThan(0);
  expect(
    tree.root.findAll(n => n.props.children === 'User Verification'),
  ).toHaveLength(0);
  expect(
    tree.root.findAll(n => n.props.children === 'Our Mission'),
  ).toHaveLength(0);
  await press('Back from About Us');
  expect(nav.goBack).toHaveBeenCalled();
  await press('Contact Us');
  expect(nav.navigate).toHaveBeenCalledWith('ContactUs');
});

test('all complete original paragraphs and values are rendered without draft/demo copy', async () => {
  await mount();
  const text = tree.root
    .findAllByType(AppText)
    .map(node => node.props.children);
  for (const paragraph of [
    aboutContent.introduction,
    aboutContent.whatWeDo,
    aboutContent.vision,
    aboutContent.closing,
    aboutContent.getInvolved,
  ])
    expect(text).toContain(paragraph);
  expect(aboutContent.introduction).toBe(
    'At Friendie Logistics, we believe in the power of connection and the spirit of sharing. Our platform is designed to bring people together, transforming travel into an opportunity for collaboration and support. Our mission is to create a seamless experience for travelers and senders, making parcel delivery simple, cost-effective, and enjoyable.',
  );
  for (const [label, description] of [
    [
      'Trust',
      'We prioritize safety and trust among our users by implementing robust verification processes.',
    ],
    [
      'Community',
      'We encourage a friendly, collaborative environment where everyone can contribute and benefit.',
    ],
    [
      'Affordability',
      'Our service provides cost-effective solutions for travelers and senders, ensuring everyone gains from the experience.',
    ],
    [
      'Simplicity',
      'User experience is at the forefront of our design, making our platform easy to navigate and use.',
    ],
  ]) {
    expect(text).toContain(label);
    expect(text).toContain(description);
  }
  expect(
    text.some(
      item =>
        typeof item === 'string' &&
        /draft|pending approval|Connecting People Across Borders/i.test(item),
    ),
  ).toBe(false);
});

test('section order and all seven exact informational location labels are preserved', async () => {
  await mount();
  expect(
    tree.root
      .findAllByType(AppText)
      .filter(node => node.props.accessibilityRole === 'header')
      .map(node => node.props.children),
  ).toEqual([
    'About Us',
    'About Friendie Logistics',
    'What We Do',
    'Our Vision',
    'Our Values',
    'Get Involved',
    'Locations',
    'Client Testimonials',
  ]);
  const text = tree.root
    .findAllByType(AppText)
    .map(node => node.props.children);
  for (const label of [
    '01',
    '02',
    '03',
    'Saudia Arabia',
    'UAE',
    'Oman',
    'Philippine',
    'Behrain',
    'Pakistan',
    'India',
  ])
    expect(text).toContain(label);
  expect(aboutLocations).toHaveLength(7);
  expect(
    tree.root.findAll(node =>
      /Ads Posted|popular listings/i.test(String(node.props.children)),
    ),
  ).toHaveLength(0);
});

test('four supplied testimonials use complete comments, roles and website portrait mapping without fake ratings', async () => {
  await mount();
  const text = tree.root
    .findAllByType(AppText)
    .map(node => node.props.children);
  expect(aboutContent.testimonials.map(item => [item.name, item.role])).toEqual(
    [
      ['Alex P.', 'Frequent Traveler'],
      ['Sarah K.', 'Travel Enthusiast'],
      ['Emma R.', 'Small Business Owner'],
      ['Maya L.', 'Satisfied Sender'],
    ],
  );
  for (const [index, item] of aboutContent.testimonials.entries()) {
    expect(text).toContain(item.name);
    expect(text).toContain(item.role);
    expect(text).toContain(item.text);
    expect(
      tree.root
        .findAllByType(Image)
        .find(
          image =>
            image.props.accessibilityLabel ===
            item.name + ' website testimonial portrait',
        )!.props.source,
    ).toBe(index === 0 ? aboutAssets.alex : aboutAssets.otherTestimonial);
  }
});

test('every content image is a bundled asset with containment instead of remote placeholders', async () => {
  await mount();
  const allowed = [
    aboutAssets.introduction,
    aboutAssets.quote,
    aboutAssets.alex,
    aboutAssets.otherTestimonial,
    ...aboutLocations.map(item => item.image),
  ];
  const contentImages = tree.root
    .findAllByType(Image)
    .filter(image => image.props.accessibilityLabel !== 'Friendie Logistics');
  expect(contentImages).toHaveLength(16);
  for (const image of contentImages) {
    expect(image.props.resizeMode).toBe('contain');
    expect(allowed).toContain(image.props.source);
    expect(image.props.source).not.toHaveProperty('uri');
  }
  const illustration = contentImages.find(
    image => image.props.source === aboutAssets.introduction,
  )!;
  const illustrationStyle = StyleSheet.flatten(illustration.props.style);
  expect(illustrationStyle).toMatchObject({
    width: '100%',
    aspectRatio: 640 / 426,
  });
  // Clear Image's intrinsic asset height so aspectRatio controls responsive sizing.
  expect(
    Object.prototype.hasOwnProperty.call(illustrationStyle, 'height'),
  ).toBe(true);
  expect(illustrationStyle.height).toBeUndefined();
  expect(
    StyleSheet.flatten(
      tree.root.findByType(ScrollView).props.contentContainerStyle,
    ),
  ).toMatchObject({ maxWidth: 720, paddingBottom: 32 });
});

test('small screens and large text use full-width cards with no fixed text heights', async () => {
  jest
    .spyOn(Dimensions, 'get')
    .mockReturnValue({ width: 320, height: 640, scale: 2, fontScale: 1.5 });
  await mount();
  const location = tree.root
    .findAllByType(Image)
    .find(
      image =>
        image.props.accessibilityLabel === 'Pakistan location photograph',
    )!;
  expect(StyleSheet.flatten(location.parent!.props.style)).toMatchObject({
    width: '100%',
  });
  expect(
    tree.root
      .findAllByType(AppText)
      .some(node => node.props.numberOfLines !== undefined),
  ).toBe(false);
});

test('tablet width uses a bounded two-column location grid', async () => {
  jest
    .spyOn(Dimensions, 'get')
    .mockReturnValue({ width: 800, height: 1000, scale: 2, fontScale: 1 });
  await mount();
  const location = tree.root
    .findAllByType(Image)
    .find(
      image => image.props.accessibilityLabel === 'India location photograph',
    )!;
  expect(StyleSheet.flatten(location.parent!.props.style)).toMatchObject({
    width: '47%',
  });
  expect(
    StyleSheet.flatten(
      tree.root.findByType(ScrollView).props.contentContainerStyle,
    ).maxWidth,
  ).toBe(720);
});

test('Back without history uses the existing Home route, without auth or marketplace mutations', async () => {
  jest.spyOn(nav, 'canGoBack').mockReturnValue(false);
  await mount();
  await press('Back from About Us');
  expect(nav.navigate).toHaveBeenCalledWith('MainTabs', {
    screen: 'HomeStack',
    params: { screen: 'Home' },
  });
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
