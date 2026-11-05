import React, { useState } from 'react';
import { Keyboard, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { KeyboardScreen } from '../../../components/layout/KeyboardScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { AppText } from '../../../components/ui/AppText';
import { AppInput } from '../../../components/ui/AppInput';
import { AppButton } from '../../../components/ui/AppButton';
import { GradientButton } from '../../../components/ui/GradientButton';
import { colors, spacing } from '../../../theme';
import { locationService } from '../services/locationService';
import { RouteLocation, routeLocationSchema } from '../../search/types/search';

type Props = {
  title: string;
  value?: RouteLocation;
  countryHint?: string;
  onSelect: (value: RouteLocation) => void;
  requireCoordinates?: boolean;
  allowGps?: boolean;
  onClose: () => void;
};
export function RouteLocationPicker({
  title,
  value,
  countryHint,
  onSelect,
  onClose,
  requireCoordinates = false,
  allowGps = true,
}: Props) {
  const [country, setCountry] = useState(
    value?.country.name ?? countryHint ?? '',
  );
  const [code, setCode] = useState(value?.country.code ?? '');
  const [city, setCity] = useState(value?.city.name ?? '');
  const [area, setArea] = useState(value?.area?.name ?? '');
  const [latitude, setLatitude] = useState(
    value?.coordinates?.latitude.toString() ?? '',
  );
  const [longitude, setLongitude] = useState(
    value?.coordinates?.longitude.toString() ?? '',
  );
  const [source, setSource] = useState<'gps' | 'manual'>(
    value?.source ?? 'manual',
  );
  const [error, setError] = useState('');
  const gps = useMutation({
    mutationFn: () => locationService.currentPosition(),
  });
  const changeName = (setter: (text: string) => void) => (text: string) => {
    setter(text);
    setLatitude('');
    setLongitude('');
    setSource('manual');
    setError('');
  };
  const select = () => {
    Keyboard.dismiss();
    if (
      !country.trim() ||
      !/^[A-Z]{2}$/.test(code.trim().toUpperCase()) ||
      !city.trim()
    ) {
      setError('Enter a country, its two-letter country code and a city.');
      return;
    }
    if (requireCoordinates && (!latitude.trim() || !longitude.trim())) {
      setError('Enter exact latitude and longitude to set the radius center.');
      return;
    }
    if (Boolean(latitude.trim()) !== Boolean(longitude.trim())) {
      setError('Enter both latitude and longitude, or leave both empty.');
      return;
    }
    const sameCountry =
      value?.country.code === code.trim().toUpperCase() &&
      value.country.name === country.trim();
    const sameCity = sameCountry && value?.city.name === city.trim();
    const sameArea = sameCity && (value?.area?.name ?? '') === area.trim();
    const samePoint =
      value?.coordinates?.latitude ===
        (latitude.trim() ? Number(latitude) : undefined) &&
      value?.coordinates?.longitude ===
        (longitude.trim() ? Number(longitude) : undefined);
    const parsed = routeLocationSchema.safeParse({
      country: {
        name: country.trim(),
        code: code.trim().toUpperCase(),
        id: sameCountry ? value?.country.id : undefined,
      },
      city: { name: city.trim(), id: sameCity ? value?.city.id : undefined },
      area: area.trim()
        ? { name: area.trim(), id: sameArea ? value?.area?.id : undefined }
        : undefined,
      placeId: sameArea && samePoint ? value?.placeId : undefined,
      coordinates: latitude.trim()
        ? { latitude: Number(latitude), longitude: Number(longitude) }
        : undefined,
      source,
    });
    if (!parsed.success) {
      setError(
        'Check the coordinates: latitude must be -90 to 90 and longitude -180 to 180.',
      );
      return;
    }
    onSelect(parsed.data);
  };
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeScreen
        edges={['top', 'bottom', 'left', 'right']}
        backgroundColor={colors.white}
      >
        <KeyboardScreen>
          <ScreenContainer backgroundColor={colors.white}>
            <View style={styles.header}>
              <AppText
                accessibilityRole="header"
                variant="headingMD"
                color={colors.navy}
              >
                {title}
              </AppText>
              <Pressable
                cssInterop={false}
                accessibilityRole="button"
                accessibilityLabel="Close location picker"
                onPress={onClose}
                style={styles.close}
              >
                <AppText color={colors.primary}>Cancel</AppText>
              </Pressable>
            </View>
            <AppText variant="bodySmall">
              Enter the country and city. Add an area or coordinates to choose a
              more precise location.
            </AppText>
            <AppInput
              label="Country"
              value={country}
              onChangeText={text => {
                changeName(setCountry)(text);
                setCode('');
                setCity('');
                setArea('');
              }}
              editable={!gps.isPending}
            />
            <AppInput
              label="Country code (two letters)"
              value={code}
              maxLength={2}
              autoCapitalize="characters"
              onChangeText={text => {
                changeName(setCode)(text);
                setCity('');
                setArea('');
              }}
              editable={!gps.isPending}
            />
            <AppInput
              label="City"
              value={city}
              onChangeText={text => {
                changeName(setCity)(text);
                setArea('');
              }}
              editable={!gps.isPending}
            />
            <AppInput
              label="Area (optional)"
              value={area}
              onChangeText={changeName(setArea)}
              editable={!gps.isPending}
            />
            <AppInput
              label="Latitude (optional)"
              value={latitude}
              onChangeText={text => {
                setLatitude(text);
                setSource('manual');
              }}
              keyboardType="numbers-and-punctuation"
              editable={!gps.isPending}
            />
            <AppInput
              label="Longitude (optional)"
              value={longitude}
              onChangeText={text => {
                setLongitude(text);
                setSource('manual');
              }}
              keyboardType="numbers-and-punctuation"
              editable={!gps.isPending}
            />
            {allowGps && (
              <AppButton
                title="Use current coordinates"
                variant="secondary"
                loading={gps.isPending}
                onPress={async () => {
                  Keyboard.dismiss();
                  setError('');
                  try {
                    const result = await gps.mutateAsync();
                    setLatitude(String(result.latitude));
                    setLongitude(String(result.longitude));
                    setSource('gps');
                  } catch {
                    setError(
                      'Current location is unavailable. Check location permission and device settings, or enter coordinates manually.',
                    );
                  }
                }}
              />
            )}
            {allowGps && (
              <AppText variant="caption">
                GPS supplies coordinates only. Confirm the country, city and
                area before selecting.
              </AppText>
            )}
            {!!error && (
              <AppText
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                color={colors.danger}
              >
                {error}
              </AppText>
            )}
            <GradientButton
              title="Select location"
              icon="check"
              disabled={gps.isPending}
              onPress={select}
            />
          </ScreenContainer>
        </KeyboardScreen>
      </SafeScreen>
    </Modal>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  close: {
    minHeight: 48,
    minWidth: 64,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
});
