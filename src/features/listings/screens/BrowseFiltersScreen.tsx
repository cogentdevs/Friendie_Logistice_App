import React, { useLayoutEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ListingsStackParamList } from '../../../navigation/navigationTypes';
import { FiltersScreen } from '../../search/screens/FiltersScreen';
import { useSearchStore } from '../../search/store/searchStore';
import { useLocationStore } from '../../location/store/locationStore';
import { useFilterDraftStore } from '../../search/store/filterDraftStore';
import { useBrowseFiltersStore } from '../store/browseFiltersStore';

// Reuse the existing filter editor as a temporary editing workspace. Its stores
// are restored on exit so a tab filter never destroys the Home search or radius.
export function BrowseFiltersScreen({
  navigation,
}: NativeStackScreenProps<ListingsStackParamList, 'Filters'>) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const homeFilters = useSearchStore.getState().filters;
    const homeLocation = useLocationStore.getState().selection;
    const browse = useBrowseFiltersStore.getState();
    useSearchStore.setState({ filters: browse.filters });
    useLocationStore.setState({ selection: browse.location });
    useFilterDraftStore.getState().syncApplied();
    setReady(true);
    return () => {
      useBrowseFiltersStore.setState({
        filters: useSearchStore.getState().filters,
        location: useLocationStore.getState().selection,
      });
      useSearchStore.setState({ filters: homeFilters });
      useLocationStore.setState({ selection: homeLocation });
      useFilterDraftStore.getState().syncApplied();
    };
  }, []);
  if (!ready)
    return <ActivityIndicator accessibilityLabel="Loading listing filters" />;
  return (
    <FiltersScreen
      navigation={{
        getState: navigation.getState,
        goBack: navigation.goBack,
        setOptions: navigation.setOptions,
        replace: () => navigation.replace('Listings'),
      }}
    />
  );
}
