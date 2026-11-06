import React, { memo, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  CalendarDays,
  Check,
  Heart,
  MapPin,
  Star,
  UserRound,
} from 'lucide-react-native';
import { Listing } from '../services/listingsService';
import { AppText } from '../../../components/ui/AppText';
import { colors } from '../../../theme';
export function formatPrice(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return currency + ' ' + amount.toFixed(2);
  }
}
export function formatTravelDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return 'Date unavailable';
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  )
    return 'Date unavailable';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
export const ListingCard = memo(function ListingCardView({
  item,
  saved,
  saving,
  onOpen,
  onSave,
  showSummary = false,
  coverSource,
}: {
  item: Listing;
  showSummary?: boolean;
  coverSource?: ImageSourcePropType;
  saved: boolean;
  saving: boolean;
  onOpen: (id: number) => void;
  onSave: (id: number) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const traveller = item.traveller;
  return (
    <View style={styles.card}>
      <Pressable
        cssInterop={false}
        accessibilityRole="button"
        accessibilityLabel={'Open listing ' + item.title}
        onPress={() => onOpen(item.id)}
        style={styles.main}
      >
        {showSummary && (
          <View style={styles.summary}>
            {!coverFailed && (coverSource || item.coverImageUrl) ? (
              <Image
                source={coverSource ?? { uri: item.coverImageUrl! }}
                onError={() => setCoverFailed(true)}
                style={styles.cover}
                accessible={false}
              />
            ) : (
              <View style={styles.coverFallback}>
                <MapPin size={30} color={colors.primary} />
              </View>
            )}
            <AppText color={colors.primary} variant="caption">
              {item.type === 'carry' ? 'Carry Parcel' : 'Send Parcel'}
            </AppText>
            <AppText color={colors.navy} style={styles.summaryTitle}>
              {item.title}
            </AppText>
          </View>
        )}
        <View style={styles.top}>
          <View style={styles.avatar}>
            {traveller?.avatarUrl && !imageFailed ? (
              <Image
                source={{ uri: traveller.avatarUrl }}
                onError={() => setImageFailed(true)}
                style={styles.image}
                accessibilityLabel={traveller.name + ' avatar'}
              />
            ) : (
              <UserRound size={25} color={colors.secondary} />
            )}
          </View>
          <View style={styles.identity}>
            <View style={styles.nameRow}>
              <AppText color={colors.navy} style={styles.name}>
                {traveller?.name ?? item.title}
              </AppText>
              {traveller?.verified === true && (
                <View
                  accessibilityLabel="Verified account"
                  style={styles.verified}
                >
                  <Check size={11} color={colors.white} />
                </View>
              )}
            </View>
            {traveller?.rating != null ? (
              <View style={styles.rating}>
                <Star size={15} fill={colors.warning} color={colors.warning} />
                <AppText variant="caption">
                  {traveller.rating.toFixed(1)}
                  {traveller.reviewCount !== undefined
                    ? ' (' + traveller.reviewCount + ')'
                    : ''}
                </AppText>
              </View>
            ) : (
              <AppText variant="caption">
                {item.type === 'carry' ? 'Carry Parcel' : 'Send Parcel'}
              </AppText>
            )}
          </View>
          <View style={styles.heartSpace} />
        </View>
        <View style={styles.badge}>
          <AppText color={colors.primaryDark} style={styles.badgeText}>
            {item.type === 'carry' ? 'Carries' : 'Send'}
            {item.capacityKg !== undefined
              ? ' ' + item.capacityKg + ' Kg'
              : ' Parcel'}
          </AppText>
        </View>
        <View style={styles.bottom}>
          <View style={styles.routeInfo}>
            <View style={styles.detail}>
              <MapPin size={14} color={colors.secondary} />
              <AppText color={colors.navy} style={styles.route}>
                {item.origin + ' \u2192 ' + item.destination}
              </AppText>
            </View>
            <View style={styles.detail}>
              <CalendarDays size={14} color={colors.text} />
              <AppText variant="caption">
                {formatTravelDate(item.departureDate)}
              </AppText>
            </View>
          </View>
          <AppText color={colors.primary} style={styles.price}>
            {formatPrice(item.price, item.currency)}
          </AppText>
        </View>
      </Pressable>
      <Pressable
        cssInterop={false}
        accessibilityRole="button"
        accessibilityLabel={
          (saved ? 'Unsave' : 'Save') +
          ' listing ' +
          item.id +
          ' on this device'
        }
        accessibilityState={{ selected: saved, disabled: saving }}
        disabled={saving}
        onPress={() => onSave(item.id)}
        style={styles.heart}
      >
        <Heart
          size={23}
          color={saved ? colors.primary : colors.secondary}
          fill={saved ? colors.primary : colors.white}
        />
      </Pressable>
    </View>
  );
});
const styles = StyleSheet.create({
  summary: { gap: 8 },
  cover: { width: '100%', aspectRatio: 2, borderRadius: 12 },
  coverFallback: {
    height: 90,
    backgroundColor: colors.softPink,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: { fontWeight: '700' },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    shadowColor: colors.navy,
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  main: { padding: 14, gap: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lightGrey,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  identity: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 14, lineHeight: 20, fontWeight: '700', flexShrink: 1 },
  verified: {
    borderRadius: 10,
    width: 15,
    height: 15,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heartSpace: { width: 34 },
  heart: {
    position: 'absolute',
    right: 4,
    top: 6,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.softPink,
    paddingHorizontal: 14,
    paddingVertical: 3,
    borderRadius: 14,
  },
  badgeText: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  routeInfo: { flexGrow: 1, flexShrink: 1, gap: 4 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  route: { fontSize: 13, lineHeight: 19, fontWeight: '600', flexShrink: 1 },
  price: { fontSize: 19, lineHeight: 26, fontWeight: '800', flexShrink: 1 },
});
