import React from 'react';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PostStackParamList } from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
import { useListingDraft } from '../store/listingDraftStore';
import {
  listingDraftSchema,
  listingLocationLabel,
} from '../types/listingDraft';
import { displayDate } from '../../search/types/search';
import { useCreateListing } from '../hooks/useCreateListing';
import { ListingImagePreview } from '../components/ListingImageInput';
export function ListingReviewScreen({
  navigation,
}: NativeStackScreenProps<PostStackParamList, 'ListingReview'>) {
  const values = useListingDraft(state => state.values),
    valid = listingDraftSchema.safeParse(values).success;
  const create = useCreateListing(useIsFocused(), id =>
    navigation.getParent()?.navigate('ListingsStack', {
      screen: 'ListingDetails',
      params: { listingId: String(id), returnTo: 'MyListings' },
    }),
  );
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
            <AppText>{values.title}</AppText>
            <AppText>
              {values.category?.name} · {values.currency}
            </AppText>
            <AppText>
              {listingLocationLabel(values.from!)}
              {' \u2192 '}
              {listingLocationLabel(values.to!)}
            </AppText>
            <AppText>Departure: {displayDate(values.date)}</AppText>
            <AppText>Arrival: {displayDate(values.reachedOn!)}</AppText>
            {!!values.weight.trim() && (
              <AppText>{Number(values.weight)} kg</AppText>
            )}
            <AppText>
              Your listing will be Pending approval after creation.
            </AppText>
          </>
        ) : (
          <AppText>
            Please complete all required listing fields before continuing.
          </AppText>
        )}
        {Object.entries(create.errors).map(([field, messages]) => (
          <AppText key={field} accessibilityRole="alert" color={colors.danger}>
            {field}: {messages.join(' ')}
          </AppText>
        ))}
        {(create.recovery?.image || values.image) && (
          <ListingImagePreview
            uri={
              create.recovery?.imageUrl ??
              create.recovery?.image.uri ??
              values.image!.uri
            }
            saved={!!create.recovery?.imageUrl}
          />
        )}
        {create.recovery && (
          <AppText accessibilityLiveRegion="polite">
            {`Listing ${create.recovery.listing.id} created. `}
            {create.recovery.phase === 'uploading'
              ? 'Uploading image...'
              : create.recovery.phase === 'failed'
              ? 'Image upload failed. Your image is saved for image-only retry.'
              : create.recovery.phase === 'unknown'
              ? 'Image upload outcome is uncertain. Retry is disabled. Check the authoritative listing image before proceeding.'
              : create.recovery.phase === 'uploaded'
              ? 'Image uploaded successfully.'
              : 'Image upload has not started.'}
          </AppText>
        )}
        {create.recovery && create.recovery.phase !== 'uploaded' && (
          <AppButton
            title="Retry image upload"
            loading={create.busy}
            disabled={create.recovery.phase !== 'failed'}
            onPress={create.retryImage}
          />
        )}
        {create.held === 'confirmed' && (
          <AppText>
            This listing was already created. Check My Listings for its Pending
            record.
          </AppText>
        )}
        {create.held === 'unknown' && (
          <AppText accessibilityRole="alert">
            Creation is not confirmed. Your draft is saved. Check My Listings
            before creating another listing. This submission will not be
            automatically retried.
          </AppText>
        )}
        <AppButton
          title="Create listing"
          loading={create.busy}
          disabled={!valid || !!create.held}
          onPress={create.submit}
        />
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
