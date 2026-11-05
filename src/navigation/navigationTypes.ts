import { NavigatorScreenParams } from '@react-navigation/native';
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string; email?: string };
};
export type HomeStackParamList = {
  Home: undefined;
  Search: undefined;
  Results: undefined;
  ListingDetails: { listingId: string; returnTo?: 'MyListings' };
  Filters: undefined;
};
export type ListingsStackParamList = {
  Listings: undefined;
  Filters: undefined;
  ListingDetails: { listingId: string; returnTo?: 'MyListings' };
};
export type PostStackParamList = {
  PostListing: { type?: 'send' | 'carry' } | undefined;
  ListingReview: undefined;
  SendParcel: undefined;
  CarryParcel: undefined;
};
export type MessagesStackParamList = {
  Conversations: undefined;
  Chat: {
    conversationId: string;
    returnTo?: { stack: 'HomeStack' | 'ListingsStack'; listingId: string };
  };
};
export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
};
export type MainTabParamList = {
  HomeStack: NavigatorScreenParams<HomeStackParamList>;
  ListingsStack: NavigatorScreenParams<ListingsStackParamList>;
  PostListingStack: NavigatorScreenParams<PostStackParamList>;
  MessagesStack: NavigatorScreenParams<MessagesStackParamList>;
  ProfileStack: NavigatorScreenParams<ProfileStackParamList>;
};
export type DrawerParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  MyListings: undefined;
  SavedListings: undefined;
  MyReviews: undefined;
  Notifications: undefined;
  Tracking: undefined;
  Settings: undefined;
  HelpSupport: undefined;
  About: undefined;
};
export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Onboarding: undefined;
  VerifiedReliable: undefined;
  GlobalReach: undefined;
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  AppDrawer: NavigatorScreenParams<DrawerParamList>;
};
