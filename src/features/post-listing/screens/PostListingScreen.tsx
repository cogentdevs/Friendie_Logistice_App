import { ListingEditLoader } from '../components/ListingEditLoader';
import { EditContext } from '../services/updateListingService';
import { useEditListingDraft } from '../store/editListingDraftStore';
import { ListingImagePreview } from '../components/ListingImageInput';
import { useAuthStore } from '../../../store/authStore';
import { isStaticTestingPreviewActive } from '../../../store/developmentStore';
import { requireAuth } from '../../auth/services/authFlowCoordinator';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
import { MapPin, Package, Plane, CreditCard } from 'lucide-react-native';
import { PostStackParamList } from '../../../navigation/navigationTypes';
import { BackButton } from '../../../navigation/components/BackButton';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { KeyboardScreen } from '../../../components/layout/KeyboardScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { AppText } from '../../../components/ui/AppText';
import { GradientButton } from '../../../components/ui/GradientButton';
import { AppInput } from '../../../components/ui/AppInput';
import { ListingLocationPicker } from '../components/ListingLocationPicker';
import { useListingGps } from '../hooks/useListingGps';
import type { ListingGpsResult } from '../services/listingGpsService';
import { ListingReferencePicker } from '../components/ListingReferencePicker';
import { colors } from '../../../theme';
import { ListingDateField } from '../components/ListingDateField';
import { ListingFormField } from '../components/ListingFormField';
import { useListingDraft } from '../store/listingDraftStore';
import {
  ListingDraft,
  listingDraftSchema,
  listingLocationLabel,
} from '../types/listingDraft';
import { beginListingDraft } from '../services/createListingService';
import { ListingImageInput } from '../components/ListingImageInput';
type Props = NativeStackScreenProps<
  PostStackParamList,
  'PostListing' | 'SendParcel' | 'CarryParcel'
>;
export function PostListingScreen(props: Props) {
  const id =
    props.route.name === 'PostListing'
      ? props.route.params?.editListingId
      : undefined;
  return id ? (
    <ListingEditLoader id={id}>
      {context => <ListingForm key={id} {...props} edit={context} />}
    </ListingEditLoader>
  ) : (
    <ListingForm {...props} />
  );
}
function ListingForm({
  navigation,
  route,
  edit,
}: Props & { edit?: EditContext }) {
  const draftStore = edit ? useEditListingDraft : useListingDraft;
  const account = useAuthStore(state => state.user),
    authStatus = useAuthStore(state => state.status);
  const focused = useIsFocused(),
    height = useHeaderHeight();
  const dirty = draftStore(state => state.dirty);
  const imageRecovery = draftStore(state => state.imageRecovery);
  const initial = useRef(draftStore.getState().values);
  const requested =
    route.name === 'SendParcel'
      ? 'send'
      : route.name === 'CarryParcel'
      ? 'carry'
      : (route.params as { type?: 'send' | 'carry' } | undefined)?.type;
  const first = useRef(true),
    alertOpen = useRef(false),
    continuing = useRef(false),
    leavingEdit = useRef(false);
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const [reference, setReference] = useState<
    'categories' | 'currencies' | null
  >(null);
  const form = useForm<ListingDraft>({
    resolver: zodResolver(listingDraftSchema),
    defaultValues: initial.current,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const { reset } = form;
  useFocusEffect(
    useCallback(() => {
      if (
        useAuthStore.getState().user !== account ||
        useAuthStore.getState().status !== authStatus
      )
        return;
      const stored = draftStore.getState().values;
      const values =
        first.current && requested ? { ...stored, type: requested } : stored;
      first.current = false;
      reset(values);
      if (values.type !== stored.type) draftStore.getState().update(values);
      continuing.current = false;
      leavingEdit.current = false;
    }, [requested, reset, account, authStatus, draftStore]),
  );
  useEffect(() => {
    setPicker(null);
    setReference(null);
  }, [account, authStatus]);
  const values = form.watch(),
    errors = form.formState.errors;
  const activeEdit = () => !edit || useEditListingDraft.getState().listingId === String(edit.original.id);
  const persist = () => {
    if (
      useAuthStore.getState().user === account &&
      useAuthStore.getState().status === authStatus && activeEdit()
    ) {
      const value = form.getValues();
      draftStore.getState().update(value);
      if (edit) edit.draft = value;
    }
  };
  const [detectedOrigin, setDetectedOrigin] = useState<ListingGpsResult>();
  const addressEdited = useRef(false);
  const gps = useListingGps(!edit && focused, () => !form.getValues('from') && !form.getValues('fromAddress')?.trim() && !addressEdited.current && !detectedOrigin, result => {
    setDetectedOrigin(result);
    if (result.address && !addressEdited.current && !form.getValues('fromAddress')?.trim()) {
      form.setValue('fromAddress', result.address, { shouldDirty: true });
      persist();
    }
    if (picker !== 'from' && result.city) {
      form.setValue('from', { country: result.country, city: result.city, source: 'api', ...(result.area ? { area: { name: result.area } } : {}) }, { shouldDirty: true });
      persist();
    }
  });
  useEffect(() => { setDetectedOrigin(undefined); addressEdited.current = false; }, [account, authStatus]);
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
              draftStore.getState().discard();
              if (edit) edit.draft = undefined;
              reset(draftStore.getState().values);
              leave();
            },
          },
          {
            text: 'Keep Draft',
            onPress: () => {
              alertOpen.current = false;
              draftStore.getState().keep();
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
    [reset, draftStore, edit],
  );
  usePreventRemove(focused && dirty, ({ data }) => {
    if (edit && leavingEdit.current) navigation.dispatch(data.action);
    else confirmLeave(() => navigation.dispatch(data.action));
  });
  const back = useCallback(() => {
    Keyboard.dismiss();
    if (edit) {
      const leave = () => {
        leavingEdit.current = true;
        navigation.reset({ index: 0, routes: [{ name: 'PostListing' }] });
        navigation.getParent()?.navigate('ListingsStack', { screen: 'ListingDetails', params: { listingId: String(edit.original.id), returnTo: 'MyListings' } });
      };
      if (draftStore.getState().dirty) confirmLeave(leave); else leave();
      return;
    }
    if (navigation.getState().index > 0) navigation.goBack();
    else {
      const leave = () => navigation.getParent()?.navigate('HomeStack');
      if (draftStore.getState().dirty) confirmLeave(leave);
      else leave();
    }
  }, [navigation, confirmLeave, draftStore, edit]);
  useLayoutEffect(() => {
    navigation.setOptions({
      title: edit ? 'Edit Listing' : 'Post a Listing',
      headerTitleAlign: 'center',
      headerLeft: () => <BackButton onPress={back} />,
    });
  }, [navigation, back, edit]);
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
        useAuthStore.getState().user !== account ||
        useAuthStore.getState().status !== authStatus || !activeEdit()
      )
        return;
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
      draftStore.getState().update(data);
      if (edit) edit.draft = data;
      else beginListingDraft(data);
      if (edit)
        navigation.navigate('ListingReview', {
          editListingId: String(edit.original.id),
        });
      else navigation.navigate('ListingReview');
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
          <Controller
            control={form.control}
            name="title"
            render={({ field, fieldState }) => (
              <AppInput
                label="Title"
                value={field.value ?? ''}
                onChangeText={text => {
                  field.onChange(text);
                  persist();
                }}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                maxLength={255}
              />
            )}
          />
          <ListingFormField
            label="Category"
            icon={Package}
            value={values.category?.name}
            placeholder="Select category"
            error={errors.category?.message}
            onPress={() => {
              Keyboard.dismiss();
              setReference('categories');
            }}
          />
          {!edit && (
            <Controller
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <AppInput
                  label="Description (optional)"
                  multiline
                  value={field.value ?? ''}
                  onChangeText={text => {
                    field.onChange(text);
                    persist();
                  }}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  maxLength={10000}
                />
              )}
            />
          )}
          <ListingFormField
            label="Currency"
            icon={CreditCard}
            value={values.currency}
            placeholder="Select currency"
            error={errors.currency?.message}
            onPress={() => {
              Keyboard.dismiss();
              setReference('currencies');
            }}
          />
          <ListingFormField
            label="From"
            icon={MapPin}
            value={values.from ? listingLocationLabel(values.from) : detectedOrigin?.country.name}
            placeholder="Select country, city or area"
            error={errors.from?.message}
            onPress={() => {
              gps.invalidate();
              Keyboard.dismiss();
              setPicker('from');
            }}
          />
          <Controller
            control={form.control}
            name="fromAddress"
            render={({ field, fieldState }) => (
              <AppInput
                label="From Address"
                placeholder="Enter pickup or departure address"
                value={field.value ?? ''}
                multiline
                maxLength={255}
                error={fieldState.error?.message}
                onBlur={field.onBlur}
                onChangeText={text => {
                  addressEdited.current = true;
                  gps.invalidate();
                  field.onChange(text);
                  persist();
                }}
              />
            )}
          />
          <ListingFormField
            label="To"
            icon={MapPin}
            value={values.to ? listingLocationLabel(values.to) : undefined}
            placeholder="Select country, city or area"
            error={errors.to?.message}
            onPress={() => {
              Keyboard.dismiss();
              setPicker('to');
            }}
          />
          <Controller
            control={form.control}
            name="toAddress"
            render={({ field, fieldState }) => (
              <AppInput
                label="To Address"
                placeholder="Enter delivery or destination address"
                value={field.value ?? ''}
                multiline
                maxLength={255}
                error={fieldState.error?.message}
                onBlur={field.onBlur}
                onChangeText={text => {
                  field.onChange(text);
                  persist();
                }}
              />
            )}
          />
          <ListingDateField
            label="Departure Date"
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
          <ListingDateField
            label="Arrival / Reached Date"
            value={values.reachedOn ?? ''}
            error={errors.reachedOn?.message}
            onChange={date => {
              form.setValue('reachedOn', date, {
                shouldDirty: true,
                shouldValidate: form.formState.isSubmitted,
              });
              persist();
            }}
          />
          {!edit && (
            <Controller
              control={form.control}
              name="weightPrice"
              render={({ field, fieldState }) => (
                <AppInput
                  label="Price per KG (optional)"
                  keyboardType="decimal-pad"
                  value={field.value ?? ''}
                  onChangeText={text => {
                    field.onChange(text);
                    persist();
                  }}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
          )}
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
                        field.onChange(text);
                        persist();
                      }}
                      onBlur={field.onBlur}
                      keyboardType="number-pad"
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
          {!edit && (
            <ListingImageInput
              value={values.image}
              disabled={!!imageRecovery}
              onChange={image => {
                if (
                  useAuthStore.getState().user !== account ||
                  useAuthStore.getState().status !== authStatus
                )
                  return;
                form.setValue('image', image, { shouldDirty: true });
                persist();
              }}
            />
          )}
          {edit?.original.image_url && (
            <ListingImagePreview uri={edit.original.image_url} saved />
          )}
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
        <ListingLocationPicker
          key={picker}
          title={picker === 'from' ? 'From location' : 'To location'}
          value={values[picker]}
          gps={!edit && picker === 'from' ? gps : undefined}
          detected={!edit && picker === 'from' ? detectedOrigin : undefined}
          onClose={() => { gps.invalidate(); if (picker === 'from') setDetectedOrigin(undefined); setPicker(null); }}
          onSelect={location => {
            if (
              useAuthStore.getState().user !== account ||
              useAuthStore.getState().status !== authStatus
            )
              return;
            form.setValue(picker, location, {
              shouldDirty: true,
              shouldValidate: form.formState.isSubmitted,
            });
            if (picker === 'from') { gps.invalidate(); setDetectedOrigin(undefined); }
            persist();
            setPicker(null);
          }}
        />
      )}
      {reference && (
        <ListingReferencePicker
          title={
            reference === 'categories' ? 'Select category' : 'Select currency'
          }
          kind={reference}
          onClose={() => setReference(null)}
          onSelect={option => {
            if (
              useAuthStore.getState().user !== account ||
              useAuthStore.getState().status !== authStatus
            )
              return;
            if (reference === 'categories' && typeof option.value !== 'string')
              form.setValue('category', option.value, {
                shouldDirty: true,
                shouldValidate: form.formState.isSubmitted,
              });
            if (reference === 'currencies' && typeof option.value === 'string')
              form.setValue('currency', option.value, {
                shouldDirty: true,
                shouldValidate: form.formState.isSubmitted,
              });
            persist();
            setReference(null);
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
