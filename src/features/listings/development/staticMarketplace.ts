import { appConfig } from '../../../constants/appConfig';
// Only debug or the explicitly labelled native STATIC_TESTING build, never normal release.
export function isStaticMarketplaceEnabled() {
  return (
    (__DEV__ || appConfig.staticTestingBuild) &&
    appConfig.staticMarketplaceEnabled
  );
}
export class StaticMarketplaceDisabledError extends Error {
  constructor() {
    super('Static marketplace content is disabled in this build.');
    this.name = 'StaticMarketplaceDisabledError';
  }
}
