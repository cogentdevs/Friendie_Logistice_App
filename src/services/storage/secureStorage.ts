import * as Keychain from 'react-native-keychain';
import { userSchema } from '../../features/auth/schemas/sessionSchema';
import type { User } from '../../types/user';
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
  async getSession() {
    const value = await Keychain.getGenericPassword({ service });
    if (!value) return null;
    try {
      const user = userSchema.parse(JSON.parse(value.username));
      return { token: value.password, user };
    } catch {
      return null;
    }
  },
  setSession(token: string, user: User) {
    return exclusive(async () => {
      const saved = await Keychain.setGenericPassword(
        JSON.stringify(user),
        token,
        {
          service,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        },
      );
      if (!saved)
        throw new Error(
          'Unable to securely store your session. Please try again.',
        );
    });
  },
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
  removeTokenIfCurrent(token: string | null, isCurrent: () => boolean) {
    return exclusive(async () => {
      if ((await readToken()) !== token || !isCurrent()) return false;
      await remove();
      return true;
    });
  },
};
