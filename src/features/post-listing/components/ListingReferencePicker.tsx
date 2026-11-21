import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { AppInput } from '../../../components/ui/AppInput';
import { KeyboardScreen } from '../../../components/layout/KeyboardScreen';
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
  const [search, setSearch] = useState('');
  useEffect(() => setSearch(''), [kind, countryId]);
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
  // These endpoints return complete lists, not pages. Filter only the current
  // country-scoped query; never reuse another country's options as placeholder data.
  const term = search.trim().toLowerCase();
  const options = Array.from(
    new Map((query.data ?? []).map(option => [option.key, option])).values(),
  ).filter(option => option.label.toLowerCase().includes(term));
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
            <AppInput
              label="Search options"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {!!search && (
              <AppButton
                title="Clear search"
                variant="ghost"
                onPress={() => setSearch('')}
              />
            )}
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
            {query.isSuccess && !!query.data.length && !options.length && (
              <AppText accessibilityLiveRegion="polite">
                No matching options.
              </AppText>
            )}
            {options.map(option => (
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
        </KeyboardScreen>
      </SafeScreen>
    </Modal>
  );
}
