import React, { useRef, useState } from 'react';
import { Keyboard, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Check, LockKeyhole, Mail } from 'lucide-react-native';
import { AuthStackParamList } from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { KeyboardScreen } from '../../../components/layout/KeyboardScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { BrandLogo } from '../../../components/common/BrandLogo';
import { AppText } from '../../../components/ui/AppText';
import { AppInput } from '../../../components/ui/AppInput';
import { GradientButton } from '../../../components/ui/GradientButton';
import { colors } from '../../../theme';
import { isUiPreviewAllowed } from '../../../constants/appConfig';
import {
  forgotPasswordSchema,
  ForgotPasswordValues,
  resetAcceptanceSchema,
} from '../schemas/forgotPasswordSchema';
import {
  passwordResetError,
  passwordResetService,
} from '../services/passwordResetService';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;
export const resetConfirmation =
  "If an account exists for this email, you'll receive password reset instructions shortly.";
export function ForgotPasswordScreen({ navigation }: Props) {
  const focused = useIsFocused();
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onBlur',
    defaultValues: { email: '' },
  });
  const request = useMutation({
    mutationFn: (values: ForgotPasswordValues) =>
      passwordResetService.request(values),
    retry: false,
    gcTime: 0,
  });
  const submitting = useRef(false);
  const [confirmation, setConfirmation] = useState<
    'accepted' | 'preview' | null
  >(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const busy = form.formState.isSubmitting || request.isPending;
  const toLogin = () => navigation.popTo('Login');
  const submit = form.handleSubmit(async values => {
    if (submitting.current) return;
    submitting.current = true;
    form.clearErrors('root');
    Keyboard.dismiss();
    try {
      const result = await request.mutateAsync(values);
      resetAcceptanceSchema.parse(result);
      form.reset();
      setConfirmation('accepted');
    } catch (error) {
      const message = passwordResetError(error);
      if (message === 'Check the email address format and try again.')
        form.setError('email', { type: 'server', message });
      else form.setError('root.server', { message });
    } finally {
      submitting.current = false;
      request.reset();
    }
  });
  return (
    <SafeScreen
      edges={['top', 'bottom', 'left', 'right']}
      backgroundColor={colors.white}
    >
      {focused && <StatusBar barStyle="dark-content" />}
      <KeyboardScreen>
        <ScreenContainer backgroundColor={colors.white} style={styles.content}>
          <View style={styles.header}>
            <Pressable
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel="Back to Sign In"
              disabled={busy}
              accessibilityState={{ disabled: busy }}
              onPress={toLogin}
              style={styles.back}
            >
              <ArrowLeft size={24} color={colors.navy} />
            </Pressable>
            <BrandLogo width={170} variant="color" />
          </View>
          <View style={styles.main}>
            <ResetIllustration confirmed={!!confirmation} />
            <View style={styles.intro}>
              <AppText
                accessibilityRole="header"
                color={colors.navy}
                style={styles.heading}
              >
                {confirmation ? 'Check Your Email' : 'Forgot Password?'}
              </AppText>
              <AppText
                accessibilityLiveRegion="polite"
                style={styles.description}
              >
                {confirmation
                  ? resetConfirmation
                  : "No worries! Enter your registered email address and we'll send you a link to reset your password."}
              </AppText>
            </View>
            {confirmation ? (
              <>
                {confirmation === 'preview' && (
                  <AppText
                    accessibilityRole="alert"
                    color={colors.primary}
                    style={styles.previewNotice}
                  >
                    UI preview only. No reset request was made and no email was
                    sent.
                  </AppText>
                )}
                <GradientButton
                  title="Back to Sign In"
                  icon="none"
                  onPress={toLogin}
                />
                {confirmation === 'preview' && (
                  <Pressable
                    cssInterop={false}
                    accessibilityRole="button"
                    accessibilityLabel="Back to reset form"
                    onPress={() => setConfirmation(null)}
                    style={styles.footer}
                  >
                    <AppText color={colors.primary}>Back to reset form</AppText>
                  </Pressable>
                )}
              </>
            ) : (
              <>
                <View
                  style={[styles.inputFrame, emailFocused && styles.focused]}
                >
                  <Controller
                    control={form.control}
                    name="email"
                    render={({
                      field: { value, onChange, onBlur, ref },
                      fieldState,
                    }) => (
                      <AppInput
                        ref={ref}
                        label="Email Address"
                        hideLabel
                        placeholder="Enter your email address"
                        leftIcon={<Mail size={21} color={colors.secondary} />}
                        value={value}
                        onChangeText={text => {
                          onChange(text);
                          form.clearErrors('root');
                        }}
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => {
                          setEmailFocused(false);
                          onBlur();
                        }}
                        error={fieldState.error?.message}
                        editable={!busy}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        textContentType="emailAddress"
                        returnKeyType="send"
                        onSubmitEditing={() => {
                          submit().catch(() => {});
                        }}
                      />
                    )}
                  />
                </View>
                {form.formState.errors.root?.server?.message && (
                  <AppText
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    color={colors.danger}
                    style={styles.error}
                  >
                    {form.formState.errors.root.server.message}
                  </AppText>
                )}
                <GradientButton
                  title="Send Reset Link"
                  icon="none"
                  loading={busy}
                  onPress={() => {
                    submit().catch(() => {});
                  }}
                />
                {isUiPreviewAllowed() && (
                  <Pressable
                    cssInterop={false}
                    accessibilityRole="button"
                    accessibilityLabel="Preview confirmation (UI only)"
                    disabled={busy}
                    onPress={() => {
                      Keyboard.dismiss();
                      setConfirmation('preview');
                    }}
                    style={styles.preview}
                  >
                    <AppText variant="caption" color={colors.primary}>
                      Preview confirmation (UI only)
                    </AppText>
                  </Pressable>
                )}
              </>
            )}
          </View>
          {!confirmation && (
            <Pressable
              cssInterop={false}
              accessibilityRole="link"
              accessibilityLabel="Back to Sign In footer"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={toLogin}
              style={styles.footer}
            >
              <ArrowLeft size={18} color={colors.primary} />
              <AppText color={colors.primary} style={styles.footerText}>
                Back to Sign In
              </AppText>
            </Pressable>
          )}
        </ScreenContainer>
      </KeyboardScreen>
    </SafeScreen>
  );
}
function ResetIllustration({ confirmed }: { confirmed: boolean }) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.illustration}
    >
      <View style={styles.halo} />
      <View style={styles.circle}>
        {confirmed ? (
          <Mail size={66} strokeWidth={1.5} color={colors.primary} />
        ) : (
          <LockKeyhole size={66} strokeWidth={1.5} color={colors.primary} />
        )}
      </View>
      <View style={styles.mailBadge}>
        {confirmed ? (
          <Check size={25} color={colors.primary} />
        ) : (
          <Mail size={28} strokeWidth={1.7} color={colors.primary} />
        )}
      </View>
      <View style={styles.checkBadge}>
        <Check size={17} color={colors.primary} />
      </View>
      <View style={styles.dot} />
    </View>
  );
}
const styles = StyleSheet.create({
  content: { maxWidth: 440, paddingTop: 8, paddingBottom: 24, gap: 20 },
  header: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 44,
  },
  back: {
    position: 'absolute',
    left: -8,
    top: 4,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flexGrow: 1, justifyContent: 'center', gap: 24, paddingVertical: 12 },
  intro: { alignItems: 'center', gap: 12 },
  heading: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    color: colors.text,
  },
  illustration: {
    width: 190,
    height: 180,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  halo: {
    position: 'absolute',
    width: 174,
    height: 174,
    borderRadius: 87,
    backgroundColor: colors.palePink,
  },
  circle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softPink,
  },
  mailBadge: {
    position: 'absolute',
    right: 8,
    bottom: 18,
    width: 56,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  checkBadge: {
    position: 'absolute',
    left: 7,
    top: 22,
    width: 32,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
    position: 'absolute',
    right: 13,
    top: 23,
  },
  inputFrame: {
    borderWidth: 1,
    borderColor: colors.white,
    borderRadius: 16,
    padding: 2,
  },
  focused: { borderColor: colors.primary },
  footer: {
    minHeight: 48,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  footerText: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  preview: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  previewNotice: { textAlign: 'center', fontSize: 13, lineHeight: 20 },
  error: { fontSize: 14, lineHeight: 21 },
});
