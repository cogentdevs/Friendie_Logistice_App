import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import {
  useFocusEffect,
  useIsFocused,
  usePreventRemove,
} from '@react-navigation/native';
import { DrawerScreenProps } from '@react-navigation/drawer';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleHelp,
  Mail,
  MapPin,
  Phone,
  UserRound,
  Clock,
} from 'lucide-react-native';
import { DrawerParamList } from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { KeyboardScreen } from '../../../components/layout/KeyboardScreen';
import { AppText } from '../../../components/ui/AppText';
import { AppInput } from '../../../components/ui/AppInput';
import { GradientButton } from '../../../components/ui/GradientButton';
import { colors } from '../../../theme';
import { useAuthStore } from '../../../store/authStore';
import { ApiError } from '../../../types/api';
import {
  contactSchema,
  ContactValues,
  contactAcceptanceSchema,
} from '../schemas/contactSchema';
import {
  contactService,
  supportConfig,
  contactError,
} from '../services/contactService';
type Props = DrawerScreenProps<DrawerParamList, 'ContactUs'>;
export function ContactUsScreen({
  navigation,
  onReturn,
}: Props & { onReturn?: () => void }) {
  const user = useAuthStore(s =>
    s.status === 'authenticated' ? s.user : null,
  );
  const focused = useIsFocused();
  const [picker, setPicker] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    reference?: string;
  } | null>(null);
  const submission = useRef(false),
    confirming = useRef(false);
  const emailRef = useRef<React.ComponentRef<typeof TextInput>>(null),
    subjectRef = useRef<React.ComponentRef<typeof TextInput>>(null),
    messageRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    mode: 'onBlur',
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      subject: '',
      category: '',
      message: '',
    },
  });
  const request = useMutation({
    mutationFn: contactService.submit,
    retry: false,
    gcTime: 0,
  });
  const busy = request.isPending || form.formState.isSubmitting;
  usePreventRemove(
    focused && (form.formState.isDirty || busy) && !confirmation,
    ({ data }) => {
      if (submission.current) {
        Alert.alert('Please wait', 'Wait for the support request to finish.');
        return;
      }
      if (confirming.current) return;
      confirming.current = true;
      Alert.alert(
        'Discard message?',
        'Your unsent message will be discarded.',
        [
          {
            text: 'Keep Editing',
            style: 'cancel',
            onPress: () => {
              confirming.current = false;
            },
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              confirming.current = false;
              navigation.dispatch(data.action);
            },
          },
        ],
        { cancelable: false },
      );
    },
  );
  const submit = form.handleSubmit(async values => {
    if (submission.current) return;
    submission.current = true;
    form.clearErrors('root');
    Keyboard.dismiss();
    try {
      const result = contactAcceptanceSchema.parse(
        await request.mutateAsync(values),
      );
      form.reset();
      setConfirmation(result);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 && error.fields) {
        for (const key of [
          'name',
          'email',
          'subject',
          'category',
          'message',
        ] as const) {
          if (error.fields[key]?.[0])
            form.setError(key, {
              type: 'server',
              message: error.fields[key][0],
            });
        }
      }
      form.setError('root.server', { message: contactError(error) });
    } finally {
      submission.current = false;
      request.reset();
    }
  });
  const back = useCallback(() => {
    if (submission.current) {
      Alert.alert('Please wait', 'Wait for the support request to finish.');
      return;
    }
    const leave = () =>
      onReturn ? onReturn() : navigation.navigate('HelpSupport');
    if (!form.formState.isDirty || confirmation) {
      leave();
      return;
    }
    if (confirming.current) return;
    confirming.current = true;
    Alert.alert(
      'Discard message?',
      'Your unsent message will be discarded.',
      [
        {
          text: 'Keep Editing',
          style: 'cancel',
          onPress: () => {
            confirming.current = false;
          },
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            confirming.current = false;
            form.reset();
            leave();
          },
        },
      ],
      { cancelable: false },
    );
  }, [navigation, form, confirmation, onReturn]);
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          back();
          return true;
        },
      );
      return () => subscription.remove();
    }, [back]),
  );
  const category = supportConfig.categories.find(
    c => c.id === form.watch('category'),
  );
  return (
    <SafeScreen
      edges={['top', 'bottom', 'left', 'right']}
      backgroundColor={colors.white}
    >
      {focused && <StatusBar barStyle="dark-content" />}
      <View style={styles.header}>
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          accessibilityLabel="Back from Contact Us"
          style={styles.back}
          onPress={back}
        >
          <ArrowLeft color={colors.navy} size={24} />
        </Pressable>
        <AppText
          accessibilityRole="header"
          style={styles.title}
          color={colors.navy}
        >
          Contact Us
        </AppText>
      </View>
      <KeyboardScreen>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.content}
        >
          <View style={styles.illustration}>
            {confirmation ? (
              <Check size={44} color={colors.primary} />
            ) : (
              <CircleHelp size={52} color={colors.primary} />
            )}
            <View style={styles.envelope}>
              <Mail size={22} color={colors.primary} />
            </View>
          </View>
          <AppText
            accessibilityRole="header"
            color={colors.navy}
            style={styles.heading}
          >
            {confirmation ? 'Message Received' : "We're Here to Help"}
          </AppText>
          <AppText style={styles.description}>
            {confirmation
              ? 'Your message has been accepted by our support team.'
              : 'Have a question or need assistance? Send us a message.'}
          </AppText>
          {confirmation ? (
            <>
              <AppText accessibilityLiveRegion="polite">
                {confirmation.reference
                  ? 'Reference: ' + confirmation.reference
                  : 'Thank you for contacting us.'}
              </AppText>
              <GradientButton title="Back" icon="none" onPress={back} />
            </>
          ) : (
            <>
              {[
                {
                  value: supportConfig.email,
                  label: 'Support email',
                  Icon: Mail,
                },
                {
                  value: supportConfig.phone,
                  label: 'Phone number',
                  Icon: Phone,
                },
                {
                  value: supportConfig.address,
                  label: 'Office address',
                  Icon: MapPin,
                },
                {
                  value: supportConfig.hours,
                  label: 'Business hours',
                  Icon: Clock,
                },
              ]
                .filter(item => !!item.value)
                .map(({ value, label, Icon }) => (
                  <View key={label} style={styles.info}>
                    <Icon size={22} color={colors.primary} />
                    <View style={styles.infoText}>
                      <AppText variant="caption">{label}</AppText>
                      <AppText selectable color={colors.navy}>
                        {value}
                      </AppText>
                    </View>
                  </View>
                ))}
              <AppText variant="caption">
                Contact submissions are not connected yet. No message will be
                sent until support is configured.
              </AppText>
              {(['name', 'email', 'subject'] as const).map((name, index) => (
                <Controller
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field, fieldState }) => (
                    <AppInput
                      ref={
                        name === 'email'
                          ? emailRef
                          : name === 'subject'
                          ? subjectRef
                          : field.ref
                      }
                      label={['Full Name', 'Email Address', 'Subject'][index]}
                      placeholder={
                        [
                          'Enter your full name',
                          'Enter your email address',
                          'How can we help?',
                        ][index]
                      }
                      leftIcon={
                        name === 'name' ? (
                          <UserRound size={20} color={colors.primary} />
                        ) : name === 'email' ? (
                          <Mail size={20} color={colors.primary} />
                        ) : undefined
                      }
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message}
                      editable={!busy}
                      autoCapitalize={
                        name === 'email'
                          ? 'none'
                          : name === 'name'
                          ? 'words'
                          : 'sentences'
                      }
                      keyboardType={
                        name === 'email' ? 'email-address' : 'default'
                      }
                      autoCorrect={name !== 'email'}
                      returnKeyType="next"
                      maxLength={
                        name === 'name' ? 100 : name === 'email' ? 254 : 150
                      }
                      onSubmitEditing={() =>
                        name === 'name'
                          ? emailRef.current?.focus()
                          : name === 'email'
                          ? subjectRef.current?.focus()
                          : messageRef.current?.focus()
                      }
                    />
                  )}
                />
              ))}
              <View style={styles.field}>
                <AppText color={colors.navy}>Category</AppText>
                <Pressable
                  cssInterop={false}
                  accessibilityRole="button"
                  accessibilityLabel="Select support category"
                  accessibilityState={{ expanded: picker, disabled: busy }}
                  disabled={busy}
                  style={styles.selector}
                  onPress={() => setPicker(true)}
                >
                  <AppText color={category ? colors.navy : colors.textMuted}>
                    {category?.name ?? 'Select category'}
                  </AppText>
                  <ChevronDown size={20} color={colors.primary} />
                </Pressable>
                {form.formState.errors.category && (
                  <AppText
                    accessibilityLiveRegion="polite"
                    color={colors.danger}
                  >
                    {form.formState.errors.category.message}
                  </AppText>
                )}
              </View>
              <Controller
                control={form.control}
                name="message"
                render={({ field, fieldState }) => (
                  <AppInput
                    ref={messageRef}
                    label="Message"
                    placeholder="Tell us how we can help..."
                    multiline
                    textAlignVertical="top"
                    style={styles.message}
                    maxLength={5000}
                    editable={!busy}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <AppText variant="caption">
                {form.watch('message').length}/5,000 characters (minimum 10)
              </AppText>
              {form.formState.errors.root?.server && (
                <AppText accessibilityRole="alert" color={colors.danger}>
                  {form.formState.errors.root.server.message}
                </AppText>
              )}
              <GradientButton
                title="Send Message"
                icon="none"
                loading={busy}
                onPress={() => {
                  submit().catch(() => {});
                }}
              />
            </>
          )}
        </ScrollView>
      </KeyboardScreen>
      <Modal
        visible={picker}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(false)}
      >
        <View style={styles.overlay}>
          <View accessibilityViewIsModal style={styles.sheet}>
            <AppText
              accessibilityRole="header"
              color={colors.navy}
              style={styles.title}
            >
              Category
            </AppText>
            <ScrollView>
              {supportConfig.categories.length ? (
                supportConfig.categories.map(item => (
                  <Pressable
                    cssInterop={false}
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={item.name}
                    style={styles.option}
                    onPress={() => {
                      form.setValue('category', item.id, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                      setPicker(false);
                    }}
                  >
                    <AppText color={colors.navy}>{item.name}</AppText>
                  </Pressable>
                ))
              ) : (
                <AppText style={styles.option}>
                  Support categories are not available yet.
                </AppText>
              )}
            </ScrollView>
            <GradientButton
              title="Close categories"
              icon="none"
              onPress={() => setPicker(false)}
            />
          </View>
        </View>
      </Modal>
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  back: {
    position: 'absolute',
    left: 10,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    padding: 20,
    gap: 18,
    paddingBottom: 32,
  },
  illustration: {
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: colors.softPink,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  envelope: {
    position: 'absolute',
    right: -6,
    bottom: 5,
    padding: 8,
    borderRadius: 14,
    backgroundColor: colors.palePink,
  },
  heading: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: { textAlign: 'center', lineHeight: 23 },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: { flex: 1, gap: 4 },
  field: { gap: 8 },
  selector: {
    minHeight: 54,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  message: { minHeight: 132 },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.navy + '66',
  },
  sheet: {
    maxHeight: '80%',
    padding: 20,
    gap: 20,
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  option: { paddingVertical: 16, minHeight: 48 },
});
