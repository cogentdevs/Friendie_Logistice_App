import { appConfig } from '../../../constants/appConfig';
// Never enabled in a production runtime, including a release UI-preview build.
export function isStaticMarketplaceEnabled() {
  return __DEV__ && appConfig.staticMarketplaceEnabled;
}
export class StaticMarketplaceDisabledError extends Error {
  constructor() {
    super('Static marketplace content is disabled in this build.');
    this.name = 'StaticMarketplaceDisabledError';
  }
}
