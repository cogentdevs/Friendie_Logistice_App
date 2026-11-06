import React from 'react';
import { Alert, Image, TextInput } from 'react-native';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePreventRemove } from '@react-navigation/native';
import { EditProfileScreen } from '../src/features/profile/screens/EditProfileScreen';
import * as profiles from '../src/features/profile/services/profileService';
import { profileEditService } from '../src/features/profile/services/profileEditService';
import * as photos from '../src/features/profile/services/profilePhotoService';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { appConfig } from '../src/constants/appConfig';
import { ApiError } from '../src/types/api';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  usePreventRemove: jest.fn(),
}));
const person = {
  id: 8,
  name: 'Member Name',
  email: 'member@example.test',
  phone: '+923001234567',
  verified: true,
  avatarUrl: 'https://example.test/avatar.jpg',
};
const nav = { popTo: jest.fn(), dispatch: jest.fn() };
let tree: ReactTestRenderer, client: QueryClient;
const originalPreview = appConfig.uiPreviewEnabled;
async function settle() {
  await Renderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 25));
  });
}
async function mount() {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <EditProfileScreen
          route={{ key: 'edit', name: 'EditProfile' }}
          navigation={
            nav as unknown as React.ComponentProps<
              typeof EditProfileScreen
            >['navigation']
          }
        />
      </QueryClientProvider>,
    );
  });
  await settle();
}
beforeEach(() => {
  jest.clearAllMocks();
  appConfig.uiPreviewEnabled = true;
  useDevelopmentStore.setState({
    previewActive: false,
    authEntryRequested: false,
  });
  useAuthStore.getState().setUser(person);
  jest.spyOn(profiles, 'getProfile').mockResolvedValue(person);
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client?.clear();
  });
  jest.restoreAllMocks();
  appConfig.uiPreviewEnabled = originalPreview;
});
const input = (label: string) =>
  tree.root
    .findAllByType(TextInput)
    .find(node => node.props.accessibilityLabel === label)!;
const button = (label: string) =>
  tree.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
const textPresent = (text: string) =>
  tree.root.findAll(node => node.props.children === text).length > 0;
async function press(label: string) {
  await Renderer.act(async () => {
    await button(label).props.onPress();
  });
  await settle();
}
async function edit(label: string, text: string) {
  await Renderer.act(async () => {
    input(label).props.onChangeText(text);
  });
}
test('prefills profile, locks verification status and disables unchanged save', async () => {
  await mount();
  expect(input('Full Name').props.value).toBe(person.name);
  expect(input('Email Address').props.value).toBe(person.email);
  expect(input('Phone Number').props.value).toBe(person.phone);
  expect(button('Save Changes').props.disabled).toBe(true);
  expect(textPresent('Verified Member')).toBe(true);
  await press('Back to Profile');
  expect(nav.popTo).toHaveBeenCalledWith('Profile');
});
test('validation and 422 conflicts are inline without changing auth or cached profile', async () => {
  const save = jest.spyOn(profileEditService, 'save').mockRejectedValue(
    new ApiError('Check your details', 'validation', 422, {
      email: ['Email is already registered'],
      phone: ['Phone is already registered'],
    }),
  );
  await mount();
  await edit('Email Address', 'invalid');
  await press('Save Changes');
  expect(textPresent('Enter a valid email address')).toBe(true);
  expect(save).not.toHaveBeenCalled();
  await edit('Email Address', 'changed@example.test');
  await press('Save Changes');
  expect(textPresent('Email is already registered')).toBe(true);
  expect(textPresent('Phone is already registered')).toBe(true);
  expect(useAuthStore.getState().user?.email).toBe(person.email);
  expect(client.getQueryData(['profile', 8])).toEqual(person);
});
test('unsaved edits require discard confirmation, and cancel preserves them', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await mount();
  await edit('Full Name', 'Changed Name');
  const call = jest.mocked(usePreventRemove).mock.calls.at(-1)!;
  expect(call[0]).toBe(true);
  const action = { type: 'GO_BACK' };
  await Renderer.act(async () => {
    call[1]({ data: { action } } as Parameters<(typeof call)[1]>[0]);
  });
  await Renderer.act(async () => {
    alert.mock.calls.at(-1)![2]![0].onPress!();
  });
  expect(input('Full Name').props.value).toBe('Changed Name');
  expect(nav.dispatch).not.toHaveBeenCalled();
  await Renderer.act(async () => {
    call[1]({ data: { action } } as Parameters<(typeof call)[1]>[0]);
  });
  await Renderer.act(async () => {
    alert.mock.calls.at(-1)![2]![1].onPress!();
  });
  expect(nav.dispatch).toHaveBeenCalledWith(action);
});
test('local photo preview never changes cached avatar and can restore original', async () => {
  useDevelopmentStore.setState({ previewActive: true });
  useAuthStore.getState().clear();
  const alert = jest.spyOn(Alert, 'alert');
  jest.spyOn(photos, 'chooseProfilePhoto').mockResolvedValue({
    uri: 'file:///preview.jpg',
    type: 'image/jpeg',
    fileSize: 200,
  });
  await mount();
  await press('Upload New Photo');
  await Renderer.act(async () => {
    await alert.mock.calls.at(-1)![2]!.find(b => b.text === 'Photo Library')!
      .onPress!();
  });
  await settle();
  expect(textPresent('Unsaved local photo preview')).toBe(true);
  expect(
    tree.root
      .findAllByType(Image)
      .some(node => node.props.source?.uri === 'file:///preview.jpg'),
  ).toBe(true);
  expect(
    client.getQueryData<profiles.Profile>(['profile', 'demo'])?.avatarUrl,
  ).toBe(person.avatarUrl);
  await press('Restore original photo');
  expect(textPresent('Unsaved local photo preview')).toBe(false);
  expect(button('Save Changes').props.disabled).toBe(true);
});
test('photo removal remains a local draft, restores original and never changes profile cache', async () => {
  await mount();
  await press('Remove Photo');
  expect(textPresent('Photo removal pending Save Changes')).toBe(true);
  expect(client.getQueryData<profiles.Profile>(['profile', 8])?.avatarUrl).toBe(
    person.avatarUrl,
  );
  expect(button('Save Changes').props.disabled).toBe(false);
  await press('Restore original photo');
  expect(button('Save Changes').props.disabled).toBe(true);
});

test('load failure can retry; missing verification does not invent a badge', async () => {
  jest
    .mocked(profiles.getProfile)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ ...person, verified: undefined });
  await mount();
  await press('Retry profile');
  expect(textPresent('Verification not confirmed')).toBe(true);
});
test('confirmed result updates correct-owner cache and auth before returning', async () => {
  jest
    .spyOn(profileEditService, 'save')
    .mockResolvedValue({ ...person, name: 'Updated Name', verified: false });
  await mount();
  await edit('Full Name', 'Updated Name');
  await press('Save Changes');
  expect(client.getQueryData<profiles.Profile>(['profile', 8])?.name).toBe(
    'Updated Name',
  );
  expect(useAuthStore.getState().user?.verified).toBe(false);
  expect(nav.popTo).toHaveBeenCalledWith('Profile');
});
test('wrong-owner response and failed network cannot overwrite the session', async () => {
  const save = jest
    .spyOn(profileEditService, 'save')
    .mockResolvedValue({ ...person, id: 9 });
  await mount();
  await edit('Full Name', 'Changed Name');
  await press('Save Changes');
  expect(useAuthStore.getState().user?.id).toBe(8);
  expect(nav.popTo).not.toHaveBeenCalled();
  save.mockRejectedValueOnce(new ApiError('network', 'network'));
  await press('Save Changes');
  expect(
    textPresent(
      'Unable to connect. Your changes are unsaved. Please try again.',
    ),
  ).toBe(true);
  expect(input('Full Name').props.value).toBe('Changed Name');
});

test('pending save disables inputs and cannot duplicate the update', async () => {
  let fail!: (error: Error) => void;
  const save = jest.spyOn(profileEditService, 'save').mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  await mount();
  await edit('Full Name', 'Changed Name');
  await press('Save Changes');
  expect(button('Save Changes').props.disabled).toBe(true);
  expect(input('Email Address').props.editable).toBe(false);
  await press('Save Changes');
  expect(save).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => {
    fail(new ApiError('offline', 'network'));
  });
  expect(input('Full Name').props.value).toBe('Changed Name');
});
test('editor includes only approved identity fields and country calling code', async () => {
  await mount();
  expect(
    tree.root.findAllByType(TextInput).map(n => n.props.accessibilityLabel),
  ).toEqual(['Full Name', 'Email Address', 'Phone Number']);
  expect(textPresent('Country (calling code)')).toBe(true);
  expect(textPresent('Pakistan')).toBe(true);
  expect(button('Select profile country')).toBeUndefined();
  expect(button('Select profile city')).toBeUndefined();
  expect(button('Select profile area')).toBeUndefined();
});
