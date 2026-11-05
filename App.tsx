import './global.css';
import React from 'react';
import { StatusBar } from 'react-native';
import { AppProviders } from './src/app/AppProviders';
import { AppBootstrap } from './src/app/AppBootstrap';
import { RootNavigator } from './src/navigation/RootNavigator';
export default function App() {
  return (
    <AppProviders>
      <StatusBar barStyle="dark-content" />
      <AppBootstrap>
        <RootNavigator />
      </AppBootstrap>
    </AppProviders>
  );
}
