import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowRight, CalendarDays, Package } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { colors } from '../../../theme';
import { MyListing } from '../services/myListingsService';
import { formatTravelDate } from './ListingCard';
export const MyListingCard = memo(function MyListingCardView({
  item,
  onOpen,
}: {
  item: MyListing;
  onOpen: (id: number) => void;
}) {
  const statusLabel =
    item.status === 'active'
      ? 'Active'
      : item.status === 'completed'
      ? 'Completed'
      : 'Expired';
  const weight = item.weight
    ? item.weight.value +
      ' ' +
      (item.weight.unit === 'kg' ? 'Kg' : item.weight.unit)
    : item.capacityKg !== undefined
    ? item.capacityKg + ' Kg'
    : undefined;
  return (
    <Pressable
      cssInterop={false}
      accessibilityRole="button"
      accessibilityLabel={'Open my listing ' + item.id}
      accessibilityHint={
        item.origin + ' to ' + item.destination + ', ' + statusLabel
      }
      onPress={() => onOpen(item.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <View style={styles.route}>
          <AppText color={colors.navy} style={styles.heading}>
            {item.origin}
          </AppText>
          <ArrowRight size={16} color={colors.primary} />
          <AppText color={colors.navy} style={styles.heading}>
            {item.destination}
          </AppText>
        </View>
        <View
          style={[
            styles.status,
            item.status === 'active'
              ? styles.active
              : item.status === 'expired'
              ? styles.expired
              : styles.completed,
          ]}
        >
          <AppText
            style={styles.statusText}
            color={
              item.status === 'active'
                ? colors.successDark
                : item.status === 'expired'
                ? colors.primaryDark
                : colors.secondary
            }
          >
            {statusLabel}
          </AppText>
        </View>
      </View>
      <View style={styles.type}>
        <AppText color={colors.primaryDark} style={styles.typeText}>
          {item.type === 'carry' ? 'Carry Parcel' : 'Send Parcel'}
        </AppText>
      </View>
      <View style={styles.meta}>
        <View style={styles.detail}>
          <CalendarDays size={16} color={colors.secondary} />
          <AppText style={styles.metaText} color={colors.navy}>
            {formatTravelDate(item.departureDate)}
          </AppText>
        </View>
        <View style={styles.detail}>
          <Package size={16} color={colors.secondary} />
          <AppText style={styles.metaText} color={colors.navy}>
            {weight
              ? (item.type === 'carry' ? 'Up to ' : '') + weight
              : 'Weight not provided'}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
});
const styles = StyleSheet.create({
  card: {
    padding: 15,
    gap: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.white,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  route: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
  },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: '700', flexShrink: 1 },
  status: { borderRadius: 10, paddingVertical: 4, paddingHorizontal: 10 },
  active: { backgroundColor: colors.successSoft },
  expired: { backgroundColor: colors.softPink },
  completed: { backgroundColor: colors.lightGrey },
  statusText: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  type: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: colors.softPink,
  },
  typeText: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 20,
    rowGap: 10,
    paddingTop: 3,
  },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { fontSize: 12, lineHeight: 18, fontWeight: '500' },
  pressed: { opacity: 0.65 },
});
