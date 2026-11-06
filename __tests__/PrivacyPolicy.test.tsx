import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { Linking, ScrollView } from 'react-native';
import { PrivacyPolicyScreen } from '../src/features/legal/screens/PrivacyPolicyScreen';
import * as service from '../src/features/legal/services/privacyPolicyService';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
let tree: ReactTestRenderer;
const navigation = { goBack: jest.fn() };
async function mount() {
  await Renderer.act(async () => {
    tree = Renderer.create(
      <PrivacyPolicyScreen
        route={{ name: 'PrivacyPolicy', key: 'privacy' }}
        navigation={
          navigation as unknown as React.ComponentProps<
            typeof PrivacyPolicyScreen
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
test('unapproved outline clearly labels draft, unknown metadata and coordinate visibility', async () => {
  await mount();
  expect(has('Draft / Development Preview')).toBe(true);
  expect(has('Last Updated: unavailable - approved document pending')).toBe(
    true,
  );
  expect(tree.root.findAllByType(ScrollView).length).toBeGreaterThan(0);
  expect(service.loadPrivacyPolicy().sections).toHaveLength(14);
  expect(has('Pending approved content.')).toBe(true);
  expect(
    tree.root.findAll(
      n =>
        typeof n.props.children === 'string' &&
        n.props.children.includes(
          'whether precise coordinates are shared with other users',
        ),
    ).length,
  ).toBeGreaterThan(0);
  await press('Back from Privacy Policy');
  expect(navigation.goBack).toHaveBeenCalled();
});
test('approved version/date/copy render with real reference links and errors', async () => {
  jest.spyOn(service, 'loadPrivacyPolicy').mockReturnValue({
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
  const original = service.loadPrivacyPolicy();
  jest
    .spyOn(service, 'loadPrivacyPolicy')
    .mockImplementationOnce(() => {
      throw Error('invalid');
    })
    .mockReturnValue(original);
  await mount();
  expect(has('Privacy Policy content is unavailable.')).toBe(true);
  await press('Retry privacy policy');
  expect(has('Draft / Development Preview')).toBe(true);
});
test('approved document requires valid date and final nonempty copy; unsafe links rejected', () => {
  const doc = {
    status: 'approved',
    version: 'test',
    lastUpdated: '2026-10-01',
    sections: [{ id: 'a', title: 'Title', paragraphs: ['Test fixture.'] }],
  };
  expect(service.privacyPolicySchema.safeParse(doc).success).toBe(true);
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
      service.privacyPolicySchema.safeParse({ ...doc, ...change }).success,
    ).toBe(false);
});
