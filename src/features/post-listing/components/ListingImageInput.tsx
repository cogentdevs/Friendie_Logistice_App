import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { AppButton } from '../../../components/ui/AppButton';
import { AppText } from '../../../components/ui/AppText';
import { colors } from '../../../theme';
import { useAuthStore } from '../../../store/authStore';
import {
  chooseListingImage,
  ListingImage,
  validateListingImage,
} from '../services/listingImageSelection';
import { listingImageErrorMessage } from '../services/listingImageUploadService';
export function ListingImagePreview({
  uri,
  saved = false,
}: {
  uri: string;
  saved?: boolean;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return failedUri === uri ? (
    <AppText>
      Image preview unavailable. Please select an accessible image.
    </AppText>
  ) : (
    <Image
      accessibilityLabel={
        saved ? 'Saved listing image' : 'Selected listing image preview'
      }
      source={{ uri }}
      resizeMode="contain"
      style={styles.preview}
      onError={() => setFailedUri(uri)}
    />
  );
}
export function ListingImageInput({
  value,
  disabled,
  onChange,
}: {
  value?: ListingImage;
  disabled?: boolean;
  onChange: (image?: ListingImage) => void;
}) {
  const [busy, setBusy] = useState(false);
  const alive = useRef(true),
    flight = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const choose = async () => {
    if (disabled || flight.current) return;
    const owner = useAuthStore.getState().user;
    const current = () =>
      alive.current && owner === useAuthStore.getState().user;
    flight.current = true;
    setBusy(true);
    try {
      const selected = await chooseListingImage();
      if (!current() || !selected) return;
      onChange(selected);
      await validateListingImage(selected);
    } catch (error) {
      if (current())
        Toast.show({
          type: 'error',
          text1: 'Unable to use image',
          text2: listingImageErrorMessage(error),
        });
    } finally {
      flight.current = false;
      if (current()) setBusy(false);
    }
  };
  return (
    <View style={styles.wrap}>
      <AppButton
        title="Choose image"
        variant="secondary"
        disabled={disabled}
        loading={busy}
        onPress={choose}
      />
      {value && (
        <>
          <ListingImagePreview uri={value.uri} />
          <AppText>
            Image selected. It will upload after listing creation.
          </AppText>
          <AppButton
            title="Remove"
            accessibilityLabel="Remove selected image"
            variant="ghost"
            disabled={disabled || busy}
            onPress={() => onChange(undefined)}
          />
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { gap: 8 },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: colors.lightGrey,
  },
});
