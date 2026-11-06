import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { colors } from '../../../theme';
export function DashboardEmptyState() {
  return (
    <View style={styles.empty}>
      <MessageCircle size={30} color={colors.textMuted} />
      <AppText style={styles.text}>No visitor reviews available yet.</AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  empty: { paddingVertical: 32, gap: 12, alignItems: 'center' },
  text: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
