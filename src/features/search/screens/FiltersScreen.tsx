import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {
  NativeStackScreenProps,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import {
  Check,
  ChevronDown,
  Crosshair,
  Globe2,
  MapPin,
} from 'lucide-react-native';
import { ListingsStackParamList } from '../../../navigation/navigationTypes';
import { BackButton } from '../../../navigation/components/BackButton';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { GradientButton } from '../../../components/ui/GradientButton';
import { RouteLocationPicker } from '../../location/components/RouteLocationPicker';
import { useLocationFilters } from '../../location/hooks/useLocationFilters';
import { useSearchStore } from '../store/searchStore';
import { locationLabel, RouteLocation } from '../types/search';
import { ExactPointPicker } from '../components/ExactPointPicker';
import { RadiusSlider } from '../components/RadiusSlider';
import { colors, radius, spacing } from '../../../theme';
type Props = {
  route?: { key: string; name: string };
  navigation: {
    getState: () => { routes: { name: string }[]; index: number };
    goBack: () => void;
    replace: (name: 'Search') => void;
    setOptions: (options: Partial<NativeStackNavigationOptions>) => void;
  };
};
export function FiltersScreen({ navigation }: Props) {
  const focused = useIsFocused();
  const draft = useLocationFilters();
  const [picker, setPicker] = useState<'choices' | 'edit' | 'pin' | null>(null);
  const [field, setField] = useState('Country');
  const from = useSearchStore(state => state.filters.from),
    to = useSearchStore(state => state.filters.to);
  const reset = draft.reset;
  const back = useCallback(() => {
    if (
      navigation
        .getState()
        .routes.some(route =>
          ['Home', 'Search', 'Results', 'Listings'].includes(route.name),
        )
    )
      navigation.goBack();
    else navigation.replace('Search');
  }, [navigation]);
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => <BackButton onPress={back} />,
      headerRight: () => (
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          accessibilityLabel="Reset filters"
          onPress={reset}
          style={styles.reset}
        >
          <AppText color={colors.primary} style={styles.resetText}>
            Reset
          </AppText>
        </Pressable>
      ),
    });
  }, [navigation, reset, back]);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        const state = navigation.getState();
        if (
          state.routes.some(route =>
            ['Home', 'Search', 'Results', 'Listings'].includes(route.name),
          ) &&
          state.index > 0
        )
          return false;
        navigation.replace('Search');
        return true;
      });
      return () => sub.remove();
    }, [navigation]),
  );
  const reference = draft.manual?.reference;
  const choose = (value: RouteLocation) => {
    setPicker(null);
    draft.resolveManual(value);
  };
  const locationFields = [
    {
      label: 'Country',
      value:
        draft.mode === 'gps'
          ? draft.gps?.address?.countryName
          : reference?.country.name,
    },
    {
      label: 'City',
      value:
        draft.mode === 'gps' ? draft.gps?.address?.city : reference?.city.name,
    },
    {
      label: 'Area (Optional)',
      value:
        draft.mode === 'gps' ? draft.gps?.address?.area : reference?.area?.name,
    },
  ];
  return (
    <SafeScreen
      edges={['left', 'right', 'bottom']}
      backgroundColor={colors.white}
    >
      {focused && <StatusBar barStyle="dark-content" />}
      <ScreenContainer backgroundColor={colors.white} style={styles.content}>
        <AppText
          accessibilityRole="header"
          color={colors.navy}
          style={styles.heading}
        >
          Location Mode
        </AppText>
        <View style={styles.modes}>
          {(
            [
              { mode: 'gps', label: 'My Current Location', icon: Crosshair },
              {
                mode: 'manual',
                label: 'Select Location Manually',
                icon: MapPin,
              },
            ] as const
          ).map(({ mode, label, icon: Icon }) => (
            <Pressable
              key={mode}
              cssInterop={false}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{
                selected: draft.mode === mode,
                checked: draft.mode === mode,
              }}
              onPress={() => {
                if (mode === 'gps') draft.selectGps();
                else draft.selectManual();
              }}
              style={({ pressed }) => [
                styles.mode,
                draft.mode === mode && styles.modeSelected,
                pressed && styles.pressed,
              ]}
            >
              <Icon
                size={25}
                color={draft.mode === mode ? colors.white : colors.navy}
              />
              <AppText
                color={draft.mode === mode ? colors.white : colors.navy}
                style={styles.modeLabel}
              >
                {label}
              </AppText>
            </Pressable>
          ))}
        </View>
        <Pressable
          cssInterop={false}
          accessibilityRole="radio"
          accessibilityLabel="Search worldwide"
          accessibilityState={{ checked: draft.mode === 'worldwide' }}
          onPress={draft.worldwide}
          style={styles.worldwide}
        >
          <Globe2 size={18} color={colors.primary} />
          <AppText color={colors.primary} variant="bodySmall">
            {draft.mode === 'worldwide'
              ? 'Worldwide - no location restrictions'
              : 'Search worldwide'}
          </AppText>
        </Pressable>
        {draft.pending && (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <AppText accessibilityLiveRegion="polite">
              {draft.mode === 'gps'
                ? 'Getting your current location...'
                : 'Resolving selected location...'}
            </AppText>
          </View>
        )}
        {!!draft.problem && (
          <View style={styles.problem}>
            <AppText
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              color={colors.danger}
            >
              {draft.problem.message}
            </AppText>
            {['blocked', 'disabled', 'inaccurate'].includes(
              draft.problem.reason,
            ) && (
              <AppButton
                title="Open location settings"
                variant="ghost"
                onPress={draft.openSettings}
              />
            )}
          </View>
        )}
        {draft.mode === 'gps' && !draft.pending && !draft.problem && (
          <AppText variant="caption">
            {draft.gps
              ? 'GPS point selected. Accuracy approximately ' +
                Math.round(draft.gps.accuracyMeters) +
                ' m.'
              : 'Tap My Current Location to get a fresh GPS point.'}
          </AppText>
        )}
        {draft.mode === 'manual' && (
          <AppText variant="caption">
            {draft.manual
              ? 'Manual point selected. Exact coordinates take priority over area references.'
              : 'Choose a resolved location or enter an exact point.'}
          </AppText>
        )}
        {draft.mode === 'gps' && !!draft.gps?.addressMessage && (
          <AppText variant="caption" accessibilityLiveRegion="polite">
            Address labels are unavailable or incomplete. Your device point is
            retained for radius search; switch to manual mode to edit the
            address.
          </AppText>
        )}
        <View>
          <View style={styles.radiusHeader}>
            <AppText color={colors.navy} style={styles.heading}>
              Search Radius
            </AppText>
            <AppText color={colors.primary} style={styles.radiusValue}>
              {draft.radiusKm} km
            </AppText>
          </View>
          <RadiusSlider
            value={draft.radiusKm}
            onChange={draft.setRadius}
            disabled={draft.mode === 'worldwide'}
          />
          <View style={styles.endpoints}>
            <AppText variant="caption">1 km</AppText>
            <AppText variant="caption">200 km</AppText>
          </View>
        </View>
        <View style={styles.matchRow}>
          <AppText variant="bodySmall" color={colors.navy}>
            Radius matches
          </AppText>
          <View style={styles.targets}>
            {(['origin', 'destination'] as const).map(target => (
              <Pressable
                key={target}
                cssInterop={false}
                accessibilityRole="radio"
                accessibilityLabel={'Match ' + target}
                accessibilityState={{
                  checked: draft.target === target,
                  disabled: draft.mode === 'worldwide',
                }}
                disabled={draft.mode === 'worldwide'}
                onPress={() => draft.setFlags({ target })}
                style={[
                  styles.target,
                  draft.target === target && styles.targetSelected,
                ]}
              >
                <AppText
                  color={draft.target === target ? colors.primary : colors.text}
                  variant="caption"
                >
                  {target === 'origin' ? 'From' : 'To'}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.fields}>
          {locationFields.map(item => (
            <View key={item.label} style={styles.fieldGroup}>
              <AppText color={colors.navy} style={styles.fieldLabel}>
                {item.label}
              </AppText>
              <Pressable
                cssInterop={false}
                accessibilityRole="button"
                accessibilityLabel={'Choose filter ' + item.label}
                accessibilityState={{
                  disabled: draft.mode !== 'manual' || draft.pending,
                }}
                disabled={draft.mode !== 'manual' || draft.pending}
                onPress={() => {
                  setField(item.label);
                  setPicker('choices');
                }}
                style={({ pressed }) => [
                  styles.field,
                  pressed && styles.pressed,
                ]}
              >
                <AppText
                  color={item.value ? colors.navy : colors.textMuted}
                  variant="bodySmall"
                  style={styles.fieldValue}
                >
                  {item.value ??
                    (draft.mode === 'manual'
                      ? 'Select ' + item.label.replace(' (Optional)', '')
                      : draft.mode === 'gps'
                      ? 'Not available'
                      : 'Any ' +
                        item.label.replace(' (Optional)', '').toLowerCase())}
                </AppText>
                <ChevronDown size={18} color={colors.secondary} />
              </Pressable>
            </View>
          ))}
        </View>
        <AppText
          accessibilityRole="header"
          color={colors.navy}
          style={styles.heading}
        >
          Other Filters
        </AppText>
        {(
          [
            {
              label: 'Verified Users Only',
              checked: draft.verifiedOnly,
              key: 'verifiedOnly',
            },
            {
              label: 'Show Available Now',
              checked: draft.availableNow,
              key: 'availableNow',
            },
          ] as const
        ).map(item => (
          <Pressable
            key={item.key}
            cssInterop={false}
            accessibilityRole="checkbox"
            accessibilityLabel={item.label}
            accessibilityState={{ checked: item.checked }}
            onPress={() => draft.setFlags({ [item.key]: !item.checked })}
            style={styles.checkboxRow}
          >
            <View style={[styles.checkbox, item.checked && styles.checked]}>
              {item.checked && <Check size={16} color={colors.white} />}
            </View>
            <AppText color={colors.navy} variant="bodySmall">
              {item.label}
            </AppText>
          </Pressable>
        ))}
      </ScreenContainer>
      <View style={styles.footer}>
        <GradientButton
          title="Apply Filters"
          icon="none"
          disabled={!draft.canApply}
          loading={draft.pending}
          onPress={() => {
            if (draft.apply()) back();
          }}
        />
      </View>
      {picker === 'choices' && (
        <Modal animationType="slide" onRequestClose={() => setPicker(null)}>
          <SafeScreen
            edges={['top', 'bottom', 'left', 'right']}
            backgroundColor={colors.white}
          >
            <ScreenContainer backgroundColor={colors.white}>
              <AppText
                accessibilityRole="header"
                variant="headingMD"
                color={colors.navy}
              >
                Select {field}
              </AppText>
              <AppText variant="bodySmall">
                Choose a known route point or enter a precise manual location.
              </AppText>
              {(
                [
                  { name: 'From', value: from },
                  { name: 'To', value: to },
                ] as const
              )
                .filter(item => item.value)
                .map(item => (
                  <AppButton
                    key={item.name}
                    title={
                      'Use ' +
                      item.name +
                      ' location: ' +
                      locationLabel(item.value!)
                    }
                    variant="secondary"
                    onPress={() => choose(item.value!)}
                  />
                ))}
              <AppButton
                title="Set exact map coordinates"
                variant="secondary"
                onPress={() => setPicker('pin')}
              />
              <AppButton
                title="Enter or edit a location / exact point"
                onPress={() => setPicker('edit')}
              />
              <AppButton
                title="Cancel location selection"
                variant="ghost"
                onPress={() => setPicker(null)}
              />
            </ScreenContainer>
          </SafeScreen>
        </Modal>
      )}
      {picker === 'pin' && (
        <ExactPointPicker
          value={draft.manual?.coordinates}
          onClose={() => setPicker(null)}
          onSelect={point => {
            draft.setExactPin(point);
            setPicker(null);
          }}
        />
      )}
      {picker === 'edit' && (
        <RouteLocationPicker
          title="Manual radius location"
          value={reference}
          initialPoint={draft.manual?.coordinates}
          initialAddress={draft.manual?.address}
          requireCoordinates
          onSelect={choose}
          onClose={() => setPicker(null)}
        />
      )}
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  content: {
    maxWidth: 560,
    paddingHorizontal: 18,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  heading: { fontSize: 16, lineHeight: 23, fontWeight: '700' },
  reset: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  resetText: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  modes: { flexDirection: 'row', gap: spacing.md },
  mode: {
    flex: 1,
    minWidth: 0,
    minHeight: 96,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  modeSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeLabel: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    fontWeight: '600',
  },
  worldwide: {
    minHeight: 48,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  loading: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  problem: { gap: spacing.xs },
  radiusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radiusValue: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  endpoints: { flexDirection: 'row', justifyContent: 'space-between' },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  targets: { flexDirection: 'row' },
  target: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  targetSelected: { backgroundColor: colors.softPink },
  fields: { gap: spacing.md },
  fieldGroup: { gap: spacing.xs },
  fieldLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fieldValue: { flex: 1, minWidth: 0 },
  checkboxRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { backgroundColor: colors.primary, borderColor: colors.primary },
  footer: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.65 },
});

export function ListingsFiltersScreen({
  navigation,
}: NativeStackScreenProps<ListingsStackParamList, 'Filters'>) {
  return (
    <FiltersScreen
      navigation={{
        getState: navigation.getState,
        goBack: navigation.goBack,
        setOptions: navigation.setOptions,
        replace: () => navigation.replace('Listings'),
      }}
    />
  );
}
