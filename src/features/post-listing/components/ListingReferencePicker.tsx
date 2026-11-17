import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Modal } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
import {
  getListingReferences,
  ReferenceKind,
  ReferenceOption,
} from '../services/listingReferencesService';

export function ListingReferencePicker({
  title,
  kind,
  countryId,
  onSelect,
  onClose,
}: {
  title: string;
  kind: ReferenceKind;
  countryId?: number;
  onSelect: (option: ReferenceOption) => void;
  onClose: () => void;
}) {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const query = useQuery({
    queryKey: ['listingReferences', kind, countryId ?? null],
    queryFn: ({ signal }) => getListingReferences(kind, countryId, signal),
    staleTime: 30000,
    retry: false,
  });
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeScreen
        backgroundColor={colors.white}
        edges={['top', 'bottom', 'left', 'right']}
      >
        <ScreenContainer backgroundColor={colors.white}>
          <AppText variant="headingMD" accessibilityRole="header">
            {title}
          </AppText>
          {query.isPending && (
            <ActivityIndicator accessibilityLabel="Loading options" />
          )}
          {query.isError && (
            <>
              <AppText>Unable to load options. Please try again.</AppText>
              <AppButton
                title="Retry options"
                onPress={async () => {
                  const result = await query.refetch();
                  if (mounted.current && result.isError)
                    Toast.show({
                      type: 'error',
                      text1: 'Options unavailable',
                      text2:
                        'Unable to load listing options. Please try again.',
                    });
                }}
              />
            </>
          )}
          {query.isSuccess && !query.data.length && (
            <AppText>No options available.</AppText>
          )}
          {query.data?.map(option => (
            <AppButton
              key={option.key}
              title={option.label}
              variant="ghost"
              onPress={() => onSelect(option)}
            />
          ))}
          <AppButton
            title="Cancel selection"
            variant="secondary"
            onPress={onClose}
          />
        </ScreenContainer>
      </SafeScreen>
    </Modal>
  );
}
