import { useAuthFlowStore } from '../store/authFlowStore';
import { cancelAuthentication } from '../services/authFlowCoordinator';
import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Controller } from 'react-hook-form';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react-native';
import { AuthStackParamList } from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { KeyboardScreen } from '../../../components/layout/KeyboardScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { BrandLogo } from '../../../components/common/BrandLogo';
import { AppText } from '../../../components/ui/AppText';
import { AppInput } from '../../../components/ui/AppInput';
import { GradientButton } from '../../../components/ui/GradientButton';
import { colors, spacing } from '../../../theme';
import { ApiError } from '../../../types/api';
import { useLoginForm } from '../hooks/useLoginForm';
import { useLogin } from '../hooks/useAuth';
import { appConfig, isUiPreviewAllowed } from '../../../constants/appConfig';
import { uiTestingLogin } from '../development/uiTestingLogin';
import { useDevelopmentStore } from '../../../store/developmentStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export function LoginScreen({ navigation }: Props) {
  const focused = useIsFocused();
  const form = useLoginForm();
  const controller = useRef(new AbortController());
  useEffect(() => {
    const attempt = controller.current;
    return () => attempt.abort();
  }, []);
  const guarded = useAuthFlowStore(state => !!state.flow);
  const login = useLogin(controller.current.signal);
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const submitting = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const busy = form.formState.isSubmitting || login.isPending;
  const authenticate = form.handleSubmit(async values => {
    if (submitting.current) return;
    submitting.current = true;
    Keyboard.dismiss();
    form.clearErrors();
    try {
      await login.mutateAsync(values);
      // The central coordinator resumes only after token storage and profile validation.
    } catch (error) {
      if (controller.current.signal.aborted) return;
      const message =
        error instanceof ApiError
          ? error.message
          : 'Unable to sign in securely. Please try again.';
      form.setError('root.server', { message });
      if (error instanceof ApiError) {
        let first: 'email' | 'password' | undefined;
        for (const field of ['email', 'password'] as const) {
          const fieldMessage = error.fields?.[field]?.[0];
          if (typeof fieldMessage === 'string' && fieldMessage) {
            form.setError(field, { type: 'server', message: fieldMessage });
            first ??= field;
          }
        }
        if (first) form.setFocus(first);
      }
    } finally {
      submitting.current = false;
    }
  });
  const openTestingPreview = form.handleSubmit(values => {
    Keyboard.dismiss();
    form.clearErrors('root');
    if (
      values.email.trim().toLowerCase() !== uiTestingLogin.email ||
      values.password !== uiTestingLogin.password
    ) {
      form.setError('root.server', {
        message: 'Incorrect UI testing email or password.',
      });
      return;
    }
    useDevelopmentStore.getState().enterPreview();
  });
  const submit = () =>
    isUiPreviewAllowed() && !guarded ? openTestingPreview() : authenticate();
  const EyeIcon = showPassword ? EyeOff : Eye;
  return (
    <SafeScreen
      edges={['top', 'bottom', 'left', 'right']}
      backgroundColor={colors.white}
    >
      {focused && <StatusBar barStyle="dark-content" />}
      <KeyboardScreen>
        <ScreenContainer backgroundColor={colors.white} style={styles.content}>
          {guarded && (
            <Pressable
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel="Cancel sign in"
              style={styles.forgot}
              onPress={() => {
                cancelAuthentication();
                navigation.getParent()?.goBack();
              }}
            >
              <AppText color={colors.primary}>Cancel</AppText>
            </Pressable>
          )}
          <View style={styles.brand}>
            <BrandLogo width={170} variant="color" />
          </View>
          <View style={styles.intro}>
            <AppText
              accessibilityRole="header"
              color={colors.navy}
              style={styles.heading}
            >
              Sign In
            </AppText>
            <AppText style={styles.subtitle}>
              Welcome back! Please sign in to your account.
            </AppText>
          </View>
          {appConfig.uiPreviewEnabled && !guarded && (
            <AppText variant="caption" color={colors.primary}>
              UI testing: sign in with the supplied demo credentials. No real
              account is created.
            </AppText>
          )}
          <View style={styles.form}>
            <Controller
              control={form.control}
              name="email"
              render={({
                field: { onChange, onBlur, value, ref },
                fieldState,
              }) => (
                <AppInput
                  ref={ref}
                  label="Email Address"
                  hideLabel
                  placeholder="Email Address"
                  leftIcon={<Mail size={21} color={colors.secondary} />}
                  value={value}
                  onChangeText={text => {
                    form.clearErrors('root');
                    onChange(text);
                  }}
                  onBlur={onBlur}
                  error={fieldState.error?.message}
                  editable={!busy}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="username"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              )}
            />
            <Controller
              control={form.control}
              name="password"
              render={({
                field: { onChange, onBlur, value, ref },
                fieldState,
              }) => (
                <AppInput
                  ref={input => {
                    passwordRef.current = input;
                    ref(input);
                  }}
                  label="Password"
                  hideLabel
                  placeholder="Password"
                  leftIcon={<LockKeyhole size={21} color={colors.secondary} />}
                  rightAccessory={
                    <Pressable
                      cssInterop={false}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      onPress={() => setShowPassword(visible => !visible)}
                      style={({ pressed }) => [
                        styles.eye,
                        pressed && styles.pressed,
                      ]}
                    >
                      <EyeIcon size={21} color={colors.secondary} />
                    </Pressable>
                  }
                  value={value}
                  onChangeText={text => {
                    form.clearErrors('root');
                    onChange(text);
                  }}
                  onBlur={onBlur}
                  error={fieldState.error?.message}
                  editable={!busy}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={() => submit()}
                />
              )}
            />
          </View>
          <Pressable
            cssInterop={false}
            accessibilityRole="link"
            accessibilityLabel="Forgot Password?"
            disabled={busy}
            accessibilityState={{ disabled: busy }}
            onPress={() => navigation.navigate('ForgotPassword')}
            style={({ pressed }) => [
              styles.forgot,
              (pressed || busy) && styles.pressed,
            ]}
          >
            <AppText color={colors.primary} style={styles.link}>
              Forgot Password?
            </AppText>
          </Pressable>
          <View style={styles.action}>
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
              title="Sign In"
              icon="none"
              loading={busy}
              onPress={() => submit()}
            />
          </View>
          <View style={styles.footer}>
            <AppText color={colors.navy} style={styles.footerText}>
              Don't have an account?
            </AppText>
            <Pressable
              cssInterop={false}
              accessibilityRole="link"
              accessibilityLabel="Register"
              disabled={busy}
              accessibilityState={{ disabled: busy }}
              onPress={() => navigation.navigate('Register')}
              style={({ pressed }) => [
                styles.register,
                (pressed || busy) && styles.pressed,
              ]}
            >
              <AppText color={colors.primary} style={styles.link}>
                Register
              </AppText>
            </Pressable>
          </View>
        </ScreenContainer>
      </KeyboardScreen>
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  content: {
    maxWidth: 440,
    gap: 0,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  brand: { alignItems: 'center', marginBottom: spacing.xxxl },
  intro: { gap: spacing.sm, marginBottom: spacing.xxl },
  heading: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  subtitle: { fontSize: 14, lineHeight: 21 },
  form: { gap: spacing.lg },
  eye: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.md,
  },
  forgot: {
    minHeight: 48,
    alignSelf: 'flex-end',
    justifyContent: 'center',
    paddingLeft: spacing.md,
  },
  link: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  action: { marginTop: spacing.xl, gap: spacing.md },
  error: { fontSize: 14, lineHeight: 21 },
  footer: {
    flexGrow: 1,
    minHeight: 112,
    paddingTop: spacing.xxl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    alignContent: 'flex-end',
    justifyContent: 'center',
    columnGap: spacing.sm,
  },
  footerText: { fontSize: 14, lineHeight: 21, paddingVertical: 14 },
  register: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  pressed: { opacity: 0.55 },
});
