import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { X } from 'lucide-react-native';
import { AppInput } from '../../../components/ui/AppInput';
import { AppText } from '../../../components/ui/AppText';
import { colors } from '../../../theme';
import {
  ManualListingPin,
  editManualListingPin,
  parseManualListingPin,
} from '../types/manualListingPin';

export function ManualListingPinInput({
  side,
  value,
  error,
  onChange,
  onBlur,
}: {
  side: 'from' | 'to';
  value?: ManualListingPin;
  error?: string;
  onChange: (value: ManualListingPin) => void;
  onBlur: () => void;
}) {
  const label = `${side === 'from' ? 'From' : 'To'} Location Pin (Optional)`;
  const [blurred, setBlurred] = useState(false);
  const parsed = parseManualListingPin(value?.text ?? '');
  return (
    <View>
      <AppInput
        label={label}
        placeholder="Enter latitude, longitude"
        value={value?.text ?? ''}
        keyboardType="default"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={text => onChange(editManualListingPin(text))}
        onBlur={() => {
          setBlurred(true);
          return onBlur();
        }}
        error={error ?? (blurred && !parsed.valid ? parsed.error : undefined)}
        rightAccessory={
          value?.text ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Clear ${side} location pin`}
              hitSlop={12}
              onPress={() => onChange(editManualListingPin(''))}
            >
              <X size={20} color={colors.text} />
            </Pressable>
          ) : undefined
        }
      />
      <AppText variant="caption" color={colors.text}>
        Copy latitude and longitude from Maps and paste here.
      </AppText>
      <AppText variant="caption" color={colors.textMuted}>
        Exact location pins are private to your account.
      </AppText>
    </View>
  );
}
