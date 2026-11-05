import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PostStackParamList } from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
import { useListingDraft } from '../store/listingDraftStore';
import { listingDraftSchema } from '../types/listingDraft';
import { displayDate, locationLabel } from '../../search/types/search';
export function ListingReviewScreen({
  navigation,
}: NativeStackScreenProps<PostStackParamList, 'ListingReview'>) {
  const values = useListingDraft(state => state.values),
    valid = listingDraftSchema.safeParse(values).success;
  return (
    <SafeScreen backgroundColor={colors.white}>
      <ScreenContainer backgroundColor={colors.white}>
        <AppText variant="headingMD" color={colors.navy}>
          Review your draft
        </AppText>
        {valid ? (
          <>
            <AppText>
              {values.type === 'carry' ? 'Carry Parcel' : 'Send Parcel'}
            </AppText>
            <AppText>
              {locationLabel(values.from!)}
              {' \u2192 '}
              {locationLabel(values.to!)}
            </AppText>
            <AppText>{displayDate(values.date)}</AppText>
            <AppText>{Number(values.weight)} kg</AppText>
            <AppText>
              Route, date and weight are kept in your draft. Further listing
              details and publishing are not available yet.
            </AppText>
          </>
        ) : (
          <AppText>
            Please complete the route, date and weight before continuing.
          </AppText>
        )}
        <AppButton
          title="Edit listing details"
          onPress={() => {
            if (navigation.getState().index > 0) navigation.goBack();
            else navigation.replace('PostListing');
          }}
        />
      </ScreenContainer>
    </SafeScreen>
  );
}
