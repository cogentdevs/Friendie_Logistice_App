import Toast from 'react-native-toast-message';
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
import { launchImageLibrary } from 'react-native-image-picker';
import { secureStorage } from '../src/services/storage/secureStorage';
import { apiClient } from '../src/services/api/apiClient';
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
  jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => {
    success?.(512, 512);
    return Promise.resolve({ width: 512, height: 512 });
  });
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
      email: ['The email has already been taken.'],
      phone: ['The phone has already been taken.'],
    }),
  );
  await mount();
  await edit('Email Address', 'invalid');
  await press('Save Changes');
  expect(textPresent('Enter a valid email address')).toBe(true);
  expect(save).not.toHaveBeenCalled();
  await edit('Email Address', 'changed@example.test');
  await press('Save Changes');
  expect(textPresent('The email has already been taken.')).toBe(true);
  expect(textPresent('The phone has already been taken.')).toBe(true);
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
  const remove = jest.spyOn(apiClient, 'delete');
  await mount();
  await press('Remove Photo');
  expect(textPresent('Photo removal pending Save Changes')).toBe(true);
  expect(client.getQueryData<profiles.Profile>(['profile', 8])?.avatarUrl).toBe(
    person.avatarUrl,
  );
  expect(button('Save Changes').props.disabled).toBe(false);
  await press('Restore original photo');
  expect(button('Save Changes').props.disabled).toBe(true);
  expect(remove).not.toHaveBeenCalled();
});
test('existing Remove Photo saves through DELETE and publishes only authoritative profile data', async () => {
  jest.spyOn(Toast, 'show').mockImplementation(() => {});
  await mount();
  const canonical = 'https://example.test/backend-default.jpg';
  jest
    .spyOn(secureStorage, 'getToken')
    .mockResolvedValue('avatar-delete-ui-test-token');
  const remove = jest
    .spyOn(apiClient, 'delete')
    .mockResolvedValue({
      status: 200,
      data: {
        success: true,
        message: 'Avatar removed successfully.',
        data: { image_url: canonical },
      },
    });
  const put = jest.spyOn(apiClient, 'put');
  await press('Remove Photo');
  expect(remove).not.toHaveBeenCalled();
  expect(client.getQueryData<profiles.Profile>(['profile', 8])?.avatarUrl).toBe(
    person.avatarUrl,
  );
  expect(
    tree.root
      .findAllByType(Image)
      .some(node => node.props.source?.uri === person.avatarUrl),
  ).toBe(true);
  jest
    .mocked(profiles.getProfile)
    .mockResolvedValue({ ...person, avatarUrl: canonical });
  await press('Save Changes');
  expect(remove).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledWith(
    '/customer/profile/avatar',
    expect.objectContaining({
      headers: { Authorization: 'Bearer avatar-delete-ui-test-token' },
    }),
  );
  expect(put).not.toHaveBeenCalled();
  expect(client.getQueryData<profiles.Profile>(['profile', 8])?.avatarUrl).toBe(
    canonical,
  );
  expect(Toast.show).toHaveBeenCalledTimes(1);
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'success' }),
  );
  expect(nav.popTo).toHaveBeenCalledWith('Profile');
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
test('confirmed result updates correct-owner cache without replacing the session', async () => {
  const notification = jest.spyOn(Toast, 'show');
  jest.spyOn(profileEditService, 'save').mockResolvedValue({
    profile: { ...person, name: 'Updated Name', verified: false },
    reauthenticationRequired: false,
    verificationRequired: false,
  });
  await mount();
  await edit('Full Name', 'Updated Name');
  await press('Save Changes');
  expect(client.getQueryData<profiles.Profile>(['profile', 8])?.name).toBe(
    'Updated Name',
  );
  expect(client.getQueryData<profiles.Profile>(['profile', 8])?.verified).toBe(
    false,
  );
  expect(useAuthStore.getState().user).toBe(person);
  expect(notification).toHaveBeenCalledTimes(1);
  expect(notification).toHaveBeenCalledWith({
    type: 'success',
    text1: 'Profile updated',
    text2: 'Your profile was updated successfully.',
  });
  expect(nav.popTo).toHaveBeenCalledWith('Profile');
});
test('wrong-owner response and failed network cannot overwrite the session', async () => {
  const save = jest.spyOn(profileEditService, 'save').mockResolvedValue({
    profile: { ...person, id: 9 },
    reauthenticationRequired: false,
    verificationRequired: false,
  });
  await mount();
  await edit('Full Name', 'Changed Name');
  await press('Save Changes');
  expect(useAuthStore.getState().user?.id).toBe(8);
  expect(nav.popTo).not.toHaveBeenCalled();
  const notification = jest.spyOn(Toast, 'show');
  save.mockRejectedValueOnce(new ApiError('network', 'network'));
  await press('Save Changes');
  expect(notification).toHaveBeenCalledWith({
    type: 'error',
    text1: 'Profile update failed',
    text2: 'Unable to connect. Your changes are unsaved. Please try again.',
  });
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
test('background profile refresh does not overwrite active edits', async () => {
  await mount();
  await edit('Full Name', 'Unsaved Name');
  await Renderer.act(async () => {
    client.setQueryData(['profile', 8], { ...person, name: 'Background Name' });
    await new Promise<void>(resolve => setTimeout(resolve, 25));
  });
  expect(input('Full Name').props.value).toBe('Unsaved Name');
});
test('email reauthentication result uses Toast and never repopulates private cache', async () => {
  const notification = jest.spyOn(Toast, 'show');
  jest.spyOn(profileEditService, 'save').mockImplementation(async () => {
    useAuthStore.getState().clear();
    return {
      profile: { ...person, email: 'changed@example.test', verified: false },
      verificationRequired: true,
      reauthenticationRequired: true,
    };
  });
  await mount();
  await edit('Email Address', 'changed@example.test');
  await press('Save Changes');
  expect(client.getQueryData(['profile', 8])).toBeUndefined();
  expect(notification).toHaveBeenCalledWith({
    type: 'success',
    text1: 'Profile updated',
    text2: 'Verify your new email and sign in again.',
  });
  expect(nav.popTo).not.toHaveBeenCalled();
});
async function selectGallery() {
  const alert = jest.spyOn(Alert, 'alert');
  await press('Upload New Photo');
  await Renderer.act(async () => {
    alert.mock.calls
      .at(-1)![2]!
      .find(choice => choice.text === 'Photo Library')!.onPress!();
  });
  await settle();
}
test('real picker metadata with a content WebP URI previews immediately, retries a failed URI and preserves cancellation', async () => {
  const selected = {
    uri: 'content://photos/selected',
    type: 'image/webp',
    fileSize: -1,
    fileName: 'selected.webp',
  };
  jest.mocked(launchImageLibrary).mockResolvedValue({ assets: [selected] });
  await mount();
  await selectGallery();
  const preview = () =>
    tree.root
      .findAllByType(Image)
      .find(node => node.props.source?.uri === selected.uri);
  expect(preview()).toBeDefined();
  await Renderer.act(async () => {
    preview()!.props.onError();
  });
  expect(preview()).toBeUndefined();
  await selectGallery();
  expect(preview()).toBeDefined();
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({ didCancel: true });
  await selectGallery();
  expect(preview()).toBeDefined();
  expect(client.getQueryData<profiles.Profile>(['profile', 8])?.avatarUrl).toBe(
    person.avatarUrl,
  );
});
test('definite rejected upload preserves local preview; explicit retry caches only the backend URL', async () => {
  const selected = {
    uri: 'content://photos/upload',
    type: 'image/png',
    fileSize: 200,
    fileName: 'selected.png',
  };
  const savedUrl = 'https://example.test/api_user_8_new.jpg';
  const notification = jest.spyOn(Toast, 'show');
  jest
    .spyOn(secureStorage, 'getToken')
    .mockResolvedValue('avatar-ui-test-token');
  jest.mocked(launchImageLibrary).mockResolvedValue({ assets: [selected] });
  const post = jest
    .spyOn(apiClient, 'post')
    .mockRejectedValueOnce(new ApiError('Invalid avatar', 'validation', 422))
    .mockResolvedValue({
      status: 200,
      data: {
        success: true,
        message: 'Avatar updated successfully.',
        data: { image_url: savedUrl },
      },
    });
  await mount();
  await selectGallery();
  await press('Save Changes');
  expect(
    tree.root
      .findAllByType(Image)
      .some(node => node.props.source?.uri === selected.uri),
  ).toBe(true);
  expect(client.getQueryData<profiles.Profile>(['profile', 8])?.avatarUrl).toBe(
    person.avatarUrl,
  );
  expect(notification).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: 'error' }),
  );
  jest
    .mocked(profiles.getProfile)
    .mockResolvedValue({ ...person, avatarUrl: savedUrl });
  await press('Save Changes');
  expect(post).toHaveBeenCalledTimes(2);
  expect(client.getQueryData<profiles.Profile>(['profile', 8])?.avatarUrl).toBe(
    savedUrl,
  );
  expect(nav.popTo).toHaveBeenCalledWith('Profile');
  expect(notification).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: 'success' }),
  );
});

test('uncertain upload preserves preview, warns once and blocks another POST across an editor remount', async () => {
  const selected = {
    uri: 'content://photos/uncertain',
    type: 'image/png' as const,
    fileSize: 200,
  };
  jest.spyOn(photos, 'chooseProfilePhoto').mockResolvedValue(selected);
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('dummy-avatar-token');
  const post = jest
    .spyOn(apiClient, 'post')
    .mockRejectedValue(new ApiError('timeout', 'network'));
  const toast = jest.spyOn(Toast, 'show');
  await mount();
  await selectGallery();
  await press('Save Changes');
  expect(post).toHaveBeenCalledTimes(1);
  expect(button('Save Changes').props.disabled).toBe(true);
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: 'warning' }),
  );
  expect(nav.popTo).not.toHaveBeenCalled();
  expect(
    tree.root
      .findAllByType(Image)
      .some(node => node.props.source?.uri === selected.uri),
  ).toBe(true);
  await Renderer.act(async () => {
    tree.unmount();
    client.clear();
  });
  await mount();
  expect(
    tree.root
      .findAllByType(Image)
      .some(node => node.props.source?.uri === selected.uri),
  ).toBe(true);
  expect(button('Save Changes').props.disabled).toBe(true);
  await press('Save Changes');
  expect(post).toHaveBeenCalledTimes(1);
});
test('picker completion after logout cannot set preview or notify another account', async () => {
  let resolve!: (value: photos.AvatarDraft) => void;
  jest.spyOn(photos, 'chooseProfilePhoto').mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const toast = jest.spyOn(Toast, 'show');
  await mount();
  await selectGallery();
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
    resolve({ uri: 'file:///old-account.png', type: 'image/png' });
  });
  await settle();
  expect(
    tree.root
      .findAllByType(Image)
      .some(node => node.props.source?.uri === 'file:///old-account.png'),
  ).toBe(false);
  expect(toast).not.toHaveBeenCalled();
});
test('picker completion after unmount cannot notify or save', async () => {
  let reject!: (error: Error) => void;
  jest.spyOn(photos, 'chooseProfilePhoto').mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const toast = jest.spyOn(Toast, 'show');
  const save = jest.spyOn(profileEditService, 'save');
  await mount();
  await selectGallery();
  await Renderer.act(async () => {
    tree.unmount();
  });
  await Renderer.act(async () => {
    reject(new Error('private picker path'));
  });
  expect(toast).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});
test('an old image error cannot hide or report a failure for a newer preview', async () => {
  const choose = jest
    .spyOn(photos, 'chooseProfilePhoto')
    .mockResolvedValueOnce({ uri: 'file:///first.png', type: 'image/png' })
    .mockResolvedValueOnce({ uri: 'file:///second.png', type: 'image/png' });
  const toast = jest.spyOn(Toast, 'show');
  await mount();
  await selectGallery();
  const oldError = tree.root
    .findAllByType(Image)
    .find(node => node.props.source?.uri === 'file:///first.png')!.props
    .onError;
  await selectGallery();
  await Renderer.act(async () => {
    oldError();
    oldError();
  });
  expect(choose).toHaveBeenCalledTimes(2);
  expect(
    tree.root
      .findAllByType(Image)
      .some(node => node.props.source?.uri === 'file:///second.png'),
  ).toBe(true);
  expect(toast).not.toHaveBeenCalled();
});
test('unreadable selected preview cannot be uploaded and repeated image errors notify only once', async () => {
  jest
    .spyOn(photos, 'chooseProfilePhoto')
    .mockResolvedValue({ uri: 'file:///broken.png', type: 'image/png' });
  const save = jest.spyOn(profileEditService, 'save');
  const toast = jest.spyOn(Toast, 'show');
  await mount();
  await selectGallery();
  const onError = tree.root
    .findAllByType(Image)
    .find(node => node.props.source?.uri === 'file:///broken.png')!.props
    .onError;
  await Renderer.act(async () => {
    onError();
    onError();
  });
  expect(toast).toHaveBeenCalledTimes(1);
  await press('Save Changes');
  expect(save).not.toHaveBeenCalled();
});
test('confirmed upload with failed profile refresh retries read only and retains the photo draft', async () => {
  const selected = {
    uri: 'content://photos/confirmed',
    type: 'image/png' as const,
    fileSize: 200,
  };
  jest.spyOn(photos, 'chooseProfilePhoto').mockResolvedValue(selected);
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('dummy-avatar-token');
  const url = 'https://example.test/confirmed.jpg';
  const post = jest.spyOn(apiClient, 'post').mockResolvedValue({
    status: 200,
    data: {
      success: true,
      message: 'Avatar updated successfully.',
      data: { image_url: url },
    },
  });
  await mount();
  await selectGallery();
  jest
    .mocked(profiles.getProfile)
    .mockRejectedValueOnce(new ApiError('offline', 'network'));
  await press('Save Changes');
  expect(client.getQueryData<profiles.Profile>(['profile', 8])?.avatarUrl).toBe(
    url,
  );
  expect(nav.popTo).not.toHaveBeenCalled();
  expect(
    tree.root
      .findAllByType(Image)
      .some(node => node.props.source?.uri === selected.uri),
  ).toBe(true);
  jest
    .mocked(profiles.getProfile)
    .mockResolvedValue({ ...person, avatarUrl: url });
  await press('Save Changes');
  expect(post).toHaveBeenCalledTimes(1);
  expect(nav.popTo).toHaveBeenCalledWith('Profile');
});
test('two rapid Save taps submit a selected photo only once', async () => {
  let resolve!: (
    value: Awaited<ReturnType<typeof profileEditService.save>>,
  ) => void;
  const save = jest.spyOn(profileEditService, 'save').mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  jest
    .spyOn(photos, 'chooseProfilePhoto')
    .mockResolvedValue({ uri: 'file:///new.png', type: 'image/png' });
  await mount();
  await selectGallery();
  await Renderer.act(async () => {
    button('Save Changes').props.onPress();
    button('Save Changes').props.onPress();
  });
  expect(save).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => {
    resolve({
      profile: { ...person, avatarUrl: 'https://example.test/saved.jpg' },
      reauthenticationRequired: false,
      verificationRequired: false,
    });
  });
});

test('account replacement while canceling older profile reads cannot publish a photo or notify the new account', async () => {
  const toast = jest.spyOn(Toast, 'show');
  jest
    .spyOn(photos, 'chooseProfilePhoto')
    .mockResolvedValue({ uri: 'file:///old.png', type: 'image/png' });
  jest.spyOn(profileEditService, 'save').mockResolvedValue({
    profile: { ...person, avatarUrl: 'https://example.test/new.jpg' },
    reauthenticationRequired: false,
    verificationRequired: false,
  });
  await mount();
  await selectGallery();
  jest
    .mocked(profiles.getProfile)
    .mockRejectedValue(new ApiError('Session changed.', 'cancelled'));
  jest.spyOn(client, 'cancelQueries').mockImplementation(async () => {
    useAuthStore
      .getState()
      .setUser({ id: 99, name: 'Other', email: 'other@example.test' });
  });
  const publish = jest.spyOn(client, 'setQueryData');
  await press('Save Changes');
  expect(publish).not.toHaveBeenCalled();
  expect(client.getQueryData(['profile', 99])).toBeUndefined();
  expect(nav.popTo).not.toHaveBeenCalled();
  expect(toast).not.toHaveBeenCalled();
});
