import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LockKeyhole } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
// This component receives no contact data. No verified disclosure contract exists.
export function ListingContactSection({
  guest,
  checking,
  onRequest,
  busy,
  unavailableReason,
}: {
  guest: boolean;
  checking: boolean;
  onRequest: () => void;
  busy: boolean;
  unavailableReason?: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <LockKeyhole size={23} color={colors.primary} />
        <AppText variant="headingMD" color={colors.navy} style={styles.title}>
          Contact Information Protected
        </AppText>
      </View>
      <AppText>
        {checking
          ? 'Checking your session. Contact details remain protected.'
          : guest
          ? 'Sign in and send a request to connect with this member.'
          : 'Send a request to connect with this member. Contact details become available after acceptance and authorization.'}
      </AppText>
      {!guest && !checking && (
        <AppText variant="caption" accessibilityLiveRegion="polite">
          Request status unavailable. Secure contact authorization is not
          connected yet.
        </AppText>
      )}
      {unavailableReason && (
        <AppText variant="caption">{unavailableReason}</AppText>
      )}
      {guest && !checking && (
        <AppButton
          title="Sign In to Request"
          loading={busy}
          disabled={!!unavailableReason}
          onPress={onRequest}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.palePink,
    gap: 12,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, minWidth: 0 },
});
