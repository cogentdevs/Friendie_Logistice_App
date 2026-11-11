import React, { useEffect, useRef, useState } from 'react';
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
import { detectCurrentLocation } from '../services/currentLocationService';
import { locationProblem } from '../services/filterLocationService';
import type { Coordinates, ResolvedAddress } from '../types/location';
import { RouteLocation, routeLocationSchema } from '../../search/types/search';

type Props = {
  title: string;
  value?: RouteLocation;
  countryHint?: string;
  onSelect: (value: RouteLocation) => void;
  requireCoordinates?: boolean;
  allowGps?: boolean;
  initialPoint?: Coordinates;
  initialAddress?: ResolvedAddress;
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
  initialPoint,
  initialAddress,
}: Props) {
  const [country, setCountry] = useState(
    value?.country.name ?? initialAddress?.countryName ?? countryHint ?? '',
  );
  const [code, setCode] = useState(
    value?.country.code ?? initialAddress?.countryCode ?? '',
  );
  const [city, setCity] = useState(
    value?.city.name ?? initialAddress?.city ?? '',
  );
  const [area, setArea] = useState(
    value?.area?.name ?? initialAddress?.area ?? '',
  );
  const [coordinates, setCoordinates] = useState<Coordinates | undefined>(
    value?.coordinates ?? initialPoint,
  );
  const [source, setSource] = useState<'gps' | 'manual'>(
    value?.source ?? 'manual',
  );
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const missingLabels = useRef(
    new Set(
      initialPoint
        ? Object.entries({ country, code, city, area })
            .filter(([, text]) => !text)
            .map(([field]) => field)
        : [],
    ),
  );
  const generation = useRef(0);
  const inFlight = useRef(false);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const gps = useMutation({
    mutationFn: detectCurrentLocation,
  });
  const changeName =
    (setter: (text: string) => void, field: string) => (text: string) => {
      setter(text);
      // Completing missing labels after geocoder failure keeps the actual GPS point.
      // Editing a resolved address means a new manual place, not the old GPS point.
      if (!missingLabels.current.has(field)) {
        setCoordinates(undefined);
        setSource('manual');
        setNotice('');
        missingLabels.current.clear();
      }
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
    if (requireCoordinates && !coordinates) {
      setError(
        'Use Current Location or select an existing resolved point to set the radius center.',
      );
      return;
    }
    const sameCountry =
      value?.country.code === code.trim().toUpperCase() &&
      value.country.name === country.trim();
    const sameCity = sameCountry && value?.city.name === city.trim();
    const sameArea = sameCity && (value?.area?.name ?? '') === area.trim();
    const samePoint =
      value?.coordinates?.latitude === coordinates?.latitude &&
      value?.coordinates?.longitude === coordinates?.longitude;
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
      coordinates,
      source,
    });
    if (!parsed.success) {
      setError('Check the selected location and try again.');
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
              Use your current location to fill this form, or enter the country,
              city and optional area manually.
            </AppText>
            <AppInput
              label="Country"
              value={country}
              onChangeText={text => {
                changeName(setCountry, 'country')(text);
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
                changeName(setCode, 'code')(text);
                setCity('');
                setArea('');
              }}
              editable={!gps.isPending}
            />
            <AppInput
              label="City"
              value={city}
              onChangeText={text => {
                changeName(setCity, 'city')(text);
                setArea('');
              }}
              editable={!gps.isPending}
            />
            <AppInput
              label="Area (optional)"
              value={area}
              onChangeText={changeName(setArea, 'area')}
              editable={!gps.isPending}
            />
            {allowGps && (
              <AppButton
                title="Use Current Location"
                variant="secondary"
                loading={gps.isPending}
                onPress={async () => {
                  if (inFlight.current) return;
                  inFlight.current = true;
                  const request = ++generation.current;
                  Keyboard.dismiss();
                  setError('');
                  setNotice('');
                  try {
                    const result = await gps.mutateAsync();
                    if (generation.current !== request) return;
                    setCoordinates({
                      latitude: result.latitude,
                      longitude: result.longitude,
                    });
                    setCountry(result.address.countryName ?? '');
                    setCode(result.address.countryCode ?? '');
                    setCity(result.address.city ?? '');
                    setArea(result.address.area ?? '');
                    setSource('gps');
                    missingLabels.current = new Set(
                      Object.entries({
                        country: result.address.countryName,
                        code: result.address.countryCode,
                        city: result.address.city,
                        area: result.address.area,
                      })
                        .filter(([, text]) => !text)
                        .map(([field]) => field),
                    );
                    setNotice(
                      result.addressMessage ??
                        'Location detected. You can review or edit the address before selecting.',
                    );
                  } catch (problem) {
                    if (generation.current === request)
                      setError(locationProblem(problem).message);
                  } finally {
                    inFlight.current = false;
                  }
                }}
              />
            )}
            {!!notice && (
              <AppText variant="caption" accessibilityLiveRegion="polite">
                {notice}
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
