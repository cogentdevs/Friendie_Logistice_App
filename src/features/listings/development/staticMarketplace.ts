// Public browsing always uses Laravel. Fixture selection belongs to Jest mocks,
// not debug/release/native testing flags or authentication state.
export function isStaticMarketplaceEnabled() {
  return false;
}
export class StaticMarketplaceDisabledError extends Error {
  constructor() {
    super('Static marketplace content is disabled in this build.');
    this.name = 'StaticMarketplaceDisabledError';
  }
}
