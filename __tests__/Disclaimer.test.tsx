import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { Linking, ScrollView } from 'react-native';
import { DisclaimerScreen } from '../src/features/legal/screens/DisclaimerScreen';
import * as service from '../src/features/legal/services/disclaimerService';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
let tree: ReactTestRenderer;
const navigation = { goBack: jest.fn(), navigate: jest.fn() };
async function mount() {
  await Renderer.act(async () => {
    tree = Renderer.create(
      <DisclaimerScreen
        route={{ name: 'Disclaimer', key: 'privacy' }}
        navigation={
          navigation as unknown as React.ComponentProps<
            typeof DisclaimerScreen
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
test('unapproved disclaimer shows editorial placeholders, information banner and all footer actions', async () => {
  await mount();
  expect(has('Draft / Development Preview')).toBe(true);
  expect(has('Last Updated: unavailable - approved document pending')).toBe(
    true,
  );
  expect(tree.root.findAllByType(ScrollView).length).toBeGreaterThan(0);
  expect(service.loadDisclaimer().sections).toHaveLength(10);
  expect(has('Pending approved content.')).toBe(true);
  await press('Back from Disclaimer');
  expect(navigation.goBack).toHaveBeenCalled();
  for (const [label, route] of [
    ['Terms & Conditions', 'TermsConditions'],
    ['Privacy Policy', 'PrivacyPolicy'],
    ['Contact Us', 'ContactSupport'],
  ]) {
    await press(label);
    expect(navigation.navigate).toHaveBeenLastCalledWith(route);
  }
  expect(has('Important Information')).toBe(true);
});
test('approved version/date/copy render with real reference links and errors', async () => {
  jest.spyOn(service, 'loadDisclaimer').mockReturnValue({
    status: 'approved',
    version: 'test-1',
    lastUpdated: '2026-10-01',
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
  const original = service.loadDisclaimer();
  jest
    .spyOn(service, 'loadDisclaimer')
    .mockImplementationOnce(() => {
      throw Error('invalid');
    })
    .mockReturnValue(original);
  await mount();
  expect(has('Disclaimer content is unavailable.')).toBe(true);
  await press('Retry Disclaimer');
  expect(has('Draft / Development Preview')).toBe(true);
});
test('approved document requires valid date and final nonempty copy; unsafe links rejected', () => {
  const doc = {
    status: 'approved',
    version: 'test',
    lastUpdated: '2026-10-01',
    sections: [{ id: 'a', title: 'Title', paragraphs: ['Test fixture.'] }],
  };
  expect(service.disclaimerSchema.safeParse(doc).success).toBe(true);
  for (const change of [
    { lastUpdated: 'invalid' },
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
      service.disclaimerSchema.safeParse({ ...doc, ...change }).success,
    ).toBe(false);
});
