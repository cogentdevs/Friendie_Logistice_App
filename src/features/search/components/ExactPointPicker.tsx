import React, { useState } from 'react';
import { Modal } from 'react-native';
import { Coordinates } from '../../location/types/location';
import { validatePoint } from '../../location/services/filterLocationService';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { KeyboardScreen } from '../../../components/layout/KeyboardScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { AppInput } from '../../../components/ui/AppInput';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { GradientButton } from '../../../components/ui/GradientButton';
import { colors } from '../../../theme';
export function ExactPointPicker({
  value,
  onClose,
  onSelect,
}: {
  value?: Coordinates;
  onClose: () => void;
  onSelect: (point: Coordinates) => void;
}) {
  const [latitude, setLatitude] = useState(value?.latitude.toString() ?? ''),
    [longitude, setLongitude] = useState(value?.longitude.toString() ?? ''),
    [error, setError] = useState('');
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeScreen
        edges={['top', 'bottom', 'left', 'right']}
        backgroundColor={colors.white}
      >
        <KeyboardScreen>
          <ScreenContainer backgroundColor={colors.white}>
            <AppText
              accessibilityRole="header"
              variant="headingMD"
              color={colors.navy}
            >
              Exact radius center
            </AppText>
            <AppText variant="bodySmall">
              Enter the exact point you want to search around. This point takes
              priority over an area's reference location.
            </AppText>
            <AppInput
              label="Pin latitude"
              value={latitude}
              onChangeText={setLatitude}
              keyboardType="numbers-and-punctuation"
            />
            <AppInput
              label="Pin longitude"
              value={longitude}
              onChangeText={setLongitude}
              keyboardType="numbers-and-punctuation"
            />
            {!!error && (
              <AppText accessibilityRole="alert" color={colors.danger}>
                {error}
              </AppText>
            )}
            <GradientButton
              title="Use exact point"
              icon="check"
              onPress={() => {
                try {
                  if (!latitude.trim() || !longitude.trim()) throw Error();
                  const point = {
                    latitude: Number(latitude),
                    longitude: Number(longitude),
                  };
                  validatePoint(point);
                  onSelect(point);
                } catch {
                  setError(
                    'Enter valid latitude (-90 to 90) and longitude (-180 to 180).',
                  );
                }
              }}
            />
            <AppButton
              title="Cancel exact point"
              variant="ghost"
              onPress={onClose}
            />
          </ScreenContainer>
        </KeyboardScreen>
      </SafeScreen>
    </Modal>
  );
}
