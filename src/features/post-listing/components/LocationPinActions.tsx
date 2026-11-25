import React, { useEffect, useRef } from 'react';
import { AppState, Linking } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import { AppButton } from '../../../components/ui/AppButton';
import { parseManualListingPin } from '../types/manualListingPin';

// Authorization is checked at the deliberate action, not inferred from coordinates.
export function LocationPinActions({
  text,
  label,
  isAuthorized,
}: {
  text: string;
  label: string;
  isAuthorized: () => boolean;
}) {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const parsed = parseManualListingPin(text);
  if (!parsed.valid || !parsed.coordinates || !isAuthorized()) return null;
  const open = async () => {
    if (
      !mounted.current ||
      AppState.currentState !== 'active' ||
      !isAuthorized()
    )
      return;
    const current = parseManualListingPin(text);
    if (!current.valid || !current.coordinates) return;
    const { latitude, longitude } = current.coordinates;
    try {
      await Linking.openURL(
        'https://www.google.com/maps/search/?api=1&query=' +
          encodeURIComponent(latitude + ', ' + longitude),
      );
    } catch {
      if (mounted.current && isAuthorized())
        Toast.show({
          type: 'error',
          text1: 'Maps unavailable',
          text2: 'Unable to open Google Maps. Please try again.',
        });
    }
  };
  const copy = () => {
    if (
      !mounted.current ||
      AppState.currentState !== 'active' ||
      !isAuthorized()
    )
      return;
    try {
      Clipboard.setString(text);
      Toast.show({ type: 'success', text1: 'Location copied' });
    } catch {
      if (isAuthorized())
        Toast.show({
          type: 'error',
          text1: 'Unable to copy location',
          text2: 'You can select the coordinate text and copy it.',
        });
    }
  };
  return (
    <>
      <AppButton
        title="Copy Location"
        accessibilityLabel={label + ' - Copy Location'}
        variant="secondary"
        onPress={copy}
      />
      <AppButton
        title="Open in Google Maps"
        accessibilityLabel={label + ' - Open in Google Maps'}
        variant="secondary"
        onPress={() => {
          open().catch(() => {});
        }}
      />
    </>
  );
}
