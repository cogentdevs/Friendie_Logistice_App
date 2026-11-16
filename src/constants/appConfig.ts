import environment from '../app/config/environment.generated.json';
import { NativeModules } from 'react-native';
const staticTestingBuild =
  NativeModules.FriendieAppMetadata?.staticTesting === true;
export const appConfig = {
  ...environment,
  registrationCountryIds: environment.registrationCountryIds as Record<
    string,
    number
  >,
  uiPreviewEnabled:
    (__DEV__ || staticTestingBuild) && environment.uiPreviewEnabled,
  navigationPreview: __DEV__ && environment.navigationPreview,
  // Public development catalogue; independent of authentication and UI login preview.
  staticTestingBuild,
  staticMarketplaceEnabled: __DEV__ || staticTestingBuild,
  requestTimeout: 15000,
  name: 'Friendie Logistics',
};

export function isUiPreviewAllowed() {
  return appConfig.uiPreviewEnabled && (__DEV__ || appConfig.staticTestingBuild);
}
