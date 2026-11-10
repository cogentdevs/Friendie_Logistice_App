import { withAccountAccess } from './components/AccountAccessBoundary';
import { PostListingScreen } from '../features/post-listing/screens/PostListingScreen';
import { ListingReviewScreen } from '../features/post-listing/screens/ListingReviewScreen';
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PostStackParamList } from './navigationTypes';
import { stackOptions, backOptions } from './stackOptions';

import {
  SendParcelScreen,
  CarryParcelScreen,
} from '../features/post-listing/screens/PostScreens';
const Stack = createNativeStackNavigator<PostStackParamList>();
function PostNavigatorContent() {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        ...stackOptions,
        ...backOptions(navigation.goBack),
      })}
    >
      <Stack.Screen
        name="PostListing"
        component={PostListingScreen}
        options={{ title: 'Post a Listing', headerTitleAlign: 'center' }}
      />
      <Stack.Screen
        name="SendParcel"
        component={SendParcelScreen}
        options={{ title: 'Send a parcel' }}
      />
      <Stack.Screen
        name="CarryParcel"
        component={CarryParcelScreen}
        options={{ title: 'Carry a parcel' }}
      />
      <Stack.Screen
        name="ListingReview"
        component={ListingReviewScreen}
        options={{ title: 'Listing Draft', headerTitleAlign: 'center' }}
      />
    </Stack.Navigator>
  );
}

export const PostNavigator = withAccountAccess(
  PostNavigatorContent,
  (props: {
    route: {
      params?: { screen?: string; params?: { type?: 'send' | 'carry' } };
    };
  }) => ({
    type: 'POST_LISTING',
    params: {
      listingType:
        props.route.params?.screen === 'SendParcel'
          ? 'send'
          : props.route.params?.screen === 'CarryParcel'
          ? 'carry'
          : props.route.params?.params?.type,
    },
  }),
);
