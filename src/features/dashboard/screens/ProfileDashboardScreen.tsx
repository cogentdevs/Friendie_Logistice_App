import React, { useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { CompositeScreenProps, useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DrawerScreenProps } from '@react-navigation/drawer';
import {
  ArrowLeft,
  ClipboardList,
  MessagesSquare,
  Star,
} from 'lucide-react-native';
import {
  DrawerParamList,
  ProfileStackParamList,
} from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
import { ApiError } from '../../../types/api';
import { requireAuth } from '../../auth/services/authFlowCoordinator';
import { useMyListingsTabs } from '../../listings/store/myListingsStore';
import { useProfileDashboard } from '../hooks/useProfileDashboard';
import { DashboardStatCard } from '../components/DashboardStatCard';
import { VisitorReviewSection } from '../components/VisitorReviewSection';
type Props = CompositeScreenProps<
  NativeStackScreenProps<ProfileStackParamList, 'ProfileDashboard'>,
  DrawerScreenProps<DrawerParamList, 'MainTabs'>
>;
export function ProfileDashboardScreen({ navigation }: Props) {
  const focused = useIsFocused(),
    data = useProfileDashboard();
  const [refreshing, setRefreshing] = useState(false);
  const queries = [data.active, data.reviews, data.messages, data.visitor];
  const unauthorized = queries.some(
    query =>
      query.error instanceof ApiError && query.error.kind === 'unauthorized',
  );
  const statsUnavailable = [data.active, data.reviews, data.messages].some(
    query => query.isError || (!query.isPending && query.data == null),
  );
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await data.refresh();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <SafeScreen edges={['top', 'left', 'right']} backgroundColor={colors.white}>
      {focused && <StatusBar barStyle="dark-content" />}
      <View style={styles.header}>
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          accessibilityLabel="Back to Profile"
          onPress={() => navigation.popTo('Profile')}
          style={styles.back}
        >
          <ArrowLeft size={24} color={colors.navy} />
        </Pressable>
        <AppText
          accessibilityRole="header"
          style={styles.title}
          color={colors.navy}
        >
          Dashboard
        </AppText>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[colors.primary]}
            tintColor={colors.primary}
            onRefresh={() => {
              refresh().catch(() => {});
            }}
          />
        }
      >
        <View style={styles.intro}>
          <AppText color={colors.navy} style={styles.introTitle}>
            My Dashboard
          </AppText>
          <AppText style={styles.subtitle}>
            Your listings, reviews and messages at a glance.
          </AppText>
        </View>
        {data.demo && (
          <AppText variant="caption" color={colors.primary}>
            UI preview: active count uses sample listings; Visitor Review shows
            an empty-state design preview. Review counts use an empty-state
            preview; new-message counts are unavailable.
          </AppText>
        )}
        <View style={styles.row}>
          <DashboardStatCard
            label="Active Listing"
            icon={ClipboardList}
            count={data.active.data}
            loading={data.active.isPending}
            error={data.active.isError}
            onPress={() => {
              useMyListingsTabs.getState().select(data.scope, 'active');
              navigation.navigate('MyListings');
            }}
          />
          <DashboardStatCard
            label="Total Reviews"
            icon={Star}
            count={data.reviews.data}
            loading={data.reviews.isPending}
            error={data.reviews.isError}
            onPress={() =>
              navigation.navigate('MyReviews', {
                initialTab: 'visitors',
                returnTo: 'Dashboard',
              })
            }
          />
        </View>
        <DashboardStatCard
          label="New Messages"
          icon={MessagesSquare}
          count={data.messages.data}
          loading={data.messages.isPending}
          error={data.messages.isError}
          onPress={() =>
            navigation.navigate('MainTabs', {
              screen: 'MessagesStack',
              params: { screen: 'Conversations' },
            })
          }
        />
        {statsUnavailable && (
          <View style={styles.feedback}>
            <AppText accessibilityRole="alert">
              {unauthorized
                ? 'Sign in to view your dashboard.'
                : 'Some counts are unavailable. Check your connection or try again later.'}
            </AppText>
            {unauthorized ? (
              <AppButton
                title="Sign In"
                onPress={() =>
                  requireAuth({
                    type: 'OPEN_ACCOUNT',
                    params: { destination: 'ProfileDashboard' },
                  })
                }
              />
            ) : (
              <AppButton
                title="Retry dashboard counts"
                onPress={() => {
                  data.active.refetch().catch(() => {});
                  data.reviews.refetch().catch(() => {});
                  data.messages.refetch().catch(() => {});
                }}
              />
            )}
          </View>
        )}
        <VisitorReviewSection
          data={data.visitor.data}
          onViewAll={() =>
            navigation.navigate('MyReviews', {
              initialTab: 'visitors',
              returnTo: 'Dashboard',
            })
          }
          loading={data.visitor.isPending}
          error={data.visitor.isError}
          onRetry={() => {
            data.visitor.refetch().catch(() => {});
          }}
        />
      </ScrollView>
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  back: {
    position: 'absolute',
    left: 10,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    padding: 18,
    gap: 14,
    paddingBottom: 24,
  },
  intro: {
    padding: 16,
    gap: 6,
    borderRadius: 16,
    backgroundColor: colors.softPink,
  },
  introTitle: { fontSize: 20, lineHeight: 27, fontWeight: '700' },
  subtitle: { fontSize: 13, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 14 },
  feedback: { gap: 12, paddingVertical: 2 },
});
