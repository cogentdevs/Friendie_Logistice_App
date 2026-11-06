import React, { useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { CompositeScreenProps, useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
} from 'lucide-react-native';
import {
  AuthStackParamList,
  RootStackParamList,
} from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { KeyboardScreen } from '../../../components/layout/KeyboardScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { BrandLogo } from '../../../components/common/BrandLogo';
import { AppText } from '../../../components/ui/AppText';
import { AppInput } from '../../../components/ui/AppInput';
import { GradientButton } from '../../../components/ui/GradientButton';
import { colors } from '../../../theme';
import { ApiError } from '../../../types/api';
import { registerSchema, RegisterValues } from '../schemas/registerSchema';
import { registrationService } from '../services/registrationService';
import { CallingCodeSelector } from '../components/CallingCodeSelector';

type Props = CompositeScreenProps<
  NativeStackScreenProps<AuthStackParamList, 'Register'>,
  NativeStackScreenProps<RootStackParamList>
>;
const fields = [
  {
    name: 'fullName',
    label: 'Full Name',
    placeholder: 'Enter your full name',
    icon: UserRound,
  },
  {
    name: 'email',
    label: 'Email Address',
    placeholder: 'Enter your email address',
    icon: Mail,
  },
  {
    name: 'phone',
    label: 'Phone Number',
    placeholder: 'Enter phone number',
    icon: UserRound,
  },
  {
    name: 'password',
    label: 'Password',
    placeholder: 'Create password',
    icon: LockKeyhole,
  },
  {
    name: 'confirmPassword',
    label: 'Confirm Password',
    placeholder: 'Confirm your password',
    icon: LockKeyhole,
  },
] as const;
type TextField = (typeof fields)[number]['name'];
export function RegisterScreen({ navigation }: Props) {
  const focused = useIsFocused();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: {
      fullName: '',
      email: '',
      country: 'PK',
      phone: '',
      password: '',
      confirmPassword: '',
      acceptedTerms: false,
    },
  });
  const register = useMutation({
    mutationFn: registrationService.register,
    retry: false,
    gcTime: 0,
  });
  const submitting = useRef(false);
  const refs = useRef<
    Partial<Record<TextField, React.ComponentRef<typeof TextInput> | null>>
  >({});
  const [visible, setVisible] = useState({
    password: false,
    confirmPassword: false,
  });
  const [password, confirmation, consent, country] = form.watch([
    'password',
    'confirmPassword',
    'acceptedTerms',
    'country',
  ]);
  const busy = form.formState.isSubmitting || register.isPending;
  const toLogin = () => navigation.popTo('Login');
  const openLegal = (kind: 'terms' | 'privacy') =>
    navigation.navigate(
      kind === 'privacy' ? 'PrivacyPolicy' : 'TermsConditions',
    );
  const submit = form.handleSubmit(async values => {
    if (submitting.current) return;
    submitting.current = true;
    Keyboard.dismiss();
    form.clearErrors('root');
    try {
      await register.mutateAsync(values);
      // No success navigation: the registration/session/verification contract is not yet verified.
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.kind === 'rate-limit'
            ? 'Too many attempts. Please wait before trying again.'
            : error.kind === 'network'
            ? 'Unable to connect. Check your connection and try again.'
            : error.kind === 'server'
            ? 'Account creation is temporarily unavailable. Please try again later.'
            : error.message
          : 'Unable to create an account. Please try again.';
      form.setError('root.server', { message });
      if (error instanceof ApiError) {
        let first: TextField | undefined;
        for (const field of fields) {
          const text = error.fields?.[field.name]?.[0];
          if (typeof text === 'string' && text) {
            form.setError(field.name, { type: 'server', message: text });
            first ??= field.name;
          }
        }
        if (first) form.setFocus(first);
      }
    } finally {
      submitting.current = false;
      register.reset();
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
              onPress={toLogin}
              style={styles.back}
            >
              <ArrowLeft size={24} color={colors.navy} />
            </Pressable>
            <BrandLogo width={170} variant="color" />
          </View>
          <View style={styles.intro}>
            <AppText
              accessibilityRole="header"
              color={colors.navy}
              style={styles.heading}
            >
              Create Account
            </AppText>
            <AppText style={styles.subtitle}>
              Join Friendie Logistics and connect with trusted travellers
              worldwide.
            </AppText>
          </View>
          <View style={styles.form}>
            {fields.map((field, index) => {
              const secret =
                field.name === 'password' || field.name === 'confirmPassword';
              const shown =
                secret && visible[field.name as keyof typeof visible];
              const Icon = field.icon,
                EyeIcon = shown ? EyeOff : Eye;
              return (
                <React.Fragment key={field.name}>
                  <Controller
                    control={form.control}
                    name={field.name}
                    render={({
                      field: { value, onChange, onBlur, ref },
                      fieldState,
                    }) => (
                      <AppInput
                        ref={input => {
                          refs.current[field.name] = input;
                          ref(input);
                        }}
                        label={field.label}
                        hideLabel
                        placeholder={field.placeholder}
                        leftIcon={
                          field.name === 'phone' ? (
                            <CallingCodeSelector
                              value={country}
                              disabled={busy}
                              onChange={selectedCountry => {
                                form.setValue('country', selectedCountry, {
                                  shouldDirty: true,
                                });
                                if (form.getValues('phone'))
                                  form.trigger('phone').catch(() => {});
                                form.clearErrors('root');
                              }}
                            />
                          ) : (
                            <Icon size={21} color={colors.secondary} />
                          )
                        }
                        rightAccessory={
                          secret ? (
                            <Pressable
                              cssInterop={false}
                              accessibilityRole="button"
                              accessibilityLabel={`${shown ? 'Hide' : 'Show'} ${
                                field.name === 'password'
                                  ? 'password'
                                  : 'confirm password'
                              }`}
                              accessibilityState={{ disabled: busy }}
                              disabled={busy}
                              onPress={() =>
                                setVisible(state => ({
                                  ...state,
                                  [field.name]: !shown,
                                }))
                              }
                              style={styles.eye}
                            >
                              <EyeIcon size={21} color={colors.secondary} />
                            </Pressable>
                          ) : undefined
                        }
                        value={value}
                        onChangeText={text => {
                          form.clearErrors('root');
                          onChange(text);
                        }}
                        onBlur={onBlur}
                        error={fieldState.error?.message}
                        editable={!busy}
                        keyboardType={
                          field.name === 'email'
                            ? 'email-address'
                            : field.name === 'phone'
                            ? 'phone-pad'
                            : 'default'
                        }
                        autoCapitalize={
                          field.name === 'fullName' ? 'words' : 'none'
                        }
                        autoCorrect={false}
                        autoComplete={
                          secret
                            ? 'new-password'
                            : field.name === 'email'
                            ? 'email'
                            : field.name === 'phone'
                            ? 'tel-national'
                            : 'name'
                        }
                        textContentType={
                          secret
                            ? 'newPassword'
                            : field.name === 'email'
                            ? 'emailAddress'
                            : field.name === 'phone'
                            ? 'telephoneNumber'
                            : 'name'
                        }
                        secureTextEntry={secret && !shown}
                        returnKeyType={
                          index === fields.length - 1 ? 'done' : 'next'
                        }
                        submitBehavior="submit"
                        onSubmitEditing={() => {
                          if (index < fields.length - 1)
                            refs.current[fields[index + 1].name]?.focus();
                          else Keyboard.dismiss();
                        }}
                      />
                    )}
                  />
                  {field.name === 'password' && (
                    <Requirement
                      met={password.length >= 8}
                      text="At least 8 characters"
                    />
                  )}
                  {field.name === 'confirmPassword' && (
                    <Requirement
                      met={!!confirmation && password === confirmation}
                      text="Passwords match"
                    />
                  )}
                </React.Fragment>
              );
            })}
          </View>
          <View style={styles.terms}>
            <Controller
              control={form.control}
              name="acceptedTerms"
              render={({ field: { value, onChange }, fieldState }) => (
                <View>
                  <View style={styles.consentRow}>
                    <Pressable
                      cssInterop={false}
                      accessibilityRole="checkbox"
                      accessibilityLabel="I agree to the Terms & Conditions and Privacy Policy"
                      accessibilityState={{ checked: value, disabled: busy }}
                      disabled={busy}
                      onPress={() => {
                        onChange(!value);
                        form.clearErrors('root');
                      }}
                      style={styles.checkboxTouch}
                    >
                      <View style={[styles.checkbox, value && styles.checked]}>
                        {value && <Check size={16} color={colors.white} />}
                      </View>
                    </Pressable>
                    <View style={styles.legalCopy}>
                      <AppText style={styles.small}>I agree to the</AppText>
                      <Pressable
                        cssInterop={false}
                        accessibilityRole="link"
                        accessibilityLabel="Terms & Conditions"
                        disabled={busy}
                        onPress={() => {
                          openLegal('terms');
                        }}
                        style={styles.legalLink}
                      >
                        <AppText color={colors.primary} style={styles.small}>
                          Terms & Conditions
                        </AppText>
                      </Pressable>
                      <AppText style={styles.small}>and</AppText>
                      <Pressable
                        cssInterop={false}
                        accessibilityRole="link"
                        accessibilityLabel="Privacy Policy"
                        disabled={busy}
                        onPress={() => {
                          openLegal('privacy');
                        }}
                        style={styles.legalLink}
                      >
                        <AppText color={colors.primary} style={styles.small}>
                          Privacy Policy.
                        </AppText>
                      </Pressable>
                    </View>
                  </View>
                  {fieldState.error && (
                    <AppText
                      accessibilityLiveRegion="polite"
                      color={colors.danger}
                      variant="caption"
                    >
                      {fieldState.error.message}
                    </AppText>
                  )}
                </View>
              )}
            />
          </View>
          {form.formState.errors.root?.server?.message && (
            <AppText
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              color={colors.danger}
            >
              {form.formState.errors.root.server.message}
            </AppText>
          )}
          <GradientButton
            title="Create Account"
            icon="none"
            disabled={!consent || busy}
            loading={busy}
            onPress={() => {
              submit().catch(() => {});
            }}
          />
          <View style={styles.footer}>
            <AppText style={styles.small}>Already have an account?</AppText>
            <Pressable
              cssInterop={false}
              accessibilityRole="link"
              accessibilityLabel="Sign In"
              disabled={busy}
              onPress={toLogin}
              style={styles.signIn}
            >
              <AppText color={colors.primary} style={styles.link}>
                Sign In
              </AppText>
            </Pressable>
          </View>
        </ScreenContainer>
      </KeyboardScreen>
    </SafeScreen>
  );
}
function Requirement({ met, text }: { met: boolean; text: string }) {
  return (
    <View style={styles.requirement}>
      <Check size={14} color={met ? colors.success : colors.textMuted} />
      <AppText
        variant="caption"
        color={met ? colors.success : colors.textMuted}
      >
        {text}
      </AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  content: { maxWidth: 440, gap: 18, paddingTop: 8, paddingBottom: 24 },
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
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intro: { gap: 8, marginBottom: 6 },
  heading: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  subtitle: { fontSize: 14, lineHeight: 21 },
  form: { gap: 14 },
  eye: {
    width: 48,
    height: 48,
    marginRight: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -7,
  },
  terms: { gap: 8 },
  consentRow: { flexDirection: 'row', alignItems: 'center' },
  checkboxTouch: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.textMuted,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { backgroundColor: colors.primary, borderColor: colors.primary },
  legalCopy: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 4,
  },
  legalLink: { minHeight: 44, justifyContent: 'center' },
  small: { fontSize: 13, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  signIn: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  link: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
});
