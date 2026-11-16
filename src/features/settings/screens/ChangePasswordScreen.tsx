import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  Pressable,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { DrawerScreenProps } from '@react-navigation/drawer';
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
} from 'lucide-react-native';
import { DrawerParamList } from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { KeyboardScreen } from '../../../components/layout/KeyboardScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { AppText } from '../../../components/ui/AppText';
import { AppInput } from '../../../components/ui/AppInput';
import { GradientButton } from '../../../components/ui/GradientButton';
import { colors } from '../../../theme';
import { ApiError } from '../../../types/api';
import { useAuthStore } from '../../../store/authStore';
import { isUiPreviewActive } from '../../../store/developmentStore';
import { clearPrivateAccountMemory } from '../../auth/services/sessionLogout';
import { showToast } from '../../../components/ui/AppToast';
import {
  ChangePasswordValues,
  createChangePasswordSchema,
  passwordChangeResultSchema,
} from '../schemas/changePasswordSchema';
import {
  changePasswordService,
  changePasswordErrorMessage,
  finishPasswordSession,
  PasswordSessionCleanupError,
  passwordChangePolicy,
} from '../services/changePasswordService';
const blank = { currentPassword: '', newPassword: '', confirmPassword: '' };
const hidden = {
  currentPassword: false,
  newPassword: false,
  confirmPassword: false,
};
const fields = [
  { name: 'currentPassword', label: 'Current Password' },
  { name: 'newPassword', label: 'New Password' },
  { name: 'confirmPassword', label: 'Confirm New Password' },
] as const;
type Props = DrawerScreenProps<DrawerParamList, 'ChangePassword'>;
export function ChangePasswordScreen({ navigation, route }: Props) {
  const returnToProfile = route.params?.returnTo === 'Profile';
  const back = () =>
    returnToProfile
      ? navigation.navigate('MainTabs', {
          screen: 'ProfileStack',
          params: { screen: 'Profile' },
        })
      : navigation.navigate('Settings');
  const focused = useIsFocused(),
    client = useQueryClient();
  const status = useAuthStore(state => state.status);
  const demo = isUiPreviewActive();
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(createChangePasswordSchema(passwordChangePolicy)),
    mode: 'onBlur',
    defaultValues: blank,
  });
  const mutation = useMutation({
    mutationFn: (values: ChangePasswordValues) =>
      changePasswordService.update(values, request.current?.signal),
    retry: false,
    gcTime: 0,
  });
  const [visible, setVisible] = useState(hidden),
    [focus, setFocus] = useState('');
  const [signOutRequired, setSignOutRequired] = useState(false),
    [signOutBusy, setSignOutBusy] = useState(false),
    [signOutError] = useState('');
  const revokedOwner =
    useRef<ReturnType<typeof useAuthStore.getState>['user']>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const submitting = useRef(false);
  const refs = useRef<
    Partial<
      Record<
        keyof ChangePasswordValues,
        React.ComponentRef<typeof TextInput> | null
      >
    >
  >({});
  const busy = form.formState.isSubmitting || mutation.isPending || signOutBusy;
  const [newPassword, confirmation, currentPassword] = form.watch([
    'newPassword',
    'confirmPassword',
    'currentPassword',
  ]);
  useEffect(() => {
    if (!focused) {
      request.current?.abort();
      form.reset(blank);
      setVisible(hidden);
    }
  }, [focused, form]);
  useFocusEffect(
    useCallback(() => {
      if (!signOutRequired) return;
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => true,
      );
      return () => subscription.remove();
    }, [signOutRequired]),
  );
  const secureSignOut = async () => {
    if (submitting.current || !revokedOwner.current) return;
    submitting.current = true;
    setSignOutBusy(true);
    try {
      await finishPasswordSession(revokedOwner.current);
      clearPrivateAccountMemory(client);
      showToast(
        'Password updated',
        'Password changed successfully. Sign in again.',
        'success',
      );
    } catch (error) {
      if (!(error instanceof ApiError && error.kind === 'cancelled'))
        showToast(
          'Sign out required',
          'Retry secure sign out before continuing.',
          'error',
        );
    } finally {
      submitting.current = false;
      setSignOutBusy(false);
    }
  };
  const submit = form.handleSubmit(
    async values => {
      if (submitting.current || signOutRequired) return;
      submitting.current = true;
      request.current = new AbortController();
      Keyboard.dismiss();
      form.clearErrors('root');
      const session = useAuthStore.getState().user;
      try {
        const result = passwordChangeResultSchema.parse(
          await mutation.mutateAsync(values),
        );
        if (
          useAuthStore.getState().status === 'authenticated' &&
          useAuthStore.getState().user !== session
        )
          return;
        form.reset(blank);
        setVisible(hidden);
        if (result.session === 'revoked') clearPrivateAccountMemory(client);
        showToast(
          'Password updated',
          'Password changed successfully. Sign in again.',
          'success',
        );
      } catch (error) {
        if (error instanceof ApiError && error.kind === 'cancelled') return;
        if (
          useAuthStore.getState().user !== session &&
          !(
            error instanceof ApiError &&
            error.kind === 'unauthorized' &&
            useAuthStore.getState().status === 'guest'
          )
        )
          return;
        if (error instanceof PasswordSessionCleanupError) {
          form.reset(blank);
          setVisible(hidden);
          revokedOwner.current = session;
          setSignOutRequired(true);
          showToast('Sign out required', error.message, 'error');
          return;
        }
        let message = changePasswordErrorMessage(error);
        if (error instanceof ApiError && error.kind === 'validation') {
          const mapping = {
            current_password: 'currentPassword',
            password: 'newPassword',
            password_confirmation: 'confirmPassword',
          } as const;
          for (const [key, field] of Object.entries(mapping)) {
            const errors = error.fields?.[key];
            if (Array.isArray(errors) && typeof errors[0] === 'string') {
              const safe =
                /^(The current password is incorrect\.|The (?:current password|password|password confirmation) (?:field is required\.|confirmation does not match\.|field confirmation does not match\.|must be at least \d+ characters\.|field must be at least \d+ characters\.|must not exceed 72 bytes\.|field must be different from current password\.))$/.test(
                  errors[0],
                )
                  ? errors[0]
                  : 'Check this password field.';
              form.setError(field, { type: 'server', message: safe });
              if (safe === 'The current password is incorrect.') message = safe;
            }
          }
        }
        showToast('Password update failed', message, 'error');
      } finally {
        submitting.current = false;
        request.current = null;
        mutation.reset();
      }
    },
    () =>
      showToast(
        'Check password fields',
        'Complete the required fields and check your new password confirmation.',
        'warning',
      ),
  );
  const requirements = [
    ...(passwordChangePolicy?.minimumLength
      ? [
          {
            text: `At least ${passwordChangePolicy.minimumLength} characters`,
            met: newPassword.length >= passwordChangePolicy.minimumLength,
          },
        ]
      : []),
    ...(passwordChangePolicy?.requireUppercase
      ? [{ text: 'An uppercase letter', met: /[A-Z]/.test(newPassword) }]
      : []),
    ...(passwordChangePolicy?.requireLowercase
      ? [{ text: 'A lowercase letter', met: /[a-z]/.test(newPassword) }]
      : []),
    ...(passwordChangePolicy?.requireNumber
      ? [{ text: 'A number', met: /\d/.test(newPassword) }]
      : []),
    ...(passwordChangePolicy?.requireSymbol
      ? [{ text: 'A symbol', met: /[^A-Za-z0-9\s]/.test(newPassword) }]
      : []),
    ...(passwordChangePolicy?.rejectCurrentPassword
      ? [
          {
            text: 'Different from your current password',
            met: !!newPassword && newPassword !== currentPassword,
          },
        ]
      : []),
    {
      text: 'New passwords match',
      met: !!confirmation && newPassword === confirmation,
    },
  ];
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
              accessibilityLabel={
                returnToProfile ? 'Back to Profile' : 'Back to Settings'
              }
              disabled={busy || signOutRequired}
              onPress={back}
              style={styles.back}
            >
              <ArrowLeft size={24} color={colors.navy} />
            </Pressable>
            <AppText
              accessibilityRole="header"
              style={styles.title}
              color={colors.navy}
            >
              Change Password
            </AppText>
          </View>
          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={styles.illustration}
          >
            <LockKeyhole size={54} color={colors.primary} strokeWidth={1.5} />
            <View style={styles.badge}>
              <Check size={20} color={colors.primary} />
            </View>
          </View>
          {signOutRequired ? (
            <View style={styles.form}>
              <AppText color={colors.navy} accessibilityRole="alert">
                Your session must end. Sign in again to continue.
              </AppText>
              {!!signOutError && (
                <AppText accessibilityRole="alert" color={colors.danger}>
                  {signOutError}
                </AppText>
              )}
              <GradientButton
                title="Retry secure sign out"
                icon="none"
                loading={signOutBusy}
                onPress={() => {
                  secureSignOut().catch(() => {});
                }}
              />
            </View>
          ) : (
            <>
              <AppText color={colors.navy} style={styles.description}>
                Keep your account secure with a password only you know.
              </AppText>
              {demo && (
                <AppText color={colors.primary} variant="caption">
                  UI preview only. No authenticated password will be changed.
                </AppText>
              )}
              {status !== 'authenticated' && !demo && (
                <AppText accessibilityRole="alert" color={colors.danger}>
                  Sign in to change your password.
                </AppText>
              )}
              <View style={styles.form}>
                {fields.map((field, index) => {
                  const Icon = visible[field.name] ? EyeOff : Eye;
                  return (
                    <React.Fragment key={field.name}>
                      <View
                        style={[
                          styles.inputFrame,
                          focus === field.name && styles.focused,
                        ]}
                      >
                        <Controller
                          control={form.control}
                          name={field.name}
                          render={({
                            field: { value, onChange, onBlur, ref },
                            fieldState,
                          }) => (
                            <AppInput
                              ref={node => {
                                refs.current[field.name] = node;
                                ref(node);
                              }}
                              label={field.label}
                              placeholder={field.label}
                              value={value}
                              onChangeText={text => {
                                onChange(text);
                                form.clearErrors('root');
                              }}
                              onFocus={() => setFocus(field.name)}
                              onBlur={() => {
                                setFocus('');
                                onBlur();
                              }}
                              error={fieldState.error?.message}
                              editable={!busy}
                              leftIcon={
                                <LockKeyhole size={21} color={colors.primary} />
                              }
                              rightAccessory={
                                <Pressable
                                  cssInterop={false}
                                  accessibilityRole="button"
                                  accessibilityLabel={`${
                                    visible[field.name] ? 'Hide' : 'Show'
                                  } ${field.label.toLowerCase()}`}
                                  disabled={busy}
                                  onPress={() =>
                                    setVisible(state => ({
                                      ...state,
                                      [field.name]: !state[field.name],
                                    }))
                                  }
                                  style={styles.eye}
                                >
                                  <Icon size={21} color={colors.secondary} />
                                </Pressable>
                              }
                              secureTextEntry={!visible[field.name]}
                              autoCapitalize="none"
                              autoCorrect={false}
                              autoComplete={
                                field.name === 'currentPassword'
                                  ? 'current-password'
                                  : 'new-password'
                              }
                              textContentType={
                                field.name === 'currentPassword'
                                  ? 'password'
                                  : 'newPassword'
                              }
                              returnKeyType={index === 2 ? 'done' : 'next'}
                              submitBehavior="submit"
                              onSubmitEditing={() => {
                                if (index < fields.length - 1)
                                  refs.current[fields[index + 1].name]?.focus();
                                else {
                                  submit().catch(() => {});
                                }
                              }}
                            />
                          )}
                        />
                      </View>
                      {field.name === 'newPassword' && (
                        <View style={styles.requirements}>
                          {!passwordChangePolicy && (
                            <AppText variant="caption">
                              Password requirements are not configured yet. The
                              verified backend policy is required before updates
                              can be enabled.
                            </AppText>
                          )}
                          {requirements.map(item => (
                            <View key={item.text} style={styles.requirement}>
                              <Check
                                size={14}
                                color={
                                  item.met ? colors.success : colors.textMuted
                                }
                              />
                              <AppText
                                variant="caption"
                                color={
                                  item.met ? colors.success : colors.textMuted
                                }
                              >
                                {item.text}
                              </AppText>
                            </View>
                          ))}
                        </View>
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
              <View style={styles.tip}>
                <LockKeyhole size={20} color={colors.primary} />
                <AppText style={styles.tipText}>
                  Security tip: use a unique password and never share it with
                  anyone.
                </AppText>
              </View>
              {!!form.formState.errors.root?.server?.message && (
                <AppText
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  color={colors.danger}
                >
                  {form.formState.errors.root.server.message}
                </AppText>
              )}
              <GradientButton
                title="Change Password"
                icon="none"
                loading={busy}
                disabled={status !== 'authenticated' && !demo}
                onPress={() => {
                  submit().catch(() => {});
                }}
              />
            </>
          )}
        </ScreenContainer>
      </KeyboardScreen>
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  content: {
    maxWidth: 440,
    gap: 22,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 28,
  },
  header: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 42,
  },
  back: {
    position: 'absolute',
    left: -8,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  illustration: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.softPink,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 7,
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    width: 32,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: { textAlign: 'center', fontSize: 14, lineHeight: 22 },
  form: { gap: 14 },
  inputFrame: {
    borderWidth: 1,
    borderColor: colors.white,
    padding: 2,
    borderRadius: 16,
  },
  focused: { borderColor: colors.primary },
  eye: {
    width: 48,
    height: 48,
    marginRight: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requirements: { paddingHorizontal: 4, gap: 7, marginTop: -5 },
  requirement: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tip: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.palePink,
    padding: 16,
    borderRadius: 14,
  },
  tipText: { flex: 1, fontSize: 13, lineHeight: 20 },
});
