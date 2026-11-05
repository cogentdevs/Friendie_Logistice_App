export const routes = {
  root: {
    splash: 'Splash',
    onboarding: 'Onboarding',
    auth: 'AuthStack',
    app: 'AppDrawer',
  },
  tabs: {
    home: 'HomeStack',
    listings: 'ListingsStack',
    post: 'PostListingStack',
    messages: 'MessagesStack',
    profile: 'ProfileStack',
  },
} as const;
