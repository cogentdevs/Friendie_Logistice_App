import * as Keychain from 'react-native-keychain';
const service = 'com.friendie.logistics.session';
// Serialize credential mutations so an old response cannot remove a newer token.
let pending: Promise<unknown> = Promise.resolve();
function exclusive<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation, operation);
  pending = result.catch(() => undefined);
  return result;
}
async function readToken() {
  const value = await Keychain.getGenericPassword({ service });
  return value ? value.password : null;
}
async function remove() {
  const removed = await Keychain.resetGenericPassword({ service });
  if (!removed && (await readToken()))
    throw new Error('Could not clear the secure session. Please try again.');
}
export const secureStorage = {
  getToken: readToken,
  setToken(token: string) {
    return exclusive(async () => {
      const saved = await Keychain.setGenericPassword('sanctum', token, {
        service,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      if (!saved)
        throw new Error(
          'Unable to securely store your session. Please try again.',
        );
    });
  },
  removeToken() {
    return exclusive(remove);
  },
  removeTokenIfCurrent(token: string, isCurrent: () => boolean) {
    return exclusive(async () => {
      if ((await readToken()) !== token || !isCurrent()) return false;
      await remove();
      return true;
    });
  },
};
