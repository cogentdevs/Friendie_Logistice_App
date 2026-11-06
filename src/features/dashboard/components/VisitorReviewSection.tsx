import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
import {
  VisitorReviewData,
  visitorReviewSchema,
} from '../types/dashboard.types';
import { DashboardEmptyState } from './DashboardEmptyState';
export function VisitorReviewSection({
  data,
  loading,
  error,
  onRetry,
  onViewAll,
}: {
  data?: VisitorReviewData;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onViewAll?: () => void;
}) {
  const parsed = visitorReviewSchema.safeParse(data);
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <AppText
          accessibilityRole="header"
          color={colors.navy}
          style={styles.title}
        >
          Visitor Review
        </AppText>
        {onViewAll && (
          <AppButton
            title="View All"
            accessibilityLabel="View All Visitor Reviews"
            variant="ghost"
            onPress={onViewAll}
          />
        )}
      </View>
      <View style={styles.divider} />
      {loading ? (
        <View
          accessibilityLabel="Loading Visitor Review"
          style={styles.skeleton}
        />
      ) : error || !parsed.success ? (
        <View style={styles.feedback}>
          <AppText accessibilityRole="alert">
            Visitor Review is unavailable. Please try again later.
          </AppText>
          <AppButton title="Retry Visitor Review" onPress={onRetry} />
        </View>
      ) : parsed.data.records.length === 0 ? (
        <DashboardEmptyState />
      ) : (
        <View style={styles.records}>
          {parsed.data.records.map(record => (
            <AppText key={record.id} style={styles.record}>
              {record.text}
            </AppText>
          ))}
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
    gap: 14,
    minHeight: 200,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between',
  },
  title: { flex: 1, fontSize: 18, lineHeight: 25, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  skeleton: {
    height: 120,
    borderRadius: 12,
    backgroundColor: colors.lightGrey,
  },
  feedback: { paddingVertical: 16, gap: 14 },
  records: { gap: 14 },
  record: {
    fontSize: 14,
    lineHeight: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingBottom: 14,
  },
});
