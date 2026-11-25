import React from 'react';
import { View } from 'react-native';
import { AppBadge } from '../../../components/ui/AppBadge';
import { AppText } from '../../../components/ui/AppText';
import {
  AvailabilityFields,
  availabilityLabel,
  remainingLabel,
} from '../services/listingAvailability';
export function ListingAvailability({ availability }: AvailabilityFields) {
  return (
    <View>
      <AppBadge label={availabilityLabel(availability)} />
      <AppText variant="caption">{remainingLabel(availability)}</AppText>
    </View>
  );
}
