import type { RootStackParamList } from '../../../navigation/navigationTypes';
import type { PendingAction } from '../types/pendingAction.types';
export function authActionTarget(
  action: PendingAction,
  listingStack: 'HomeStack' | 'ListingsStack' = 'ListingsStack',
): RootStackParamList['AppDrawer'] {
  switch (action.type) {
    case 'POST_LISTING':
      return {
        screen: 'MainTabs',
        params: {
          screen: 'PostListingStack',
          params:
            action.params?.listingType === 'send'
              ? { screen: 'SendParcel' }
              : action.params?.listingType === 'carry'
              ? { screen: 'CarryParcel' }
              : { screen: 'PostListing' },
        },
      };
    case 'OPEN_MESSAGES':
      return {
        screen: 'MainTabs',
        params: {
          screen: 'MessagesStack',
          params: action.params?.conversationId
            ? {
                screen: 'Chat',
                params: {
                  conversationId: action.params.conversationId,
                  ...(action.params.returnTo
                    ? { returnTo: action.params.returnTo }
                    : {}),
                },
              }
            : { screen: 'Conversations' },
        },
      };
    case 'OPEN_ACCOUNT': {
      const destination = action.params.destination;
      if (destination === 'EditProfile' || destination === 'ProfileDashboard')
        return {
          screen: 'MainTabs',
          params: { screen: 'ProfileStack', params: { screen: destination } },
        };
      if (destination === 'MyReviews')
        return {
          screen: 'MyReviews',
          params: {
            initialTab: 'visitors',
            returnTo: listingStack === 'HomeStack' ? 'Home' : 'Profile',
          },
        };
      return { screen: destination };
    }
    case 'OPEN_PROFILE':
      return {
        screen: 'MainTabs',
        params: { screen: 'ProfileStack', params: { screen: 'Profile' } },
      };
    default:
      // Resume the UI, never submit a request, toggle a saved item or reveal contact automatically.
      return {
        screen: 'MainTabs',
        params: {
          screen: listingStack,
          params: {
            screen: 'ListingDetails',
            params: {
              listingId: action.params.listingId,
              resumeAction:
                action.type === 'SAVE_LISTING'
                  ? 'save'
                  : action.type === 'REQUEST_LISTING'
                  ? 'request'
                  : 'contact',
            },
          },
        },
      };
  }
}
