import React, { useState } from 'react';
import { Modal } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { KeyboardScreen } from '../../../components/layout/KeyboardScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { AppText } from '../../../components/ui/AppText';
import { AppInput } from '../../../components/ui/AppInput';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
import { ListingLocation } from '../types/listingDraft';
import { ListingReference } from '../services/listingReferencesService';
import { ListingFormField } from './ListingFormField';
import { ListingReferencePicker } from './ListingReferencePicker';

export function ListingLocationPicker({
  title,
  value,
  onSelect,
  onClose,
}: {
  title: string;
  value?: ListingLocation;
  onSelect: (value: ListingLocation) => void;
  onClose: () => void;
}) {
  const [country, setCountry] = useState(value?.country);
  const [city, setCity] = useState(value?.city);
  const [area, setArea] = useState(value?.area?.name ?? '');
  const [picker, setPicker] = useState<'countries' | 'cities' | null>(null);
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeScreen
        backgroundColor={colors.white}
        edges={['top', 'bottom', 'left', 'right']}
      >
        <KeyboardScreen>
          <ScreenContainer backgroundColor={colors.white}>
            <AppText variant="headingMD" accessibilityRole="header">
              {title}
            </AppText>
            <ListingFormField
              icon={MapPin}
              label="Country"
              placeholder="Select country"
              value={country?.name}
              onPress={() => setPicker('countries')}
            />
            <ListingFormField
              icon={MapPin}
              label="City"
              placeholder={country ? 'Select city' : 'Select country first'}
              value={city?.name}
              onPress={() => {
                if (country) setPicker('cities');
              }}
            />
            <AppInput
              label="Area (optional)"
              value={area}
              onChangeText={setArea}
              maxLength={255}
            />
            <AppButton
              title="Apply location"
              disabled={!country || !city || city.countryId !== country.id}
              onPress={() => {
                if (country && city && city.countryId === country.id)
                  onSelect({
                    country,
                    city,
                    source: 'api',
                    ...(area.trim() ? { area: { name: area } } : {}),
                  });
              }}
            />
            <AppButton
              title="Cancel location"
              variant="secondary"
              onPress={onClose}
            />
          </ScreenContainer>
        </KeyboardScreen>
        {picker && (
          <ListingReferencePicker
            key={picker + ':' + country?.id}
            title={picker === 'countries' ? 'Select country' : 'Select city'}
            kind={picker}
            countryId={picker === 'cities' ? country?.id : undefined}
            onClose={() => setPicker(null)}
            onSelect={option => {
              if (typeof option.value === 'string') return;
              const selected: ListingReference = option.value;
              if (picker === 'countries') {
                if (selected.id !== country?.id) setCity(undefined);
                setCountry(selected);
              } else if (
                selected.countryId != null &&
                selected.countryId === country?.id
              )
                setCity({ ...selected, countryId: selected.countryId });
              setPicker(null);
            }}
          />
        )}
      </SafeScreen>
    </Modal>
  );
}
