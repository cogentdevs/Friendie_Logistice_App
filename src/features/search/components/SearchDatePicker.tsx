import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { GradientButton } from '../../../components/ui/GradientButton';
import { colors, radius } from '../../../theme';
import { DateRange, displayRange, localDate } from '../types/search';
export function SearchDatePicker({
  value,
  mode = 'range',
  title = 'Travel / Delivery Date',
  onApply,
  onClose,
}: {
  value?: DateRange;
  mode?: 'single' | 'range';
  title?: string;
  onApply: (range?: DateRange) => void;
  onClose: () => void;
}) {
  const today = localDate(new Date());
  const [month, setMonth] = useState(() => {
    const d = value?.start ? new Date(value.start + 'T12:00:00') : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [start, setStart] = useState<string | undefined>(value?.start);
  const [end, setEnd] = useState<string | undefined>(value?.end);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const selected = start ? { start, end: end ?? start } : undefined;
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
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
            {title}
          </AppText>
          <AppText>
            {mode === 'single'
              ? 'Choose a date for your listing.'
              : 'Choose a start date, then an end date. A single selected day is also supported.'}
          </AppText>
          <View style={styles.header}>
            <Pressable
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              style={styles.control}
              onPress={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft color={colors.primary} />
            </Pressable>
            <AppText color={colors.navy} style={styles.month}>
              {month.toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric',
              })}
            </AppText>
            <Pressable
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel="Next month"
              style={styles.control}
              onPress={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight color={colors.primary} />
            </Pressable>
          </View>
          <View style={styles.grid}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <View key={day} style={styles.cell}>
                <AppText variant="caption">{day}</AppText>
              </View>
            ))}
          </View>
          <View style={styles.grid}>
            {Array.from({ length: firstDay + count }, (_, index) => {
              if (index < firstDay)
                return <View key={'blank' + index} style={styles.cell} />;
              const day = index - firstDay + 1,
                date = localDate(
                  new Date(month.getFullYear(), month.getMonth(), day),
                );
              const active = Boolean(
                  start && date >= start && date <= (end ?? start),
                ),
                disabled = date < today;
              return (
                <Pressable
                  key={date}
                  cssInterop={false}
                  accessibilityRole="button"
                  accessibilityLabel={'Choose ' + date}
                  accessibilityState={{ selected: active, disabled }}
                  disabled={disabled}
                  style={[
                    styles.cell,
                    active && styles.selected,
                    disabled && styles.disabled,
                  ]}
                  onPress={() => {
                    if (mode === 'single') {
                      setStart(date);
                      setEnd(date);
                      return;
                    }
                    if (!start || end) {
                      setStart(date);
                      setEnd(undefined);
                    } else if (date < start) {
                      setStart(date);
                      setEnd(start);
                    } else setEnd(date);
                  }}
                >
                  <AppText color={active ? colors.white : colors.navy}>
                    {day}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <AppText accessibilityLiveRegion="polite">
            {displayRange(selected)}
          </AppText>
          <GradientButton
            title={mode === 'single' ? 'Apply date' : 'Apply dates'}
            icon="check"
            onPress={() => onApply(selected)}
          />
          <AppButton
            title={mode === 'single' ? 'Clear date' : 'Any date'}
            variant="secondary"
            onPress={() => onApply(undefined)}
          />
          <AppButton title="Cancel dates" variant="ghost" onPress={onClose} />
        </ScreenContainer>
      </SafeScreen>
    </Modal>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  month: { flex: 1, textAlign: 'center' },
  control: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.2857%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  selected: { backgroundColor: colors.primary },
  disabled: { opacity: 0.3 },
});
