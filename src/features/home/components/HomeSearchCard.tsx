import React, { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CalendarDays,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { LocationField } from '../../search/components/LocationField';
import { GradientButton } from '../../../components/ui/GradientButton';
import { colors } from '../../../theme';
import { SearchFilters, useSearchStore } from '../../search/store/searchStore';
import { locationLabel } from '../../search/types/search';
import { RouteLocationPicker } from '../../location/components/RouteLocationPicker';
import { SearchDatePicker } from '../../search/components/SearchDatePicker';
import { CollectionQuery, HomeCategory } from '../types/home.types';
import { homeSearchSchema, HomeSearchValues } from '../types/homeSearchSchema';
import { CollectionFeedback, HomeCollectionPicker } from './HomeSections';
export function HomeSearchCard({
  categories,
  onSearch,
  onFilters,
}: {
  categories: CollectionQuery<HomeCategory>;
  onSearch: (filters: SearchFilters) => void;
  onFilters: (filters: SearchFilters) => void;
}) {
  const initial = useSearchStore(state => state.filters);
  const form = useForm<HomeSearchValues>({
    resolver: zodResolver(homeSearchSchema),
    mode: 'onBlur',
    defaultValues: {
      type: initial.type ?? 'send',
      query: initial.query ?? '',
      category: initial.category ?? '',
      weight: initial.weightKg?.toString() ?? '',
      from: initial.from ?? null,
      to: initial.to ?? null,
      dates: initial.dates,
    },
  });
  const [picker, setPicker] = useState<
    'from' | 'to' | 'dates' | 'category' | null
  >(null);
  const values = form.watch();
  useEffect(() => {
    form.reset({
      type: initial.type ?? 'send',
      query: initial.query ?? '',
      category: initial.category ?? '',
      weight: initial.weightKg?.toString() ?? '',
      from: initial.from ?? null,
      to: initial.to ?? null,
      dates: initial.dates,
    });
  }, [initial, form]);
  const submit = () => {
    if (form.formState.isSubmitting) return;
    form
      .handleSubmit(() => {
        Keyboard.dismiss();
        onSearch(snapshot());
      })()
      .catch(() => {});
  };
  const snapshot = (): SearchFilters => {
    const v = form.getValues();
    return {
      type: v.type,
      query: v.query.trim() || undefined,
      category: v.category || undefined,
      weightKg: v.weight ? Number(v.weight) : undefined,
      from: v.from ?? undefined,
      to: v.to ?? undefined,
      dates: v.dates,
    };
  };
  const open = () => {
    Keyboard.dismiss();
    const weight = form.getValues('weight');
    if (
      weight &&
      (!/^\d+(\.\d+)?$/.test(weight) ||
        !Number.isFinite(Number(weight)) ||
        Number(weight) <= 0)
    ) {
      form.setError('weight', { message: 'Enter a positive weight in kg' });
      return;
    }
    onFilters(snapshot());
  };
  const errors = form.formState.errors;
  return (
    <View style={styles.card}>
      <AppText
        accessibilityRole="header"
        style={styles.title}
        color={colors.navy}
      >
        Search Listings
      </AppText>
      <View style={styles.quickSearch}>
        <Controller
          control={form.control}
          name="query"
          render={({ field: { value, onChange } }) => (
            <TextInput
              accessibilityLabel="Search listings, routes or locations"
              placeholder="Search listings, routes or locations..."
              placeholderTextColor={colors.textMuted}
              value={value}
              onChangeText={onChange}
              maxLength={200}
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={submit}
              style={styles.query}
            />
          )}
        />
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          accessibilityLabel="Submit keyword and selected filters"
          onPress={submit}
          style={styles.searchIcon}
        >
          <Search size={22} color={colors.white} />
        </Pressable>
      </View>
      <View style={styles.group}>
        <View style={styles.flex}>
          <AppText variant="caption">Listing Type</AppText>
          <View style={styles.segments}>
            {(['send', 'carry'] as const).map(type => (
              <Pressable
                cssInterop={false}
                key={type}
                accessibilityRole="radio"
                accessibilityLabel={'Search type ' + type}
                accessibilityState={{ checked: values.type === type }}
                onPress={() =>
                  form.setValue('type', type, { shouldDirty: true })
                }
                style={[
                  styles.segment,
                  values.type === type && styles.selected,
                ]}
              >
                <AppText
                  color={values.type === type ? colors.white : colors.navy}
                  style={styles.segmentText}
                >
                  {type === 'send' ? 'Send Parcel' : 'Carry Parcel'}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          accessibilityLabel="Select search category"
          onPress={() => setPicker('category')}
          style={styles.route}
        >
          <View style={styles.flex}>
            <AppText variant="caption">Category</AppText>
            <AppText color={colors.navy}>
              {categories.data?.find(c => c.id === values.category)?.name ??
                'Any Category'}
            </AppText>
          </View>
          <ChevronRight size={16} color={colors.primary} />
        </Pressable>
      </View>
      {(['from', 'to'] as const).map(field => (
        <View key={field}>
          <LocationField
            label={field === 'from' ? 'From' : 'Destination'}
            value={values[field] ? locationLabel(values[field]!) : undefined}
            accessibilityLabel={
              field === 'from'
                ? 'Select search origin'
                : 'Select search destination'
            }
            onPress={() => {
              Keyboard.dismiss();
              setPicker(field);
            }}
          />
          {errors[field]?.message && (
            <AppText
              accessibilityLiveRegion="polite"
              color={colors.danger}
              variant="caption"
            >
              {errors[field]?.message}
            </AppText>
          )}
        </View>
      ))}
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="caption">Weight (Kg)</AppText>
          <Controller
            control={form.control}
            name="weight"
            render={({
              field: { value, onChange, onBlur, ref },
              fieldState,
            }) => (
              <>
                <View
                  style={[styles.route, fieldState.error && styles.invalid]}
                >
                  <TextInput
                    ref={ref}
                    accessibilityLabel="Weight (Kg, optional)"
                    placeholder="e.g. 5"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    style={styles.weightInput}
                  />
                </View>
                {fieldState.error && (
                  <AppText
                    variant="caption"
                    color={colors.danger}
                    accessibilityLiveRegion="polite"
                  >
                    {fieldState.error.message}
                  </AppText>
                )}
              </>
            )}
          />
        </View>
        <View style={styles.flex}>
          <AppText variant="caption">Travel Date</AppText>
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel="Select home travel date"
            onPress={() => {
              Keyboard.dismiss();
              setPicker('dates');
            }}
            style={styles.route}
          >
            <CalendarDays size={18} color={colors.primary} />
            <AppText color={colors.navy} style={styles.dateText}>
              {values.dates?.start ?? 'Select date'}
            </AppText>
          </Pressable>
          {errors.dates?.message && (
            <AppText color={colors.danger} variant="caption">
              {errors.dates.message}
            </AppText>
          )}
        </View>
      </View>
      <GradientButton
        title="Search Listings"
        icon="none"
        onPress={submit}
        loading={form.formState.isSubmitting}
      />
      <Pressable
        cssInterop={false}
        accessibilityRole="button"
        accessibilityLabel="Open Home advanced filters"
        onPress={open}
        style={styles.filters}
      >
        <SlidersHorizontal size={19} color={colors.primary} />
        <AppText color={colors.primary} style={styles.filterText}>
          Advanced Filters
        </AppText>
      </Pressable>
      {(picker === 'from' || picker === 'to') && (
        <RouteLocationPicker
          title={picker === 'from' ? 'From Location' : 'Destination'}
          value={values[picker] ?? undefined}
          onClose={() => setPicker(null)}
          onSelect={value => {
            form.setValue(picker, value, {
              shouldDirty: true,
              shouldValidate: true,
            });
            setPicker(null);
          }}
        />
      )}
      {picker === 'dates' && (
        <SearchDatePicker
          mode="single"
          title="Travel On"
          value={values.dates}
          onClose={() => setPicker(null)}
          onApply={value => {
            form.setValue('dates', value, {
              shouldDirty: true,
              shouldValidate: true,
            });
            setPicker(null);
          }}
        />
      )}
      {picker === 'category' && (
        <HomeCollectionPicker
          title="Select category"
          items={[
            { id: '', name: 'Any Category' },
            ...(categories.isError ? [] : categories.data ?? []),
          ]}
          feedback={
            <CollectionFeedback query={categories} label="Categories" />
          }
          onClose={() => setPicker(null)}
          onSelect={id => {
            form.setValue('category', id, { shouldDirty: true });
            setPicker(null);
          }}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.white,
    padding: 16,
    gap: 14,
    shadowColor: colors.navy,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  title: { fontSize: 18, lineHeight: 25, fontWeight: '700' },
  quickSearch: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    flexDirection: 'row',
    padding: 4,
    alignItems: 'center',
  },
  query: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    color: colors.navy,
    fontSize: 14,
    paddingHorizontal: 8,
  },
  searchIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1, minWidth: 0, gap: 6 },
  dateText: { flex: 1, minWidth: 0, fontSize: 13 },
  segments: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 3,
    flexDirection: 'row',
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  selected: { backgroundColor: colors.primary },
  segmentText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
  route: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    minHeight: 56,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  invalid: { borderColor: colors.danger },
  weightInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 28,
    padding: 0,
    fontSize: 14,
    color: colors.navy,
  },
  filters: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  filterText: { fontSize: 13, fontWeight: '600' },
});
