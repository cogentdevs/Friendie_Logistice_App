import { useAuthStore } from '../../../store/authStore';
import { isStaticTestingPreviewActive } from '../../../store/developmentStore';
import { requireAuth } from '../../auth/services/authFlowCoordinator';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Keyboard,
  Pressable,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useFocusEffect,
  useIsFocused,
  usePreventRemove,
} from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MapPin, Package, Plane } from 'lucide-react-native';
import { PostStackParamList } from '../../../navigation/navigationTypes';
import { BackButton } from '../../../navigation/components/BackButton';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { KeyboardScreen } from '../../../components/layout/KeyboardScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { AppText } from '../../../components/ui/AppText';
import { GradientButton } from '../../../components/ui/GradientButton';
import { RouteLocationPicker } from '../../location/components/RouteLocationPicker';
import { locationLabel } from '../../search/types/search';
import { colors } from '../../../theme';
import { ListingDateField } from '../components/ListingDateField';
import { ListingFormField } from '../components/ListingFormField';
import { useListingDraft } from '../store/listingDraftStore';
import { ListingDraft, listingDraftSchema } from '../types/listingDraft';
type Props = NativeStackScreenProps<
  PostStackParamList,
  'PostListing' | 'SendParcel' | 'CarryParcel'
>;
export function PostListingScreen({ navigation, route }: Props) {
  const focused = useIsFocused(),
    height = useHeaderHeight();
  const dirty = useListingDraft(state => state.dirty);
  const initial = useRef(useListingDraft.getState().values);
  const requested =
    route.name === 'SendParcel'
      ? 'send'
      : route.name === 'CarryParcel'
      ? 'carry'
      : route.params?.type;
  const first = useRef(true),
    alertOpen = useRef(false),
    continuing = useRef(false);
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const form = useForm<ListingDraft>({
    resolver: zodResolver(listingDraftSchema),
    defaultValues: initial.current,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const { reset } = form;
  useFocusEffect(
    useCallback(() => {
      const stored = useListingDraft.getState().values;
      const values =
        first.current && requested ? { ...stored, type: requested } : stored;
      first.current = false;
      reset(values);
      if (values.type !== stored.type)
        useListingDraft.getState().update(values);
      continuing.current = false;
    }, [requested, reset]),
  );
  const values = form.watch(),
    errors = form.formState.errors;
  const persist = () => useListingDraft.getState().update(form.getValues());
  const confirmLeave = useCallback(
    (leave: () => void) => {
      if (alertOpen.current) return;
      alertOpen.current = true;
      Keyboard.dismiss();
      Alert.alert(
        'Keep your listing draft?',
        'Keep this draft while you use the app, or discard your changes.',
        [
          {
            text: 'Stay',
            style: 'cancel',
            onPress: () => {
              alertOpen.current = false;
            },
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              alertOpen.current = false;
              useListingDraft.getState().discard();
              reset(useListingDraft.getState().values);
              leave();
            },
          },
          {
            text: 'Keep Draft',
            onPress: () => {
              alertOpen.current = false;
              useListingDraft.getState().keep();
              leave();
            },
          },
        ],
        {
          cancelable: true,
          onDismiss: () => {
            alertOpen.current = false;
          },
        },
      );
    },
    [reset],
  );
  usePreventRemove(focused && dirty, ({ data }) =>
    confirmLeave(() => navigation.dispatch(data.action)),
  );
  const back = useCallback(() => {
    Keyboard.dismiss();
    if (navigation.getState().index > 0) navigation.goBack();
    else {
      const leave = () => navigation.getParent()?.navigate('HomeStack');
      if (useListingDraft.getState().dirty) confirmLeave(leave);
      else leave();
    }
  }, [navigation, confirmLeave]);
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Post a Listing',
      headerTitleAlign: 'center',
      headerLeft: () => <BackButton onPress={back} />,
    });
  }, [navigation, back]);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        back();
        return true;
      });
      return () => sub.remove();
    }, [back]),
  );
  const next = form.handleSubmit(
    data => {
      if (
        useAuthStore.getState().status !== 'authenticated' &&
        !isStaticTestingPreviewActive()
      ) {
        requireAuth({
          type: 'POST_LISTING',
          params: { listingType: data.type },
        });
        return;
      }
      if (continuing.current) return;
      continuing.current = true;
      Keyboard.dismiss();
      useListingDraft.getState().update(data);
      navigation.navigate('ListingReview');
    },
    () => Keyboard.dismiss(),
  );
  const weightLabel =
    values.type === 'carry' ? 'Carrying Capacity' : 'Parcel Weight';
  return (
    <SafeScreen backgroundColor={colors.white}>
      {focused && <StatusBar barStyle="dark-content" />}
      <KeyboardScreen offset={height}>
        <ScreenContainer backgroundColor={colors.white} style={styles.content}>
          <View style={styles.cards} accessibilityRole="radiogroup">
            {(
              [
                {
                  type: 'send',
                  label: 'Send Parcel',
                  description: 'Find a traveller to deliver your item',
                  icon: Package,
                },
                {
                  type: 'carry',
                  label: 'Carry Parcel',
                  description: 'List your travel & carry items for others',
                  icon: Plane,
                },
              ] as const
            ).map(({ type, label, description, icon: Icon }) => {
              const selected = values.type === type;
              return (
                <Pressable
                  key={type}
                  cssInterop={false}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ checked: selected, selected }}
                  onPress={() => {
                    form.setValue('type', type, { shouldDirty: true });
                    persist();
                    if (form.formState.isSubmitted)
                      form.trigger().catch(() => {});
                  }}
                  style={[styles.card, selected && styles.selected]}
                >
                  <Icon
                    size={30}
                    color={selected ? colors.white : colors.primary}
                  />
                  <AppText
                    color={selected ? colors.white : colors.navy}
                    style={styles.cardTitle}
                  >
                    {label}
                  </AppText>
                  <AppText
                    color={selected ? colors.white : colors.text}
                    style={styles.description}
                  >
                    {description}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <ListingFormField
            label="From"
            icon={MapPin}
            value={values.from ? locationLabel(values.from) : undefined}
            placeholder="Select country, city or area"
            error={errors.from?.message}
            onPress={() => {
              Keyboard.dismiss();
              setPicker('from');
            }}
          />
          <ListingFormField
            label="To"
            icon={MapPin}
            value={values.to ? locationLabel(values.to) : undefined}
            placeholder="Select country, city or area"
            error={errors.to?.message}
            onPress={() => {
              Keyboard.dismiss();
              setPicker('to');
            }}
          />
          <ListingDateField
            label={values.type === 'carry' ? 'Travel Date' : 'Delivery Date'}
            value={values.date}
            error={errors.date?.message}
            onChange={date => {
              form.setValue('date', date, {
                shouldDirty: true,
                shouldValidate: form.formState.isSubmitted,
              });
              persist();
            }}
          />
          <Controller
            control={form.control}
            name="weight"
            render={({ field, fieldState }) => (
              <View style={styles.weightWrap}>
                <View
                  style={[
                    styles.weightField,
                    !!fieldState.error && styles.invalid,
                  ]}
                >
                  <Package size={22} color={colors.primary} />
                  <View style={styles.weightText}>
                    <AppText color={colors.navy} style={styles.fieldLabel}>
                      {weightLabel}
                    </AppText>
                    <TextInput
                      ref={field.ref}
                      accessibilityLabel={weightLabel}
                      placeholder={
                        values.type === 'carry'
                          ? 'Enter max weight (e.g. 20)'
                          : 'Enter parcel weight (e.g. 5)'
                      }
                      placeholderTextColor={colors.textMuted}
                      value={field.value}
                      onChangeText={text => {
                        field.onChange(text.replace(',', '.'));
                        persist();
                      }}
                      onBlur={field.onBlur}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                      maxLength={24}
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.unit}>
                    <AppText color={colors.navy} style={styles.unitText}>
                      Kg
                    </AppText>
                  </View>
                </View>
                {!!fieldState.error && (
                  <AppText
                    accessibilityRole="alert"
                    color={colors.danger}
                    style={styles.error}
                  >
                    {fieldState.error.message}
                  </AppText>
                )}
              </View>
            )}
          />
        </ScreenContainer>
        <View style={styles.footer}>
          <GradientButton
            title="Continue"
            onPress={next}
            loading={form.formState.isSubmitting}
          />
        </View>
      </KeyboardScreen>
      {picker && (
        <RouteLocationPicker
          title={picker === 'from' ? 'From location' : 'To location'}
          value={values[picker]}
          onClose={() => setPicker(null)}
          onSelect={location => {
            form.setValue(picker, location, {
              shouldDirty: true,
              shouldValidate: form.formState.isSubmitted,
            });
            persist();
            setPicker(null);
          }}
        />
      )}
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  content: {
    maxWidth: 600,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  cards: { flexDirection: 'row', gap: 12 },
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 142,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  cardTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  weightWrap: { gap: 4 },
  weightField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  weightText: { flex: 1 },
  fieldLabel: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  input: {
    fontSize: 13,
    lineHeight: 19,
    minHeight: 44,
    padding: 0,
    color: colors.navy,
  },
  unit: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.lightGrey,
  },
  unitText: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  invalid: { borderColor: colors.danger },
  error: { fontSize: 12, lineHeight: 17 },
  footer: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    backgroundColor: colors.white,
  },
});
