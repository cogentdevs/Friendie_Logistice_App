import { HomeResultsScreen } from '../features/listings/screens/ListingsScreen';
import { ListingDetailsScreen } from '../features/listings/screens/ListingDetailsScreen';
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeStackParamList } from './navigationTypes';
import { stackOptions, backOptions } from './stackOptions';
import { BackButton } from './components/BackButton';
import { HomeScreen } from '../features/home/screens/HomeScreen';
import { SearchScreen } from '../features/search/screens/SearchScreen';
import { FiltersScreen } from '../features/search/screens/FiltersScreen';
const Stack = createNativeStackNavigator<HomeStackParamList>();
export function HomeNavigator() {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        ...stackOptions,
        ...backOptions(navigation.goBack),
      })}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={({ navigation }) => ({
          title: 'Search Listings',
          headerTitleAlign: 'center',
          headerLeft: () => (
            <BackButton
              onPress={() => {
                if (
                  navigation
                    .getState()
                    .routes.some(route => route.name === 'Home')
                )
                  navigation.goBack();
                else navigation.replace('Home');
              }}
            />
          ),
        })}
      />
      <Stack.Screen
        name="Results"
        component={HomeResultsScreen}
        options={{ title: 'Listings', headerTitleAlign: 'center' }}
      />
      <Stack.Screen
        name="ListingDetails"
        component={ListingDetailsScreen}
        options={{ title: 'Listing details' }}
      />
      <Stack.Screen
        name="Filters"
        component={FiltersScreen}
        options={{ title: 'Filters', headerTitleAlign: 'center' }}
      />
    </Stack.Navigator>
  );
}
