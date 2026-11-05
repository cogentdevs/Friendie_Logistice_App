import React, { useState } from 'react';
import {
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  Bell,
  ClipboardList,
  Heart,
  MapPin,
  MessageCircle,
  Package,
  Plane,
  Search,
  Star,
} from 'lucide-react-native';
import { CompositeScreenProps, useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { DrawerScreenProps } from '@react-navigation/drawer';
import {
  DrawerParamList,
  HomeStackParamList,
  MainTabParamList,
} from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { BrandLogo } from '../../../components/common/BrandLogo';
import { AppAvatar } from '../../../components/ui/AppAvatar';
import { AppText } from '../../../components/ui/AppText';
import { useDevelopmentStore } from '../../../store/developmentStore';
import { useAuthStore } from '../../../store/authStore';
import { useSearchStore } from '../../search/store/searchStore';
import { appConfig } from '../../../constants/appConfig';
import { colors, radius, spacing } from '../../../theme';
import { homeDestinations } from '../data/destinations';
import { homeDevelopmentUser } from '../data/developmentFixtures';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'Home'>,
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, 'HomeStack'>,
    DrawerScreenProps<DrawerParamList, 'MainTabs'>
  >
>;
export function HomeScreen({ navigation }: Props) {
  const focused = useIsFocused();
  const user = useAuthStore(state => state.user);
  const enteredPreview = useDevelopmentStore(state => state.previewActive);
  const preview =
    __DEV__ &&
    (appConfig.navigationPreview ||
      (appConfig.uiPreviewEnabled && enteredPreview)) &&
    !user;
  const name = user?.name.trim() || (preview ? homeDevelopmentUser.name : '');
  const firstName = name.split(/\s+/)[0] || 'there';
  const [query, setQuery] = useState('');
  const search = (destination?: string) => {
    Keyboard.dismiss();
    useSearchStore.getState().resetRoute();
    useSearchStore
      .getState()
      .setFilters(
        destination ? { destination } : { query: query.trim() || undefined },
      );
    navigation.navigate('Search');
  };
  const quickActions = [
    {
      title: 'Listings',
      icon: ClipboardList,
      onPress: () =>
        navigation.navigate('ListingsStack', { screen: 'Listings' }),
    },
    {
      title: 'Saved',
      icon: Heart,
      onPress: () => navigation.navigate('SavedListings'),
    },
    {
      title: 'Messages',
      icon: MessageCircle,
      onPress: () =>
        navigation.navigate('MessagesStack', { screen: 'Conversations' }),
    },
    {
      title: 'Reviews',
      icon: Star,
      onPress: () => navigation.navigate('MyReviews'),
    },
  ];
  return (
    <SafeScreen edges={['top', 'left', 'right']} backgroundColor={colors.white}>
      {focused && <StatusBar barStyle="dark-content" />}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.header}>
          <BrandLogo width={128} />
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => navigation.navigate('Notifications')}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
          >
            <Bell size={25} color={colors.primary} />
          </Pressable>
        </View>
        {preview && enteredPreview && (
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel="Open My Listings"
            onPress={() => navigation.navigate('MyListings')}
            style={styles.previewLink}
          >
            <AppText color={colors.primary}>My Listings</AppText>
          </Pressable>
        )}
        <View style={styles.welcome}>
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() =>
              navigation.navigate('ProfileStack', { screen: 'Profile' })
            }
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          >
            <AppAvatar
              name={name || 'Traveller'}
              uri={user?.avatarUrl}
              size={54}
            />
          </Pressable>
          <View style={styles.welcomeCopy}>
            <AppText
              accessibilityRole="header"
              color={colors.navy}
              style={styles.greeting}
            >
              Hello, {firstName} {'\u{1F44B}'}
            </AppText>
            <AppText style={styles.subtitle}>
              Send, Carry or Receive anywhere in the world.
            </AppText>
            {preview && (
              <AppText variant="caption" color={colors.primary}>
                Development preview
              </AppText>
            )}
          </View>
        </View>
        <View style={[styles.search, styles.shadow]}>
          <TextInput
            accessibilityLabel="Search listings, routes or locations"
            placeholder="Search listings, routes or locations..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => search()}
            maxLength={200}
            autoCorrect={false}
          />
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel="Search listings"
            onPress={() => search()}
            style={({ pressed }) => [
              styles.searchButton,
              pressed && styles.pressed,
            ]}
          >
            <Search size={23} color={colors.white} />
          </Pressable>
        </View>
        <View style={styles.actions}>
          {[
            {
              title: 'Send Parcel',
              description: 'Find travellers to deliver your items',
              icon: Package,
              gradient: [colors.primary, colors.primaryDark],
              screen: 'SendParcel' as const,
            },
            {
              title: 'Carry Parcel',
              description: 'Travelling soon? List your trip',
              icon: Plane,
              gradient: [colors.primaryDark, colors.burgundyDeep],
              screen: 'CarryParcel' as const,
            },
          ].map(({ title, description, icon: Icon, gradient, screen }) => (
            <Pressable
              key={title}
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel={title}
              accessibilityHint={description}
              onPress={() =>
                navigation.navigate('PostListingStack', { screen })
              }
              style={({ pressed }) => [
                styles.actionCard,
                styles.shadow,
                pressed && styles.pressed,
              ]}
            >
              <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionFill}
              >
                <Icon size={32} color={colors.white} strokeWidth={1.8} />
                <AppText color={colors.white} style={styles.actionTitle}>
                  {title}
                </AppText>
                <AppText color={colors.white} style={styles.actionDescription}>
                  {description}
                </AppText>
              </LinearGradient>
            </Pressable>
          ))}
        </View>
        <View style={styles.quickActions}>
          {quickActions.map(({ title, icon: Icon, onPress }) => (
            <Pressable
              key={title}
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel={'Open ' + title}
              onPress={onPress}
              style={({ pressed }) => [
                styles.quickAction,
                styles.shadow,
                pressed && styles.pressed,
              ]}
            >
              <Icon size={25} color={colors.primary} strokeWidth={1.8} />
              <AppText color={colors.navy} style={styles.quickLabel}>
                {title}
              </AppText>
            </Pressable>
          ))}
        </View>
        <View>
          <View style={styles.sectionHeader}>
            <AppText
              accessibilityRole="header"
              color={colors.navy}
              style={styles.sectionTitle}
            >
              Popular Locations
            </AppText>
            <Pressable
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel="View all locations"
              onPress={() => {
                Keyboard.dismiss();
                setQuery('');
                useSearchStore.getState().resetRoute();
                navigation.navigate('Search');
              }}
              style={({ pressed }) => [
                styles.viewAll,
                pressed && styles.pressed,
              ]}
            >
              <AppText color={colors.primary} style={styles.viewAllText}>
                View All
              </AppText>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.destinations}
          >
            {homeDestinations.map(destination => (
              <Pressable
                key={destination.code}
                cssInterop={false}
                accessibilityRole="button"
                accessibilityLabel={'Search listings in ' + destination.country}
                onPress={() => search(destination.country)}
                style={({ pressed }) => [
                  styles.destination,
                  styles.shadow,
                  pressed && styles.pressed,
                ]}
              >
                {destination.photo ? (
                  <Image
                    source={destination.photo}
                    resizeMode={destination.photoFit ?? 'cover'}
                    style={styles.destinationPhoto}
                    accessible={false}
                  />
                ) : (
                  <View style={styles.destinationFallback}>
                    <MapPin size={27} color={colors.primary} />
                    <AppText
                      color={colors.secondary}
                      style={styles.countryCode}
                    >
                      {destination.code}
                    </AppText>
                  </View>
                )}
                <AppText color={colors.navy} style={styles.destinationLabel}>
                  {destination.label}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
          <AppText variant="caption" style={styles.destinationNote}>
            Explore destinations � Photos coming soon
          </AppText>
        </View>
      </ScrollView>
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  previewLink: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 68,
  },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcome: {
    backgroundColor: colors.palePink,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: { minWidth: 54, minHeight: 54 },
  welcomeCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  greeting: { fontSize: 16, lineHeight: 23, fontWeight: '700' },
  subtitle: { fontSize: 12, lineHeight: 17 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
    backgroundColor: colors.white,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.navy,
    fontSize: 12,
  },
  searchButton: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  actionCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.md,
    backgroundColor: colors.primaryDark,
  },
  actionFill: {
    flexGrow: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    minHeight: 148,
    gap: spacing.sm,
  },
  actionTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  actionDescription: { fontSize: 12, lineHeight: 17 },
  quickActions: { flexDirection: 'row', gap: spacing.sm },
  quickAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    paddingVertical: spacing.md,
    paddingHorizontal: 2,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  quickLabel: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: { flex: 1, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  viewAll: { minHeight: 48, justifyContent: 'center', paddingLeft: spacing.sm },
  viewAllText: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  destinations: { gap: spacing.md, paddingBottom: spacing.sm },
  destination: {
    width: 100,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  destinationPhoto: { width: '100%', height: 64 },
  destinationFallback: {
    height: 64,
    backgroundColor: colors.softPink,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  countryCode: { fontSize: 14, fontWeight: '700' },
  destinationLabel: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  destinationNote: { marginTop: spacing.xs },
  shadow: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    shadowOpacity: 0.07,
    elevation: 2,
  },
  pressed: { opacity: 0.7 },
});
