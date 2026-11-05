import environment from '../app/config/environment.generated.json';
export const appConfig = {
  ...environment,
  uiPreviewEnabled: __DEV__ && environment.uiPreviewEnabled,
  navigationPreview: __DEV__ && environment.navigationPreview,
  requestTimeout: 15000,
  name: 'Friendie Logistics',
};
