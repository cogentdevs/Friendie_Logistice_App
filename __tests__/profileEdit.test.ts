import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import {
  chooseProfilePhoto,
  validateAvatar,
  previewAvatarMaxBytes,
  PhotoPermissionError,
} from '../src/features/profile/services/profilePhotoService';
import { editProfileSchema } from '../src/features/profile/schemas/editProfileSchema';
import { profileEditService } from '../src/features/profile/services/profileEditService';
import { apiClient } from '../src/services/api/apiClient';
const valid = {
  name: ' Demo Traveller ',
  email: ' DEMO@Example.test ',
  phone: '03001234567',
  callingCountry: 'PK' as const,
  location: null,
};
afterEach(() => jest.restoreAllMocks());
test('edit validation requires identity/calling code/phone and normalizes name/email', () => {
  expect(editProfileSchema.parse(valid)).toMatchObject({
    name: 'Demo Traveller',
    email: 'demo@example.test',
  });
  expect(
    editProfileSchema.safeParse({
      ...valid,
      name: ' ',
      email: 'bad',
      phone: '-1',
    }).success,
  ).toBe(false);
  expect(
    editProfileSchema.safeParse({ ...valid, phone: '', callingCountry: null })
      .success,
  ).toBe(false);
  expect(
    editProfileSchema.safeParse({
      ...valid,
      phone: '+819012345678',
      callingCountry: null,
    }).success,
  ).toBe(false);
});
test('only valid local JPEG/PNG assets with known preview size are accepted', () => {
  expect(
    validateAvatar({
      uri: 'file:///preview.jpg',
      type: 'image/jpeg',
      fileSize: 200,
    }),
  ).toMatchObject({ fileSize: 200 });
  for (const asset of [
    {
      uri: 'https://example.test/photo.jpg',
      type: 'image/jpeg',
      fileSize: 200,
    },
    { uri: 'file:///preview.heic', type: 'image/heic', fileSize: 200 },
    { uri: 'file:///preview.png', type: 'image/png' },
    {
      uri: 'file:///preview.png',
      type: 'image/png',
      fileSize: previewAvatarMaxBytes + 1,
    },
  ])
    expect(() => validateAvatar(asset)).toThrow();
});
test('gallery cancellation does not change the selected photo; camera and permission states are explicit', async () => {
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({ didCancel: true });
  expect(await chooseProfilePhoto('gallery')).toBeUndefined();
  jest.mocked(launchCamera).mockResolvedValueOnce({ errorCode: 'permission' });
  await expect(chooseProfilePhoto('camera')).rejects.toBeInstanceOf(
    PhotoPermissionError,
  );
  jest
    .mocked(launchCamera)
    .mockResolvedValueOnce({ errorCode: 'camera_unavailable' });
  await expect(chooseProfilePhoto('camera')).rejects.toThrow(
    'camera is unavailable',
  );
});
test('valid gallery image is returned without EXIF/base64 and unexpected native errors stay generic', async () => {
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({
    assets: [{ uri: 'content://preview/1', type: 'image/png', fileSize: 300 }],
  });
  expect(await chooseProfilePhoto('gallery')).toMatchObject({
    uri: 'content://preview/1',
  });
  expect(launchImageLibrary).toHaveBeenCalledWith(
    expect.objectContaining({
      includeBase64: false,
      includeExtra: false,
      selectionLimit: 1,
    }),
  );
  jest
    .mocked(launchImageLibrary)
    .mockRejectedValueOnce(new Error('private path'));
  await expect(chooseProfilePhoto('gallery')).rejects.toThrow(
    'Could not open the photo picker',
  );
});
test('unverified save never makes a request or returns fake success', async () => {
  const patch = jest.spyOn(apiClient, 'patch'),
    post = jest.spyOn(apiClient, 'post');
  await expect(profileEditService.save(valid)).rejects.toThrow(
    'not connected yet',
  );
  expect(patch).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});

test('website photo limit accepts 10 MB and rejects larger files', () => {
  expect(
    validateAvatar({
      uri: 'file:///ten.png',
      type: 'image/png',
      fileSize: 10 * 1024 * 1024,
    }).fileSize,
  ).toBe(10 * 1024 * 1024);
  expect(() =>
    validateAvatar({
      uri: 'file:///large.png',
      type: 'image/png',
      fileSize: 10 * 1024 * 1024 + 1,
    }),
  ).toThrow('10 MB');
});
