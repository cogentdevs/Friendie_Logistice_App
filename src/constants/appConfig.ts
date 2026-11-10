import environment from '../app/config/environment.generated.json';
export const appConfig = {
  ...environment,
  uiPreviewEnabled:
    (__DEV__ || environment.testingUiPreview) && environment.uiPreviewEnabled,
  navigationPreview: __DEV__ && environment.navigationPreview,
  // Public development catalogue; independent of authentication and UI login preview.
  staticMarketplaceEnabled: __DEV__,
  requestTimeout: 15000,
  name: 'Friendie Logistics',
};

export function isUiPreviewAllowed() {
  return appConfig.uiPreviewEnabled && (__DEV__ || appConfig.testingUiPreview);
}
