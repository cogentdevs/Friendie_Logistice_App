import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import { logoutSession } from '../../auth/services/sessionLogout';
import {
  ChangePasswordValues,
  createChangePasswordSchema,
  passwordChangeResultSchema,
} from '../schemas/changePasswordSchema';
import {
  changePasswordService,
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
  const owner = useAuthStore(state => state.user?.id),
    status = useAuthStore(state => state.status);
  const demo = isUiPreviewActive();
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(createChangePasswordSchema(passwordChangePolicy)),
    mode: 'onBlur',
    defaultValues: blank,
  });
  const mutation = useMutation({
    mutationFn: (values: ChangePasswordValues) =>
      changePasswordService.update(values),
    retry: false,
    gcTime: 0,
  });
  const [visible, setVisible] = useState(hidden),
    [focus, setFocus] = useState('');
  const [signOutRequired, setSignOutRequired] = useState(false),
    [signOutBusy, setSignOutBusy] = useState(false),
    [signOutError, setSignOutError] = useState('');
  const submitting = useRef(false),
    cleaning = useRef(false);
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
    if (cleaning.current) return;
    cleaning.current = true;
    setSignOutBusy(true);
    setSignOutError('');
    try {
      const result = await logoutSession(client);
      if (!result.cacheCleared)
        Alert.alert(
          'Signed out',
          'Some local app data could not be removed. Clear it before sharing this device.',
        );
    } catch {
      setSignOutError(
        'Could not clear the secure session. Retry sign out before continuing.',
      );
    } finally {
      cleaning.current = false;
      setSignOutBusy(false);
    }
  };
  const submit = form.handleSubmit(async values => {
    if (submitting.current || signOutRequired) return;
    submitting.current = true;
    Keyboard.dismiss();
    form.clearErrors('root');
    const account = owner;
    try {
      const result = passwordChangeResultSchema.parse(
        await mutation.mutateAsync(values),
      );
      if (
        demo ||
        !account ||
        useAuthStore.getState().status !== 'authenticated' ||
        useAuthStore.getState().user?.id !== account
      )
        throw new Error('Session changed');
      form.reset(blank);
      setVisible(hidden);
      if (result.session === 'revoked') {
        setSignOutRequired(true);
        await secureSignOut();
      } else
        Alert.alert(
          'Password updated',
          'Your password was updated successfully.',
          [
            {
              text: returnToProfile ? 'Back to Profile' : 'Back to Settings',
              onPress: back,
            },
          ],
        );
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.kind === 'unauthorized' &&
        !(
          useAuthStore.getState().status === 'authenticated' &&
          useAuthStore.getState().user?.id !== account
        )
      ) {
        form.reset(blank);
        setVisible(hidden);
        setSignOutRequired(true);
        await secureSignOut();
      } else {
        const message =
          error instanceof ApiError
            ? error.kind === 'network'
              ? 'Unable to connect or request timed out. Please try again.'
              : error.kind === 'rate-limit'
              ? 'Too many attempts. Please wait before trying again.'
              : error.kind === 'server'
              ? 'Password updates are temporarily unavailable. Please try again later.'
              : error.kind === 'validation'
              ? 'Check the password fields and try again.'
              : 'Password updates are not connected yet. Your password has not been changed.'
            : 'Unable to confirm the password update. Please try again.';
        form.setError('root.server', { message });
        if (error instanceof ApiError && error.kind === 'validation') {
          // Defensive domain-field mapping only; the actual Laravel DTO still needs verification.
          for (const field of fields)
            if (error.fields?.[field.name]?.length)
              form.setError(field.name, {
                type: 'server',
                message:
                  field.name === 'currentPassword'
                    ? 'The current password could not be verified.'
                    : field.name === 'confirmPassword'
                    ? 'Check that your new passwords match.'
                    : 'The new password does not meet the required policy.',
              });
        }
      }
    } finally {
      submitting.current = false;
      mutation.reset();
    }
  });
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
