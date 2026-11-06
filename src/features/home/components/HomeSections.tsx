import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { MapPin, Package, Plane } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { GradientButton } from '../../../components/ui/GradientButton';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { colors } from '../../../theme';
import {
  CollectionQuery,
  HomeCategory,
  HomeDestinationItem,
} from '../types/home.types';
export function HomeSectionHeader({
  title,
  subtitle,
  action,
  onViewAll,
}: {
  title: string;
  subtitle: string;
  action: string;
  onViewAll: () => void;
}) {
  return (
    <View style={styles.sectionIntro}>
      <View style={styles.titleRow}>
        <AppText
          accessibilityRole="header"
          style={styles.title}
          color={colors.navy}
        >
          {title}
        </AppText>
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          accessibilityLabel={action}
          onPress={onViewAll}
          style={styles.viewAll}
        >
          <AppText color={colors.primary} style={styles.link}>
            View All
          </AppText>
        </Pressable>
      </View>
      <AppText style={styles.subtitle}>{subtitle}</AppText>
    </View>
  );
}
export function CollectionFeedback({
  query,
  label,
}: {
  query: {
    isPending: boolean;
    isError: boolean;
    data?: unknown[];
    refetch: () => Promise<unknown>;
  };
  label: string;
}) {
  if (query.isPending)
    return (
      <View accessibilityLabel={'Loading ' + label} style={styles.loadingRow}>
        {[1, 2, 3].map(i => (
          <View key={i} style={styles.skeleton} />
        ))}
      </View>
    );
  if (query.isError)
    return (
      <View style={styles.feedback}>
        <AppText accessibilityRole="alert">
          {label} are unavailable. Check your connection or try again later.
        </AppText>
        <AppButton
          title={'Retry ' + label}
          onPress={() => {
            query.refetch().catch(() => {});
          }}
        />
      </View>
    );
  if (!query.data?.length)
    return (
      <AppText style={styles.feedback}>
        {`No ${label.toLowerCase()} available yet.`}
      </AppText>
    );
  return null;
}
function CategoryCard({
  item,
  onPress,
}: {
  item: HomeCategory;
  onPress: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <Pressable
      cssInterop={false}
      accessibilityRole="button"
      accessibilityLabel={'Browse category ' + item.name}
      onPress={onPress}
      style={styles.category}
    >
      <View style={styles.categoryIcon}>
        {item.imageUrl && !failed ? (
          <Image
            source={{ uri: item.imageUrl }}
            onError={() => setFailed(true)}
            style={styles.categoryImage}
          />
        ) : (
          <Package size={28} color={colors.primary} />
        )}
      </View>
      <AppText color={colors.navy} style={styles.cardName}>
        {item.name}
      </AppText>
    </Pressable>
  );
}
function LocationCard({
  item,
  onPress,
}: {
  item: HomeDestinationItem;
  onPress: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <Pressable
      cssInterop={false}
      accessibilityRole="button"
      accessibilityLabel={'Search listings in ' + item.country.name}
      onPress={onPress}
      style={styles.location}
    >
      {(item.photo || item.imageUrl) && !failed ? (
        <Image
          source={item.photo ?? { uri: item.imageUrl! }}
          onError={() => setFailed(true)}
          resizeMode="cover"
          style={styles.locationImage}
        />
      ) : (
        <View style={[styles.locationImage, styles.fallback]}>
          <MapPin size={30} color={colors.primary} />
        </View>
      )}
      <AppText color={colors.navy} style={styles.cardName}>
        {item.country.name}
      </AppText>
    </Pressable>
  );
}
export function CategoriesSection({
  query,
  onSelect,
  onViewAll,
}: {
  query: CollectionQuery<HomeCategory>;
  onSelect: (item: HomeCategory) => void;
  onViewAll: () => void;
}) {
  return (
    <View style={styles.section}>
      <HomeSectionHeader
        title="Our Categories"
        subtitle="Carry and Send anything permitted by platform rules."
        action="View all categories"
        onViewAll={onViewAll}
      />
      <CollectionFeedback query={query} label="Categories" />
      {!query.isError && (
        <FlatList
          horizontal
          data={query.data ?? []}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <CategoryCard item={item} onPress={() => onSelect(item)} />
          )}
          contentContainerStyle={styles.carousel}
          showsHorizontalScrollIndicator={false}
        />
      )}
    </View>
  );
}
export function PopularLocationsSection({
  query,
  onSelect,
  onViewAll,
}: {
  query: CollectionQuery<HomeDestinationItem>;
  onSelect: (item: HomeDestinationItem) => void;
  onViewAll: () => void;
}) {
  return (
    <View style={styles.section}>
      <HomeSectionHeader
        title="Popular Locations"
        subtitle="Start by selecting your favourite locations."
        action="View all locations"
        onViewAll={onViewAll}
      />
      <CollectionFeedback query={query} label="Destinations" />
      {!query.isError && (
        <FlatList
          horizontal
          data={query.data ?? []}
          keyExtractor={i => String(i.country.id)}
          renderItem={({ item }) => (
            <LocationCard item={item} onPress={() => onSelect(item)} />
          )}
          contentContainerStyle={styles.carousel}
          showsHorizontalScrollIndicator={false}
        />
      )}
    </View>
  );
}
export function HomeCollectionPicker({
  title,
  items,
  onSelect,
  onClose,
  feedback,
}: {
  title: string;
  items: { id: string; name: string }[];
  onSelect: (id: string) => void;
  onClose: () => void;
  feedback?: React.ReactNode;
}) {
  return (
    <Modal animationType="none" onRequestClose={onClose}>
      <SafeScreen
        edges={['top', 'bottom', 'left', 'right']}
        backgroundColor={colors.white}
      >
        <View style={styles.directoryHeader}>
          <AppText
            accessibilityRole="header"
            variant="headingMD"
            color={colors.navy}
          >
            {title}
          </AppText>
          <AppButton title="Close directory" onPress={onClose} />
        </View>
        {feedback}
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <Pressable
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel={'Choose ' + item.name}
              onPress={() => onSelect(item.id)}
              style={styles.directoryRow}
            >
              <AppText color={colors.navy}>{item.name}</AppText>
            </Pressable>
          )}
        />
      </SafeScreen>
    </Modal>
  );
}
export function EarnCashBanner({
  onPost,
  onBrowse,
}: {
  onPost: () => void;
  onBrowse: () => void;
}) {
  return (
    <View style={styles.promotion}>
      <View style={styles.promoIcon}>
        <Plane size={30} color={colors.primary} />
      </View>
      <AppText
        accessibilityRole="header"
        color={colors.navy}
        style={styles.promoTitle}
      >
        Earn Cash by Carrying Goods
      </AppText>
      <AppText style={styles.promoDescription}>
        List your trip and connect with senders looking for a traveller. Agree
        on permitted items and suitable carrying fees.
      </AppText>
      <GradientButton title="Post Your Ad" onPress={onPost} />
      <AppButton title="Browse Ads" onPress={onBrowse} />
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: 12 },
  sectionIntro: { gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, lineHeight: 25, fontWeight: '700', flex: 1 },
  subtitle: { fontSize: 12, lineHeight: 18 },
  viewAll: { minHeight: 44, justifyContent: 'center', paddingLeft: 8 },
  link: { fontSize: 13, fontWeight: '600' },
  carousel: { gap: 12, paddingBottom: 5 },
  category: {
    width: 116,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 12,
    gap: 10,
    alignItems: 'center',
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.softPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryImage: { width: 56, height: 56, borderRadius: 18 },
  cardName: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
    padding: 6,
  },
  location: {
    width: 146,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  locationImage: { width: '100%', aspectRatio: 1.6 },
  fallback: {
    backgroundColor: colors.softPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: { flexDirection: 'row', gap: 10 },
  skeleton: {
    flex: 1,
    height: 108,
    borderRadius: 14,
    backgroundColor: colors.lightGrey,
  },
  feedback: { paddingVertical: 12, gap: 12 },
  directoryHeader: { padding: 18, gap: 12 },
  directoryRow: {
    padding: 18,
    minHeight: 56,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  promotion: {
    padding: 20,
    gap: 14,
    borderRadius: 20,
    backgroundColor: colors.palePink,
  },
  promoIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.softPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTitle: { fontSize: 22, lineHeight: 29, fontWeight: '700' },
  promoDescription: { fontSize: 14, lineHeight: 22 },
});
