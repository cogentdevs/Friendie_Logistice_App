import { requireAuth } from '../../auth/services/authFlowCoordinator';
import React, { useState } from 'react';
import {
  Keyboard,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { CompositeScreenProps, useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { DrawerScreenProps } from '@react-navigation/drawer';
import {
  DrawerParamList,
  HomeStackParamList,
  MainTabParamList,
} from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { KeyboardScreen } from '../../../components/layout/KeyboardScreen';
import { AppText } from '../../../components/ui/AppText';
import { useAuthStore } from '../../../store/authStore';
import { useSearchStore, SearchFilters } from '../../search/store/searchStore';
import { colors } from '../../../theme';
import { homeDevelopmentUser } from '../data/developmentFixtures';
import { useHomeData } from '../hooks/useHomeData';
import {
  HomeHeader,
  WelcomeHero,
  ParcelActionCards,
  QuickActions,
} from '../components/HomeEssentials';
import { HomeSearchCard } from '../components/HomeSearchCard';
import {
  CategoriesSection,
  PopularLocationsSection,
  EarnCashBanner,
  HomeCollectionPicker,
  CollectionFeedback,
} from '../components/HomeSections';
import { LatestAdsSection } from '../components/LatestAdsSection';
type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'Home'>,
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, 'HomeStack'>,
    DrawerScreenProps<DrawerParamList, 'MainTabs'>
  >
>;
export function HomeScreen({ navigation }: Props) {
  const focused = useIsFocused(),
    user = useAuthStore(s => s.user),
    data = useHomeData();
  const [directory, setDirectory] = useState<
      'categories' | 'destinations' | null
    >(null),
    [refreshing, setRefreshing] = useState(false);
  const identity =
    (!data.summary.isError && data.summary.data?.id === user?.id
      ? data.summary.data
      : undefined) ?? user;
  const name =
    identity?.name.trim() || (data.preview ? homeDevelopmentUser.name : '');
  const openResults = (filters: SearchFilters = {}) => {
    Keyboard.dismiss();
    useSearchStore.getState().resetRoute();
    useSearchStore.getState().setFilters(filters);
    navigation.navigate('Results');
  };
  const carry = () =>
    requireAuth({ type: 'POST_LISTING', params: { listingType: 'carry' } });
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await data.refresh();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <SafeScreen edges={['top', 'left', 'right']} backgroundColor={colors.white}>
      {focused && <StatusBar barStyle="dark-content" />}
      <KeyboardScreen>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.primary}
              colors={[colors.primary]}
              onRefresh={() => {
                refresh().catch(() => {});
              }}
            />
          }
        >
          <HomeHeader
            onDrawer={() => navigation.openDrawer()}
            onNotifications={() =>
              requireAuth({
                type: 'OPEN_ACCOUNT',
                params: { destination: 'Notifications' },
              })
            }
            unread={data.unread.isError ? undefined : data.unread.data}
          />
          <WelcomeHero
            name={name}
            avatar={identity?.avatarUrl ?? undefined}
            preview={data.preview}
            onProfile={() =>
              navigation.navigate('ProfileStack', { screen: 'Profile' })
            }
            onMyListings={() =>
              requireAuth({
                type: 'OPEN_ACCOUNT',
                params: { destination: 'MyListings' },
              })
            }
          />
          <ParcelActionCards
            onSend={() =>
              requireAuth({
                type: 'POST_LISTING',
                params: { listingType: 'send' },
              })
            }
            onCarry={carry}
          />
          <HomeSearchCard
            categories={data.categories}
            onSearch={openResults}
            onFilters={filters => {
              useSearchStore.getState().resetRoute();
              useSearchStore.getState().setFilters(filters);
              navigation.navigate('Filters');
            }}
          />
          <QuickActions
            onListings={() =>
              navigation.navigate('ListingsStack', { screen: 'Listings' })
            }
            onSaved={() =>
              requireAuth({
                type: 'OPEN_ACCOUNT',
                params: { destination: 'SavedListings' },
              })
            }
            onMessages={() => requireAuth({ type: 'OPEN_MESSAGES' })}
            onReviews={() =>
              requireAuth({
                type: 'OPEN_ACCOUNT',
                params: { destination: 'MyReviews' },
              })
            }
          />
          {data.demo && (
            <AppText variant="caption" color={colors.primary}>
              UI demo: sample categories, destinations, ads and photos.
              Availability and publication order are illustrative.
            </AppText>
          )}
          <CategoriesSection
            query={data.categories}
            onViewAll={() => setDirectory('categories')}
            onSelect={item => openResults({ category: item.id })}
          />
          <PopularLocationsSection
            query={data.destinations}
            onViewAll={() => setDirectory('destinations')}
            onSelect={item => openResults({ destinationCountry: item.country })}
          />
          <LatestAdsSection
            query={data.latest}
            demo={data.demo}
            onOpen={id =>
              navigation.navigate('ListingDetails', { listingId: String(id) })
            }
            onViewAll={() => openResults()}
          />
          <EarnCashBanner
            onPost={carry}
            onBrowse={() => openResults({ type: 'carry' })}
          />
        </ScrollView>
      </KeyboardScreen>
      {directory === 'categories' && (
        <HomeCollectionPicker
          title="Our Categories"
          items={data.categories.isError ? [] : data.categories.data ?? []}
          feedback={
            <CollectionFeedback query={data.categories} label="Categories" />
          }
          onClose={() => setDirectory(null)}
          onSelect={id => {
            setDirectory(null);
            openResults({ category: id });
          }}
        />
      )}
      {directory === 'destinations' && (
        <HomeCollectionPicker
          title="Popular Locations"
          items={
            data.destinations.isError
              ? []
              : (data.destinations.data ?? []).map(d => ({
                  id: String(d.country.id),
                  name: d.country.name,
                }))
          }
          feedback={
            <CollectionFeedback
              query={data.destinations}
              label="Destinations"
            />
          }
          onClose={() => setDirectory(null)}
          onSelect={id => {
            const item = data.destinations.data?.find(
              d => String(d.country.id) === id,
            );
            if (item) {
              setDirectory(null);
              openResults({ destinationCountry: item.country });
            }
          }}
        />
      )}
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 20,
  },
});
