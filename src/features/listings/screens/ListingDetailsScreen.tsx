import { isListingDemoMode } from '../development/demoListings';
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
  Image,
  Linking,
  Modal,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CalendarDays,
  Check,
  Heart,
  ImageOff,
  MapPin,
  MessageCircle,
  MoreVertical,
  Package,
  Phone,
  Star,
  UserRound,
} from 'lucide-react-native';
import {
  HomeStackParamList,
  ListingsStackParamList,
} from '../../../navigation/navigationTypes';
import { navigationRef } from '../../../navigation/navigationRef';
import { BackButton } from '../../../navigation/components/BackButton';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { GradientButton } from '../../../components/ui/GradientButton';
import { colors } from '../../../theme';
import { ApiError } from '../../../types/api';
import { useAuthStore } from '../../../store/authStore';
import { useListingDetails } from '../hooks/useListingDetails';
import {
  permittedPhone,
  requestUnavailableReason,
} from '../services/listingDetailsService';
import { useListingBookmarks } from '../store/bookmarkStore';
import { formatPrice, formatTravelDate } from '../components/ListingCard';

type Props =
  | NativeStackScreenProps<ListingsStackParamList, 'ListingDetails'>
  | NativeStackScreenProps<HomeStackParamList, 'ListingDetails'>;
export function ListingDetailsScreen({ navigation, route }: Props) {
  const id = route.params.listingId;
  // Keying content resets image errors and menus when navigation changes listing IDs.
  return (
    <DetailsContent
      key={id}
      navigation={navigation}
      id={id}
      returnTo={route.params.returnTo}
    />
  );
}
function DetailsContent({
  navigation,
  id,
  returnTo,
}: {
  navigation: Props['navigation'];
  id: string;
  returnTo?: 'MyListings' | 'MyReviews';
}) {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused(),
    query = useListingDetails(id);
  const detail = query.isError ? undefined : query.data;
  const user = useAuthStore(state => state.user);
  const { ids, owner, load, toggle } = useListingBookmarks();
  const [saving, setSaving] = useState(false),
    [actionError, setActionError] = useState(''),
    [menu, setMenu] = useState(false),
    [coverFailed, setCoverFailed] = useState(false),
    [avatarFailed, setAvatarFailed] = useState(false);
  const saveInFlight = useRef(false);
  const saved = owner === user?.id && ids.includes(Number(id));
  useEffect(() => {
    load().catch(() =>
      setActionError('Could not read saved listings on this device.'),
    );
  }, [load, user?.id]);
  const save = useCallback(async () => {
    if (!detail || query.isFetching) return;
    if (useAuthStore.getState().status !== 'authenticated') {
      Alert.alert(
        'Sign in required',
        'Saving listings needs a real signed-in account. UI preview does not create a session.',
      );
      return;
    }
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setActionError('');
    try {
      await toggle(detail.id);
    } catch {
      setActionError(
        'Could not save this listing on your device. Please try again.',
      );
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }, [detail, query.isFetching, toggle]);
  const back = useCallback(() => {
    if (
      (returnTo === 'MyListings' || returnTo === 'MyReviews') &&
      navigationRef.isReady()
    ) {
      navigationRef.navigate('AppDrawer', { screen: returnTo });
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
    else if (navigationRef.isReady())
      navigationRef.navigate('AppDrawer', {
        screen: 'MainTabs',
        params: { screen: 'ListingsStack', params: { screen: 'Listings' } },
      });
  }, [navigation, returnTo]);
  useFocusEffect(
    useCallback(() => {
      if (returnTo !== 'MyListings' && returnTo !== 'MyReviews') return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        back();
        return true;
      });
      return () => sub.remove();
    }, [back, returnTo]),
  );
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Listing Details',
      headerTitleAlign: 'center',
      headerLeft: () => <BackButton onPress={back} />,
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel={
              saved
                ? 'Unsave listing on this device'
                : 'Save listing on this device'
            }
            accessibilityState={{
              selected: saved,
              disabled: !detail || saving || query.isFetching,
            }}
            disabled={!detail || saving || query.isFetching}
            onPress={save}
            style={styles.icon}
          >
            <Heart
              size={25}
              color={colors.primary}
              fill={saved ? colors.primary : colors.white}
            />
          </Pressable>
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel="More listing options"
            accessibilityState={{
              disabled: !detail?.shareUrl || query.isFetching,
            }}
            disabled={!detail?.shareUrl || query.isFetching}
            onPress={() => setMenu(true)}
            style={styles.icon}
          >
            <MoreVertical
              size={23}
              color={detail?.shareUrl ? colors.navy : colors.textMuted}
            />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, back, saved, detail, saving, query.isFetching, save]);
  const demoCover = isListingDemoMode()
    ? require('../../../assets/demo-destinations/uae.jpg')
    : undefined;
  const phone = detail ? permittedPhone(detail) : undefined;
  const requireAuth = () => {
    const current = useAuthStore.getState();
    if (
      isListingDemoMode() ||
      (current.status === 'authenticated' && current.user)
    )
      return true;
    Alert.alert(
      'Sign in required',
      'Sign in with a real account to contact this traveller.',
    );
    return false;
  };
  const call = () => {
    if (!detail || !phone || !requireAuth()) return;
    Alert.alert(
      'Call traveller',
      'Open your phone dialer for this traveller?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open dialer',
          onPress: async () => {
            try {
              await Linking.openURL('tel:' + phone);
            } catch {
              setActionError('Could not open the phone dialer on this device.');
            }
          },
        },
      ],
    );
  };
  const message = () => {
    if (!detail?.contact?.conversationId || !requireAuth()) return;
    if (navigationRef.isReady())
      navigationRef.navigate('AppDrawer', {
        screen: 'MainTabs',
        params: {
          screen: 'MessagesStack',
          params: {
            screen: 'Chat',
            params: {
              conversationId: detail.contact.conversationId,
              returnTo: {
                stack: navigation
                  .getState()
                  .routeNames.some(name => name === 'Home')
                  ? 'HomeStack'
                  : 'ListingsStack',
                listingId: String(detail.id),
              },
            },
          },
        },
      });
    else setActionError('Messaging is currently unavailable.');
  };
  const unavailable =
    query.error instanceof ApiError &&
    [404, 410].includes(query.error.status ?? 0);
  const rows = detail
    ? [
        {
          label: 'Route',
          value: detail.origin + ' \u2192 ' + detail.destination,
          icon: MapPin,
        },
        {
          label: detail.type === 'carry' ? 'Travel Date' : 'Delivery Date',
          value: formatTravelDate(detail.departureDate),
          icon: CalendarDays,
        },
        {
          label:
            detail.type === 'carry' ? 'Carrying Capacity' : 'Parcel Weight',
          value: detail.weight
            ? (detail.type === 'carry' ? 'Up to ' : '') +
              detail.weight.value +
              ' ' +
              detail.weight.unit
            : detail.capacityKg !== undefined
            ? (detail.type === 'carry' ? 'Up to ' : '') +
              detail.capacityKg +
              ' kg'
            : 'Not provided',
          icon: Package,
        },
        {
          label: 'Item Type',
          value: detail.itemTypes?.length
            ? detail.itemTypes.join(', ')
            : detail.category || 'Not provided',
          icon: Package,
        },
      ]
    : [];
  return (
    <SafeScreen backgroundColor={colors.white}>
      {focused && <StatusBar barStyle="dark-content" />}
      <ScreenContainer backgroundColor={colors.white} style={styles.content}>
        {query.isPending ? (
          <View
            accessibilityLabel="Loading listing details"
            style={styles.loading}
          >
            <View style={styles.coverSkeleton} />
            {[1, 2, 3].map(value => (
              <View key={value} style={styles.lineSkeleton} />
            ))}
          </View>
        ) : !detail ? (
          <View style={styles.error}>
            <AppText
              accessibilityRole="header"
              variant="headingMD"
              color={colors.navy}
            >
              {unavailable ? 'Listing unavailable' : 'Unable to load listing'}
            </AppText>
            <AppText accessibilityRole="alert">
              {unavailable
                ? 'This listing may have been removed or is no longer available.'
                : query.error instanceof ApiError
                ? query.error.message
                : 'Check your connection and try again.'}
            </AppText>
            {!unavailable && (
              <AppButton
                title="Retry listing details"
                onPress={() => {
                  query.refetch().catch(() => {});
                }}
              />
            )}
            <AppButton
              title="Back to listings"
              variant="secondary"
              onPress={back}
            />
          </View>
        ) : (
          <>
            <View style={styles.cover}>
              {(detail.coverImageUrl || demoCover) && !coverFailed ? (
                <Image
                  accessibilityLabel={detail.destination + ' destination'}
                  source={demoCover ?? { uri: detail.coverImageUrl }}
                  style={styles.coverImage}
                  resizeMode="cover"
                  onError={() => setCoverFailed(true)}
                />
              ) : (
                <View style={styles.coverFallback}>
                  <ImageOff size={32} color={colors.textMuted} />
                  <AppText color={colors.secondary}>
                    {detail.destination}
                  </AppText>
                </View>
              )}
            </View>
            <View style={styles.identity}>
              <View style={styles.avatar}>
                {detail.traveller?.avatarUrl && !avatarFailed ? (
                  <Image
                    source={{ uri: detail.traveller.avatarUrl }}
                    style={styles.avatarImage}
                    onError={() => setAvatarFailed(true)}
                    accessibilityLabel={detail.traveller.name + ' avatar'}
                  />
                ) : (
                  <UserRound size={30} color={colors.secondary} />
                )}
              </View>
              <View style={styles.person}>
                <View style={styles.nameRow}>
                  <AppText color={colors.navy} style={styles.name}>
                    {detail.traveller?.name ?? 'Traveller'}
                  </AppText>
                  {detail.traveller?.verified === true && (
                    <View
                      accessibilityLabel="Verified account"
                      style={styles.verified}
                    >
                      <Check size={11} color={colors.white} />
                    </View>
                  )}
                </View>
                {detail.traveller?.rating != null ? (
                  <View style={styles.rating}>
                    <Star
                      size={15}
                      color={colors.warning}
                      fill={colors.warning}
                    />
                    <AppText variant="caption">
                      {detail.traveller.rating.toFixed(1) +
                        (detail.traveller.reviewCount !== undefined
                          ? ' (' + detail.traveller.reviewCount + ' reviews)'
                          : '')}
                    </AppText>
                  </View>
                ) : (
                  <AppText variant="caption">
                    {detail.type === 'carry' ? 'Carry Parcel' : 'Send Parcel'}
                  </AppText>
                )}
              </View>
              <Pressable
                cssInterop={false}
                accessibilityRole="button"
                accessibilityLabel="Call traveller"
                accessibilityState={{ disabled: !phone || query.isFetching }}
                disabled={!phone || query.isFetching}
                onPress={call}
                style={[styles.contact, !phone && styles.disabled]}
              >
                <Phone size={21} color={colors.primary} />
              </Pressable>
              <Pressable
                cssInterop={false}
                accessibilityRole="button"
                accessibilityLabel="Message traveller"
                accessibilityState={{
                  disabled: !detail.contact?.conversationId || query.isFetching,
                }}
                disabled={!detail.contact?.conversationId || query.isFetching}
                onPress={message}
                style={[
                  styles.contact,
                  !detail.contact?.conversationId && styles.disabled,
                ]}
              >
                <MessageCircle size={21} color={colors.primary} />
              </Pressable>
            </View>
            <View style={styles.detailCard}>
              {rows.map(({ label, value, icon: Icon }, index) => (
                <View
                  key={label}
                  style={[
                    styles.row,
                    index < rows.length - 1 && styles.divider,
                  ]}
                >
                  <Icon size={21} color={colors.primary} />
                  <View style={styles.rowText}>
                    <AppText variant="caption">{label}</AppText>
                    <AppText color={colors.navy} style={styles.value}>
                      {value}
                    </AppText>
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.fee}>
              <AppText color={colors.navy} style={styles.feeLabel}>
                {detail.type === 'carry' ? 'Carrying Fee' : 'Delivery Fee'}
              </AppText>
              <AppText color={colors.primary} style={styles.amount}>
                {formatPrice(detail.price, detail.currency)}
              </AppText>
            </View>
            <AppText variant="caption">
              {isListingDemoMode()
                ? 'Development demo - sample listing and price'
                : 'Saved listings are stored on this device.'}
            </AppText>
            {(!phone || !detail.contact?.conversationId) && (
              <AppText variant="caption">
                {!phone ? 'Calling is unavailable for this listing. ' : ''}
                {!detail.contact?.conversationId
                  ? 'Messaging is unavailable for this listing.'
                  : ''}
              </AppText>
            )}
          </>
        )}
        {!!actionError && (
          <AppText accessibilityRole="alert" color={colors.danger}>
            {actionError}
          </AppText>
        )}
      </ScreenContainer>
      {detail && (
        <View style={styles.footer}>
          <AppText accessibilityLiveRegion="polite" variant="caption">
            {requestUnavailableReason(detail, user?.id)}
          </AppText>
          <GradientButton
            title={
              detail.requestStatus === 'pending' ||
              detail.requestStatus === 'accepted'
                ? 'Already Requested'
                : 'Request Now'
            }
            icon="none"
            disabled
            onPress={() =>
              setActionError(requestUnavailableReason(detail, user?.id))
            }
          />
        </View>
      )}
      <Modal
        visible={menu}
        transparent
        animationType="fade"
        onRequestClose={() => setMenu(false)}
      >
        <View style={styles.scrim}>
          <View
            style={[
              styles.menu,
              { paddingBottom: Math.max(24, insets.bottom) },
            ]}
          >
            <AppText variant="headingMD" color={colors.navy}>
              Listing options
            </AppText>
            {detail?.shareUrl && (
              <AppButton
                title="Share listing"
                onPress={async () => {
                  setMenu(false);
                  try {
                    await Share.share({
                      message: detail.title + '\n' + detail.shareUrl,
                    });
                  } catch {
                    setActionError('Could not open sharing. Please try again.');
                  }
                }}
              />
            )}
            <AppButton
              title="Close listing options"
              variant="ghost"
              onPress={() => setMenu(false)}
            />
          </View>
        </View>
      </Modal>
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 16,
    maxWidth: 640,
  },
  headerActions: { flexDirection: 'row' },
  icon: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: {
    height: 190,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.lightGrey,
  },
  coverImage: { width: '100%', height: '100%' },
  coverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
  },
  identity: {
    marginTop: -26,
    paddingTop: 6,
    paddingHorizontal: 4,
    backgroundColor: colors.white,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.lightGrey,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  person: { flex: 1, minWidth: 95 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 15, lineHeight: 21, fontWeight: '700', flexShrink: 1 },
  verified: {
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  contact: {
    height: 44,
    width: 44,
    borderRadius: 14,
    backgroundColor: colors.softPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  detailCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowText: { flex: 1 },
  value: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  fee: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    flexWrap: 'wrap',
  },
  feeLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  amount: { fontSize: 24, lineHeight: 32, fontWeight: '800', flexShrink: 1 },
  footer: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 8,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  loading: { gap: 18 },
  coverSkeleton: {
    height: 190,
    borderRadius: 16,
    backgroundColor: colors.lightGrey,
  },
  lineSkeleton: {
    height: 55,
    borderRadius: 12,
    backgroundColor: colors.lightGrey,
  },
  error: { paddingVertical: 32, gap: 16 },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.secondary,
  },
  menu: {
    padding: 24,
    gap: 16,
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});
