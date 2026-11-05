import * as Keychain from 'react-native-keychain';
const service = 'com.friendie.logistics.session';
export const secureStorage = {
  async getToken() {
    const value = await Keychain.getGenericPassword({ service });
    return value ? value.password : null;
  },
  async setToken(token: string) {
    const saved = await Keychain.setGenericPassword('sanctum', token, {
      service,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (!saved)
      throw new Error(
        'Unable to securely store your session. Please try again.',
      );
  },
  async removeToken() {
    const removed = await Keychain.resetGenericPassword({ service });
    if (!removed && (await Keychain.getGenericPassword({ service })))
      throw new Error('Could not clear the secure session. Please try again.');
  },
};
