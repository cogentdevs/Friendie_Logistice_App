import { NativeModules } from 'react-native';
// The installed native app supplies its version, never package.json or the RN engine version.
export function getNativeAppVersion(): string | null {
  const value: unknown = NativeModules.FriendieAppMetadata?.version;
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}
