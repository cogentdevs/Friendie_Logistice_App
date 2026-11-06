import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { TextInput, Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContactUsScreen } from '../src/features/support/screens/ContactUsScreen';
import {
  contactService,
  supportConfig,
} from '../src/features/support/services/contactService';
import { useAuthStore } from '../src/store/authStore';
let prevent: (event: { data: { action: { type: string } } }) => void;
let protectedDraft = false;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: () => {},
  usePreventRemove: (enabled: boolean, callback: typeof prevent) => {
    protectedDraft = enabled;
    prevent = callback;
  },
}));
let tree: ReactTestRenderer, client: QueryClient;
const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  canGoBack: () => true,
  dispatch: jest.fn(),
};
const originalCategories = supportConfig.categories;
async function mount() {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <ContactUsScreen
          route={{ key: 'contact', name: 'ContactUs' }}
          navigation={
            navigation as unknown as React.ComponentProps<
              typeof ContactUsScreen
            >['navigation']
          }
        />
      </QueryClientProvider>,
    );
  });
}
async function press(label: string) {
  await Renderer.act(async () => {
    tree.root
      .findAll(
        n =>
          n.props.accessibilityLabel === label &&
          typeof n.props.onPress === 'function',
      )[0]
      .props.onPress();
  });
}
async function input(label: string, value: string) {
  await Renderer.act(async () => {
    tree.root
      .findAllByType(TextInput)
      .find(n => n.props.accessibilityLabel === label)!
      .props.onChangeText(value);
  });
}
async function fill() {
  await input('Subject', 'Listing assistance');
  await input('Message', 'Please help me with this listing.');
  await press('Select support category');
  await press('Test category');
}
beforeEach(() => {
  jest.clearAllMocks();
  supportConfig.categories = [{ id: 'test-category', name: 'Test category' }];
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client?.clear();
  });
  supportConfig.categories = originalCategories;
  jest.restoreAllMocks();
});
test('prefills real identity; required validation prevents request', async () => {
  const submit = jest.spyOn(contactService, 'submit');
  await mount();
  expect(
    tree.root
      .findAllByType(TextInput)
      .find(n => n.props.accessibilityLabel === 'Full Name')!.props.value,
  ).toBe('Member');
  await press('Send Message');
  expect(submit).not.toHaveBeenCalled();
  expect(
    tree.root.findAll(n => n.props.children === 'Enter a subject.').length,
  ).toBeGreaterThan(0);
});
test('accepted response alone shows confirmation and returned reference', async () => {
  jest
    .spyOn(contactService, 'submit')
    .mockResolvedValue({ accepted: true, reference: 'TEST-001' });
  await mount();
  await fill();
  await press('Send Message');
  expect(contactService.submit).toHaveBeenCalledWith(
    expect.objectContaining({ category: 'test-category', name: 'Member' }),
    expect.anything(),
  );
  expect(
    tree.root.findAll(n => n.props.children === 'Message Received').length,
  ).toBeGreaterThan(0);
  expect(
    tree.root.findAll(n => n.props.children === 'Reference: TEST-001').length,
  ).toBeGreaterThan(0);
  expect(protectedDraft).toBe(false);
});
test('network failure preserves draft and never shows success', async () => {
  jest.spyOn(contactService, 'submit').mockRejectedValue(new Error('offline'));
  await mount();
  await fill();
  await press('Send Message');
  expect(
    tree.root.findAll(n => n.props.children === 'Message Received'),
  ).toHaveLength(0);
  expect(
    tree.root
      .findAllByType(TextInput)
      .find(n => n.props.accessibilityLabel === 'Subject')!.props.value,
  ).toBe('Listing assistance');
  expect(protectedDraft).toBe(true);
  const alert = jest.spyOn(Alert, 'alert');
  await Renderer.act(async () => {
    prevent({ data: { action: { type: 'GO_BACK' } } });
  });
  expect(alert).toHaveBeenCalledWith(
    'Discard message?',
    expect.any(String),
    expect.any(Array),
    expect.any(Object),
  );
});
test('unconfigured categories show empty state without invented choices', async () => {
  supportConfig.categories = [];
  await mount();
  await press('Select support category');
  expect(
    tree.root.findAll(
      n => n.props.children === 'Support categories are not available yet.',
    ).length,
  ).toBeGreaterThan(0);
});
