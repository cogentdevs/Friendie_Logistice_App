// Proposed contract: confirm these paths and response shapes with the Laravel team.
export const endpoints = {
  login: '/auth/login',
  logout: '/auth/logout',
  me: '/user',
  listings: '/listings',
  myListings: '/user/listings',
} as const;
