import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ListingsStackParamList } from './navigationTypes';
import { stackOptions, backOptions } from './stackOptions';
import { ListingsScreen } from '../features/listings/screens/ListingsScreen';
import { ListingsFiltersScreen } from '../features/search/screens/FiltersScreen';
import { ListingDetailsScreen } from '../features/listings/screens/ListingDetailsScreen';
const Stack = createNativeStackNavigator<ListingsStackParamList>();
export function ListingsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        ...stackOptions,
        ...backOptions(navigation.goBack),
      })}
    >
      <Stack.Screen
        name="Listings"
        component={ListingsScreen}
        options={{ title: 'Listings', headerTitleAlign: 'center' }}
      />
      <Stack.Screen
        name="Filters"
        component={ListingsFiltersScreen}
        options={{ title: 'Filters', headerTitleAlign: 'center' }}
      />
      <Stack.Screen
        name="ListingDetails"
        component={ListingDetailsScreen}
        options={{ title: 'Listing details' }}
      />
    </Stack.Navigator>
  );
}
