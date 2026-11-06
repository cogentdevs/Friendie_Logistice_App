import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { Linking, ScrollView, View } from 'react-native';
import { TermsConditionsScreen } from '../src/features/legal/screens/TermsConditionsScreen';
import * as service from '../src/features/legal/services/termsConditionsService';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
let tree: ReactTestRenderer;
const navigation = { goBack: jest.fn(), navigate: jest.fn() };
async function mount() {
  await Renderer.act(async () => {
    tree = Renderer.create(
      <TermsConditionsScreen
        route={{ name: 'TermsConditions', key: 'terms' }}
        navigation={
          navigation as unknown as React.ComponentProps<
            typeof TermsConditionsScreen
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
const has = (text: string) =>
  tree.root.findAll(n => n.props.children === text).length > 0;
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  await Renderer.act(async () => tree?.unmount());
  jest.restoreAllMocks();
});
test('unapproved terms clearly label draft and unavailable date without binding provisions', async () => {
  await mount();
  expect(has('Draft / Development Preview')).toBe(true);
  expect(has('Last Updated: unavailable - approved document pending')).toBe(
    true,
  );
  expect(tree.root.findAllByType(ScrollView).length).toBeGreaterThan(0);
  expect(service.loadTermsConditions().sections).toHaveLength(15);
  expect(has('Pending approved content.')).toBe(true);
  await press('Back from Terms & Conditions');
  expect(navigation.goBack).toHaveBeenCalled();
  await press('Privacy Policy');
  expect(navigation.navigate).toHaveBeenCalledWith('PrivacyPolicy');
});
test('approved version/date/copy render with real reference links and errors', async () => {
  jest.spyOn(service, 'loadTermsConditions').mockReturnValue({
    status: 'approved',
    version: 'test-1',
    lastUpdated: '2026-10-01',
    effectiveDate: '2026-10-02',
    sections: [
      {
        id: 'test',
        title: 'Test approved heading',
        paragraphs: ['Approved fixture content.'],
        links: [
          {
            label: 'Referenced document',
            url: 'https://example.test/document',
          },
        ],
      },
    ],
  });
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await mount();
  expect(has('Last Updated: 2026-10-01')).toBe(true);
  expect(has('Effective Date: 2026-10-02')).toBe(true);
  expect(has('Approved fixture content.')).toBe(true);
  expect(has('Draft / Development Preview')).toBe(false);
  await press('Referenced document');
  expect(open).toHaveBeenCalledWith('https://example.test/document');
  open.mockRejectedValue(new Error('offline'));
  await press('Referenced document');
  expect(has('Could not open the referenced document. Please try again.')).toBe(
    true,
  );
});
test('invalid content fails closed and retry reloads without fabricated legal text', async () => {
  const original = service.loadTermsConditions();
  jest
    .spyOn(service, 'loadTermsConditions')
    .mockImplementationOnce(() => {
      throw Error('invalid');
    })
    .mockReturnValue(original);
  await mount();
  expect(has('Terms & Conditions content is unavailable.')).toBe(true);
  await press('Retry Terms & Conditions');
  expect(has('Draft / Development Preview')).toBe(true);
});
test('approved document requires valid date and final nonempty copy; unsafe links rejected', () => {
  const doc = {
    status: 'approved',
    version: 'test',
    lastUpdated: '2026-10-01',
    effectiveDate: '2026-10-02',
    sections: [{ id: 'a', title: 'Title', paragraphs: ['Test fixture.'] }],
  };
  expect(service.termsConditionsSchema.safeParse(doc).success).toBe(true);
  for (const change of [
    { lastUpdated: 'invalid' },
    { effectiveDate: undefined },
    { effectiveDate: 'invalid' },
    { sections: [{ id: 'a', title: 'Title', paragraphs: [] }] },
    {
      sections: [
        {
          id: 'a',
          title: 'Title',
          paragraphs: ['Test'],
          reviewNote: 'Not final',
        },
      ],
    },
    {
      sections: [
        {
          id: 'a',
          title: 'Title',
          paragraphs: ['Test'],
          links: [{ label: 'Unsafe', url: 'http://example.test' }],
        },
      ],
    },
  ])
    expect(
      service.termsConditionsSchema.safeParse({ ...doc, ...change }).success,
    ).toBe(false);
});

test('contents uses measured section position rather than assumed row heights', async () => {
  await mount();
  const scroll = tree.root.findByType(ScrollView).instance;
  const scrollTo = jest.spyOn(scroll, 'scrollTo').mockImplementation(() => {});
  const section = tree.root
    .findAllByType(View)
    .find(
      node =>
        typeof node.props.onLayout === 'function' &&
        node.findAll(child => child.props.children === 'Governing Law').length >
          0,
    )!;
  await Renderer.act(async () => {
    section.props.onLayout({ nativeEvent: { layout: { y: 920 } } });
  });
  await press('Go to Governing Law');
  expect(scrollTo).toHaveBeenCalledWith({ y: 908, animated: false });
});
