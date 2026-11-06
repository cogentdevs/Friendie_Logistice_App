import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  Bell,
  Menu,
  ClipboardList,
  Heart,
  MessageCircle,
  Package,
  Plane,
  Star,
} from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { AppAvatar } from '../../../components/ui/AppAvatar';
import { BrandLogo } from '../../../components/common/BrandLogo';
import { colors } from '../../../theme';
export function HomeHeader({
  onDrawer,
  onNotifications,
  unread,
}: {
  onDrawer: () => void;
  onNotifications: () => void;
  unread?: number;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          accessibilityLabel="Open navigation menu"
          onPress={onDrawer}
          style={styles.icon}
        >
          <Menu size={23} color={colors.primary} />
        </Pressable>
        <BrandLogo width={128} />
      </View>
      <Pressable
        cssInterop={false}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        onPress={onNotifications}
        style={styles.icon}
      >
        <Bell size={25} color={colors.primary} />
        {unread !== undefined && Number.isInteger(unread) && unread > 0 && (
          <View style={styles.count}>
            <AppText color={colors.white} variant="caption">
              {unread}
            </AppText>
          </View>
        )}
      </Pressable>
    </View>
  );
}
export function WelcomeHero({
  name,
  avatar,
  preview,
  onProfile,
  onMyListings,
}: {
  name: string;
  avatar?: string;
  preview: boolean;
  onProfile: () => void;
  onMyListings: () => void;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.greetingRow}>
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={onProfile}
        >
          <AppAvatar name={name || 'Traveller'} uri={avatar} size={48} />
        </Pressable>
        <View style={styles.copy}>
          <AppText color={colors.navy} style={styles.greeting}>
            Hello, {name.split(/\s+/)[0] || 'there'} {'\u{1F44B}'}
          </AppText>
          <AppText variant="caption">
            Connect with travellers and senders.
          </AppText>
        </View>
      </View>
      <AppText
        accessibilityRole="header"
        style={styles.heroTitle}
        color={colors.navy}
      >
        Let us help you{' '}
        <AppText color={colors.primary} style={styles.heroTitle}>
          Find, Send
        </AppText>{' '}
        Or Receive
      </AppText>
      <AppText style={styles.subtitle}>
        Send, Carry or Receive anywhere in the world.
      </AppText>
      {preview && (
        <View style={styles.previewRow}>
          <AppText variant="caption" color={colors.primary}>
            Development preview
          </AppText>
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel="Open My Listings"
            onPress={onMyListings}
            style={styles.myListings}
          >
            <AppText variant="caption" color={colors.primary}>
              My Listings
            </AppText>
          </Pressable>
        </View>
      )}
    </View>
  );
}
export function ParcelActionCards({
  onSend,
  onCarry,
}: {
  onSend: () => void;
  onCarry: () => void;
}) {
  return (
    <View style={styles.row}>
      {[
        {
          title: 'Send Parcel',
          description: 'Find travellers to deliver your items',
          icon: Package,
          onPress: onSend,
          gradient: [colors.primary, colors.primaryDark],
        },
        {
          title: 'Carry Parcel',
          description: 'Travelling soon? List your trip',
          icon: Plane,
          onPress: onCarry,
          gradient: [colors.primaryDark, colors.primary],
        },
      ].map(({ title, description, icon: Icon, onPress, gradient }) => (
        <Pressable
          cssInterop={false}
          key={title}
          accessibilityRole="button"
          accessibilityLabel={title}
          onPress={onPress}
          style={styles.action}
        >
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.actionFill}
          >
            <Icon size={30} color={colors.white} />
            <AppText color={colors.white} style={styles.actionTitle}>
              {title}
            </AppText>
            <AppText color={colors.white} style={styles.subtitle}>
              {description}
            </AppText>
          </LinearGradient>
        </Pressable>
      ))}
    </View>
  );
}
export function QuickActions({
  onListings,
  onSaved,
  onMessages,
  onReviews,
}: {
  onListings: () => void;
  onSaved: () => void;
  onMessages: () => void;
  onReviews: () => void;
}) {
  return (
    <View style={styles.row}>
      {[
        { title: 'Listings', icon: ClipboardList, onPress: onListings },
        { title: 'Saved', icon: Heart, onPress: onSaved },
        { title: 'Messages', icon: MessageCircle, onPress: onMessages },
        { title: 'Reviews', icon: Star, onPress: onReviews },
      ].map(({ title, icon: Icon, onPress }) => (
        <Pressable
          cssInterop={false}
          key={title}
          accessibilityRole="button"
          accessibilityLabel={'Open ' + title}
          onPress={onPress}
          style={styles.quick}
        >
          <Icon size={24} color={colors.primary} />
          <AppText color={colors.navy} style={styles.quickText}>
            {title}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 70,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  icon: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 5,
  },
  hero: {
    backgroundColor: colors.palePink,
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  greetingRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  copy: { flex: 1, gap: 3 },
  greeting: { fontSize: 16, lineHeight: 23, fontWeight: '700' },
  heroTitle: { fontSize: 22, lineHeight: 29, fontWeight: '800' },
  subtitle: { fontSize: 12, lineHeight: 18 },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  myListings: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  action: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    backgroundColor: colors.primaryDark,
    shadowColor: colors.navy,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionFill: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    gap: 8,
    minHeight: 150,
  },
  actionTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  quick: {
    flex: 1,
    minWidth: 0,
    minHeight: 78,
    paddingHorizontal: 2,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickText: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
