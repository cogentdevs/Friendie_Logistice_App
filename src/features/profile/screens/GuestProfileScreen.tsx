import React from 'react';
import { ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import {
  UserRound,
  Package,
  MessageCircle,
  LayoutDashboard,
} from 'lucide-react-native';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
import { requireAuth } from '../../auth/services/authFlowCoordinator';
export function GuestProfileScreen() {
  const focused = useIsFocused();
  return (
    <SafeScreen
      edges={['top', 'left', 'right']}
      backgroundColor={colors.primary}
    >
      {focused && <StatusBar barStyle="light-content" />}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          style={styles.hero}
        >
          <View style={styles.avatar}>
            <UserRound size={46} color={colors.primary} />
          </View>
          <AppText
            accessibilityRole="header"
            color={colors.white}
            style={styles.title}
          >
            Welcome to Friendie
          </AppText>
          <AppText color={colors.white} style={styles.description}>
            Sign in to manage your listings, connect with travellers, and access
            your account.
          </AppText>
        </LinearGradient>
        <View style={styles.card}>
          <AppButton
            title="Sign In"
            onPress={() => requireAuth({ type: 'OPEN_PROFILE' })}
          />
          <AppButton
            title="Create Account"
            variant="secondary"
            onPress={() => requireAuth({ type: 'OPEN_PROFILE' }, 'Register')}
          />
        </View>
        <View style={styles.card}>
          <AppText variant="headingMD" color={colors.navy}>
            Your account, in one place
          </AppText>
          {[
            { Icon: Package, text: 'Post and manage listings.' },
            {
              Icon: MessageCircle,
              text: 'Connect with other members and manage your messages.',
            },
            { Icon: LayoutDashboard, text: 'View your dashboard and reviews.' },
          ].map(({ Icon, text }) => (
            <View key={text} style={styles.benefit}>
              <Icon size={23} color={colors.primary} />
              <AppText style={styles.benefitText}>{text}</AppText>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.white },
  content: { paddingBottom: 24, gap: 18 },
  hero: {
    paddingHorizontal: 22,
    paddingVertical: 30,
    alignItems: 'center',
    gap: 14,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.softPink,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 25,
    lineHeight: 33,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: { textAlign: 'center', lineHeight: 23, maxWidth: 420 },
  card: {
    marginHorizontal: 18,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.white,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 5,
  },
  benefitText: { flex: 1, minWidth: 0 },
});
