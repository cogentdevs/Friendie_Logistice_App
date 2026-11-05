import { LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from './navigationTypes';
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['friendie://'],
  config: {
    screens: {
      Welcome: 'welcome',
      Onboarding: 'onboarding',
      VerifiedReliable: 'onboarding/verified',
      GlobalReach: 'onboarding/global',
      AuthStack: {
        screens: {
          Login: 'login',
          Register: 'register',
          ForgotPassword: 'forgot-password',
          // Reset-token links stay disabled until an approved HTTPS host/path and
          // backend token/parameter contract are verified. Custom schemes are not accepted.
        },
      },
      AppDrawer: {
        screens: {
          MainTabs: {
            screens: {
              HomeStack: {
                screens: { Home: '', Search: 'search', Filters: 'filters' },
              },
              ListingsStack: {
                screens: {
                  Listings: 'listings',
                  ListingDetails: 'listings/:listingId',
                },
              },
              PostListingStack: {
                screens: {
                  PostListing: 'post',
                  SendParcel: 'post/send',
                  CarryParcel: 'post/carry',
                },
              },
              MessagesStack: {
                screens: {
                  Conversations: 'messages',
                  Chat: 'messages/:conversationId',
                },
              },
              ProfileStack: {
                screens: { Profile: 'profile', EditProfile: 'profile/edit' },
              },
            },
          },
          MyListings: 'my-listings',
          SavedListings: 'saved',
          MyReviews: 'reviews',
          Notifications: 'notifications',
          Tracking: 'tracking',
          Settings: 'settings',
          HelpSupport: 'help',
          About: 'about',
        },
      },
    },
  },
};
