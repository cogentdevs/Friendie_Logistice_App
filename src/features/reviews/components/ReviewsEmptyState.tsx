import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MessageSquareText, Star } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { colors } from '../../../theme';
import { ReviewsTab } from '../types/reviews.types';
export function ReviewsEmptyState({ tab }: { tab: ReviewsTab }) {
  const Icon = tab === 'visitors' ? MessageSquareText : Star;
  return (
    <View style={styles.empty}>
      <Icon size={32} color={colors.primary} />
      <AppText color={colors.navy} style={styles.heading}>
        {tab === 'visitors'
          ? 'No Visitor Reviews Yet'
          : "You Haven't Written Any Reviews"}
      </AppText>
      <AppText style={styles.description}>
        {tab === 'visitors'
          ? 'Reviews from other members will appear here.'
          : 'Reviews you write for other members will appear here.'}
      </AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  empty: { padding: 26, gap: 14, alignItems: 'center' },
  heading: {
    fontSize: 19,
    lineHeight: 27,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: { textAlign: 'center', lineHeight: 23 },
});
