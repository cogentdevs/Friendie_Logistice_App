import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useIsFocused, usePreventRemove } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Camera,
  Check,
  Mail,
  UserRound,
  Phone,
} from 'lucide-react-native';
import { ProfileStackParamList } from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { KeyboardScreen } from '../../../components/layout/KeyboardScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { AppText } from '../../../components/ui/AppText';
import { AppInput } from '../../../components/ui/AppInput';
import { AppAvatar } from '../../../components/ui/AppAvatar';
import { AppButton } from '../../../components/ui/AppButton';
import { GradientButton } from '../../../components/ui/GradientButton';
import { CallingCodeSelector } from '../../auth/components/CallingCodeSelector';
import { phoneCountries } from '../../auth/schemas/registerSchema';
import { colors } from '../../../theme';
import { ApiError } from '../../../types/api';
import { useAuthStore } from '../../../store/authStore';
import { isUiPreviewActive } from '../../../store/developmentStore';
import { useProfile } from '../hooks/useProfile';
import { Profile, profileSchema } from '../services/profileService';
import {
  createEditProfileSchema,
  EditProfileValues,
} from '../schemas/editProfileSchema';
import {
  profileEditService,
  profileCallingCountry,
  profileUpdateErrorMessage,
  AvatarPartialSaveError,
} from '../services/profileEditService';
import Toast from 'react-native-toast-message';
import { clearPrivateAccountMemory } from '../../auth/services/sessionLogout';
import {
  AvatarDraft,
  chooseProfilePhoto,
  PhotoPermissionError,
} from '../services/profilePhotoService';
import {
  avatarUploadRecovery,
  completeAvatarUpload,
  AvatarUploadUncertainError,
} from '../services/profileAvatarService';
type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;
export function EditProfileScreen({ navigation }: Props) {
  const { query, demo } = useProfile();
  return (
    <SafeScreen
      edges={['top', 'bottom', 'left', 'right']}
      backgroundColor={colors.white}
    >
      <EditStatusBar />
      {!query.data ? (
        <ScreenContainer backgroundColor={colors.white}>
          <EditorHeader back={() => navigation.popTo('Profile')} />
          {query.isPending ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <AppText>Loading your profile...</AppText>
            </View>
          ) : (
            <View style={styles.loading}>
              <AppText accessibilityRole="alert">
                Unable to load your profile. Check your connection and try
                again.
              </AppText>
              <AppButton
                title="Retry profile"
                onPress={() => {
                  query.refetch().catch(() => {});
                }}
              />
            </View>
          )}
        </ScreenContainer>
      ) : (
        <ProfileEditor
          key={`${demo ? 'demo' : query.data.id}`}
          profile={query.data}
          demo={demo}
          navigation={navigation}
          refreshError={query.isError}
        />
      )}
    </SafeScreen>
  );
}
function EditStatusBar() {
  return useIsFocused() ? <StatusBar barStyle="dark-content" /> : null;
}
function EditorHeader({ back }: { back: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable
        cssInterop={false}
        accessibilityRole="button"
        accessibilityLabel="Back to Profile"
        onPress={back}
        style={styles.back}
      >
        <ArrowLeft size={24} color={colors.navy} />
      </Pressable>
      <AppText
        accessibilityRole="header"
        color={colors.navy}
        style={styles.title}
      >
        Edit Profile
      </AppText>
    </View>
  );
}
function ProfileEditor({
  profile: incoming,
  demo,
  navigation,
  refreshError,
}: {
  profile: Profile;
  demo: boolean;
  navigation: Props['navigation'];
  refreshError: boolean;
}) {
  // Keep the loaded baseline stable while the user edits or returns from another screen.
  const profile = useRef(incoming).current;
  const focused = useIsFocused(),
    client = useQueryClient();
  const [photo, setPhoto] = useState<AvatarDraft | undefined>(() =>
    demo ? undefined : avatarUploadRecovery()?.avatar,
  );
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoError, setPhotoError] = useState(() =>
    !demo && avatarUploadRecovery()?.phase === 'unknown'
      ? new AvatarUploadUncertainError().message
      : '',
  );
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [picking, setPicking] = useState(false);
  const [failedUri, setFailedUri] = useState<string>();
  const failedPreview = useRef<string | undefined>(undefined);
  const previewUri = useRef<string | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const submission = useRef(false),
    choosing = useRef(false),
    confirming = useRef(false);
  const refs = useRef<
    Partial<
      Record<'email' | 'phone', React.ComponentRef<typeof TextInput> | null>
    >
  >({});
  const form = useForm<EditProfileValues>({
    resolver: zodResolver(createEditProfileSchema(!profile.phone)),
    mode: 'onBlur',
    defaultValues: {
      name: profile.name,
      email: profile.email,
      phone: profile.phone ?? '',
      callingCountry: profileCallingCountry(profile),
    },
  });
  const [name, email, phone, callingCountry] = form.watch([
    'name',
    'email',
    'phone',
    'callingCountry',
  ]);
  const request = useRef<AbortController | null>(null);
  const editorSession = useRef(useAuthStore.getState()).current;
  const lifecycle = useRef({ active: false, generation: 0 });
  const currentEditor = () =>
    lifecycle.current.active &&
    (demo
      ? isUiPreviewActive() &&
        useAuthStore.getState().status !== 'authenticated'
      : useAuthStore.getState().status === 'authenticated' &&
        useAuthStore.getState().user === editorSession.user);
  React.useLayoutEffect(() => {
    const life = lifecycle.current;
    life.active = focused;
    life.generation++;
    return () => {
      life.active = false;
      life.generation++;
    };
  }, [focused]);
  React.useEffect(() => () => request.current?.abort(), []);
  React.useEffect(() => {
    if (!focused) request.current?.abort();
    else if (!choosing.current) setPicking(false);
  }, [focused]);
  const mutation = useMutation({
    mutationFn: (values: EditProfileValues) =>
      profileEditService.save(
        values,
        photo,
        removePhoto,
        profile,
        request.current?.signal,
      ),
    retry: false,
    gcTime: 0,
  });
  const busy = form.formState.isSubmitting || mutation.isPending || picking;
  const dirty = form.formState.isDirty || !!photo || removePhoto;
  const owner = useAuthStore(state => state.user?.id);
  const active = demo ? isUiPreviewActive() : owner === profile.id;
  usePreventRemove(focused && active && dirty && !saved, ({ data }) => {
    if (confirming.current) return;
    if (submission.current || choosing.current) {
      Toast.show({
        type: 'info',
        text1: 'Please wait',
        text2: 'Wait for the current operation to finish.',
      });
      return;
    }
    confirming.current = true;
    Alert.alert(
      'Discard changes?',
      'Your unsaved profile changes and selected photo will be discarded.',
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
      {
        cancelable: true,
        onDismiss: () => {
          confirming.current = false;
        },
      },
    );
  });
  const back = () => {
    Keyboard.dismiss();
    navigation.popTo('Profile');
  };
  const choose = async (source: 'camera' | 'gallery') => {
    if (choosing.current || submission.current || !currentEditor()) return;
    const generation = lifecycle.current.generation;
    choosing.current = true;
    setPicking(true);
    setPhotoError('');
    setPermissionDenied(false);
    try {
      const result = await chooseProfilePhoto(source);
      if (!currentEditor() || generation !== lifecycle.current.generation)
        return;
      if (result) {
        setPhoto(result);
        setRemovePhoto(false);
        setFailedUri(undefined);
        failedPreview.current = undefined;
      }
    } catch (error) {
      if (!currentEditor() || generation !== lifecycle.current.generation)
        return;
      setPermissionDenied(error instanceof PhotoPermissionError);
      const message =
        error instanceof Error
          ? error.message
          : 'Could not select a photo. Please try again.';
      setPhotoError(message);
      Toast.show({ type: 'error', text1: 'Photo unavailable', text2: message });
    } finally {
      choosing.current = false;
      if (currentEditor()) setPicking(false);
    }
  };
  const changePhoto = () => {
    Keyboard.dismiss();
    Alert.alert(
      'Upload New Photo',
      'Choose JPEG, PNG or WebP up to 2 MB. The selected photo is uploaded when you save.',
      [
        {
          text: 'Camera',
          onPress: () => {
            choose('camera').catch(() => {});
          },
        },
        {
          text: 'Photo Library',
          onPress: () => {
            choose('gallery').catch(() => {});
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };
  const save = form.handleSubmit(
    async values => {
      if (submission.current || choosing.current || !currentEditor()) return;
      if (photo && failedUri === photo.uri) {
        Toast.show({
          type: 'error',
          text1: 'Photo unavailable',
          text2: 'Choose a photo that can be opened before saving.',
        });
        return;
      }
      submission.current = true;
      request.current = new AbortController();
      Keyboard.dismiss();
      form.clearErrors('root');
      const session = useAuthStore.getState().user;
      try {
        const result = await mutation.mutateAsync(values);
        if (!lifecycle.current.active || request.current?.signal.aborted)
          return;
        const updated = profileSchema.parse(result.profile);
        if (result.reauthenticationRequired) {
          if (useAuthStore.getState().status === 'authenticated')
            throw new ApiError('Session changed.', 'cancelled');
          form.reset(values);
          clearPrivateAccountMemory(client);
          Toast.show({
            type: 'success',
            text1: 'Profile updated',
            text2: 'Verify your new email and sign in again.',
          });
          return;
        }
        if (
          demo ||
          updated.id !== profile.id ||
          useAuthStore.getState().status !== 'authenticated' ||
          useAuthStore.getState().user !== session
        )
          throw new ApiError('Profile session changed.', 'cancelled');
        await client.cancelQueries({
          queryKey: ['profile', profile.id],
          exact: true,
        });
        if (!currentEditor() || request.current?.signal.aborted) return;
        client.setQueryData(['profile', profile.id], updated);
        completeAvatarUpload(photo);
        form.reset(values);
        setPhoto(undefined);
        setRemovePhoto(false);
        setSaved(true);
        Toast.show({
          type: 'success',
          text1: 'Profile updated',
          text2: 'Your profile was updated successfully.',
        });
      } catch (error) {
        if (!lifecycle.current.active || request.current?.signal.aborted)
          return;
        if (error instanceof ApiError && error.kind === 'cancelled') return;
        if (
          error instanceof AvatarUploadUncertainError &&
          error.observedProfile?.id === profile.id &&
          currentEditor()
        ) {
          await client.cancelQueries({
            queryKey: ['profile', profile.id],
            exact: true,
          });
          if (!currentEditor() || request.current?.signal.aborted) return;
          client.setQueryData(['profile', profile.id], error.observedProfile);
        }
        if (
          useAuthStore.getState().user !== session &&
          !(
            error instanceof ApiError &&
            error.kind === 'unauthorized' &&
            useAuthStore.getState().status !== 'authenticated'
          )
        )
          return;
        if (
          error instanceof AvatarPartialSaveError &&
          useAuthStore.getState().user === session
        ) {
          await client.cancelQueries({
            queryKey: ['profile', profile.id],
            exact: true,
          });
          if (!currentEditor() || request.current?.signal.aborted) return;
          client.setQueryData<Profile>(['profile', profile.id], cached => ({
            ...(cached ?? profile),
            avatarUrl: error.avatarUrl,
          }));
        }
        if (error instanceof ApiError && error.kind === 'validation') {
          const mapping = {
            name: 'name',
            email: 'email',
            phone: 'phone',
            country_id: 'callingCountry',
          } as const;
          for (const [key, field] of Object.entries(mapping)) {
            const errors = error.fields?.[key];
            if (Array.isArray(errors) && typeof errors[0] === 'string') {
              const message =
                /^(The (?:name|email|phone|country id|country) (?:field is required\.|has already been taken\.|must be a valid email address\.|field must be a valid email address\.|may not be greater than 255 characters\.|field must not be greater than 255 characters\.)|The selected country id is invalid\.)$/.test(
                  errors[0],
                )
                  ? errors[0]
                  : 'Check this profile field.';
              form.setError(field, { type: 'server', message });
            }
          }
        }
        Toast.show({
          type:
            error instanceof AvatarUploadUncertainError ? 'warning' : 'error',
          text1:
            error instanceof AvatarUploadUncertainError
              ? 'Photo upload unconfirmed'
              : 'Profile update failed',
          text2: profileUpdateErrorMessage(error),
        });
      } finally {
        submission.current = false;
        request.current = null;
        mutation.reset();
      }
    },
    () =>
      Toast.show({
        type: 'warning',
        text1: 'Check profile fields',
        text2:
          'Complete the required fields and correct the highlighted values.',
      }),
  );
  React.useEffect(() => {
    if (saved) navigation.popTo('Profile');
  }, [saved, navigation]);
  const uri =
    photo?.uri ?? (removePhoto ? undefined : profile.avatarUrl ?? undefined);
  previewUri.current = uri;
  const uploadHeld = !demo && avatarUploadRecovery()?.phase === 'unknown';
  const fields = [
    { key: 'name', label: 'Full Name', icon: UserRound },
    { key: 'email', label: 'Email Address', icon: Mail },
    { key: 'phone', label: 'Phone Number', icon: Phone },
  ] as const;
  return (
    <KeyboardScreen>
      <ScreenContainer backgroundColor={colors.white} style={styles.content}>
        <EditorHeader back={back} />
        <View style={styles.photoSection}>
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel="Change profile avatar"
            disabled={busy || uploadHeld}
            onPress={changePhoto}
            style={styles.avatarRing}
          >
            {uri && failedUri !== uri ? (
              <Image
                accessibilityLabel="Profile photo preview"
                source={{ uri }}
                style={styles.avatar}
                onError={() => {
                  if (
                    !currentEditor() ||
                    previewUri.current !== uri ||
                    failedPreview.current === uri
                  )
                    return;
                  failedPreview.current = uri;
                  setFailedUri(uri);
                  if (photo?.uri === uri) {
                    const message =
                      'The selected image could not be opened. Please choose another photo.';
                    setPhotoError(message);
                    Toast.show({
                      type: 'error',
                      text1: 'Photo unavailable',
                      text2: message,
                    });
                  }
                }}
              />
            ) : (
              <AppAvatar name={name || profile.name} size={100} />
            )}
            <View style={styles.camera}>
              <Camera size={18} color={colors.white} />
            </View>
          </Pressable>
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel="Upload New Photo"
            disabled={busy || uploadHeld}
            onPress={changePhoto}
            style={styles.photoAction}
          >
            <AppText color={colors.primary} style={styles.link}>
              Upload New Photo
            </AppText>
          </Pressable>
          {picking && <ActivityIndicator color={colors.primary} />}
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel="Remove Photo"
            disabled={busy || !uri}
            accessibilityState={{ disabled: busy || !uri }}
            onPress={() => {
              setPhoto(undefined);
              setRemovePhoto(!!profile.avatarUrl);
              setPhotoError('');
              setPermissionDenied(false);
            }}
            style={styles.photoAction}
          >
            <AppText color={colors.primary}>Remove Photo</AppText>
          </Pressable>
          <AppText variant="caption">
            JPEG, PNG or WebP, maximum 2 MB and 2048×2048 pixels.
          </AppText>
          {(photo || removePhoto) && (
            <>
              <AppText variant="caption" color={colors.primary}>
                {removePhoto
                  ? 'Photo removal pending Save Changes'
                  : 'Unsaved local photo preview'}
              </AppText>
              <Pressable
                cssInterop={false}
                accessibilityRole="button"
                accessibilityLabel="Restore original photo"
                disabled={busy}
                onPress={() => {
                  setPhoto(undefined);
                  setRemovePhoto(false);
                }}
                style={styles.photoAction}
              >
                <AppText color={colors.primary}>Restore original photo</AppText>
              </Pressable>
            </>
          )}
          {!!photoError && (
            <AppText
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              color={colors.danger}
              style={styles.center}
            >
              {photoError}
            </AppText>
          )}
          {permissionDenied && (
            <AppButton
              title="Open device Settings"
              onPress={() => {
                Linking.openSettings().catch(() =>
                  setPhotoError(
                    'Could not open Settings. Please enable photo access in device settings.',
                  ),
                );
              }}
            />
          )}
          <View style={styles.verification}>
            {profile.verified === true && (
              <Check size={16} color={colors.success} />
            )}
            <AppText
              color={
                profile.verified === true ? colors.success : colors.textMuted
              }
              variant="caption"
            >
              {profile.verified === true
                ? 'Verified Member'
                : profile.verified === false
                ? 'Unverified Member'
                : 'Verification not confirmed'}
            </AppText>
          </View>
        </View>
        {demo && (
          <AppText variant="caption" color={colors.primary}>
            UI demo - edits stay on this screen. Save and upload are not
            connected.
          </AppText>
        )}
        {refreshError && (
          <AppText accessibilityRole="alert" color={colors.danger}>
            Could not refresh your profile. Your unsaved edits have been kept.
          </AppText>
        )}
        <View style={styles.form}>
          {fields.map((field, index) => (
            <React.Fragment key={field.key}>
              {field.key === 'phone' && (
                <View style={styles.countryField}>
                  <AppText color={colors.navy} variant="bodySmall">
                    Country (calling code)
                  </AppText>
                  <View style={styles.countryRow}>
                    <CallingCodeSelector
                      value={callingCountry ?? undefined}
                      disabled={busy}
                      onChange={selected => {
                        form.setValue('callingCountry', selected, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        if (phone) form.trigger('phone').catch(() => {});
                      }}
                    />
                    <AppText color={colors.navy} style={styles.countryName}>
                      {phoneCountries.find(c => c.id === callingCountry)
                        ?.name ?? 'Select country'}
                    </AppText>
                  </View>
                  {form.formState.errors.callingCountry?.message && (
                    <AppText
                      accessibilityLiveRegion="polite"
                      color={colors.danger}
                      variant="caption"
                    >
                      {form.formState.errors.callingCountry.message}
                    </AppText>
                  )}
                </View>
              )}
              <View
                key={field.key}
                style={[
                  styles.inputFrame,
                  focusedField === field.key && styles.focused,
                ]}
              >
                <Controller
                  control={form.control}
                  name={field.key}
                  render={({
                    field: { value, onChange, onBlur, ref },
                    fieldState,
                  }) => (
                    <AppInput
                      label={field.label}
                      placeholder={
                        field.key === 'phone'
                          ? 'Enter phone number'
                          : field.label
                      }
                      ref={node => {
                        if (field.key !== 'name')
                          refs.current[field.key] = node;
                        ref(node);
                      }}
                      value={value}
                      onChangeText={text => {
                        onChange(text);
                        form.clearErrors('root');
                      }}
                      onFocus={() => setFocusedField(field.key)}
                      onBlur={() => {
                        setFocusedField('');
                        onBlur();
                      }}
                      error={fieldState.error?.message}
                      editable={!busy}
                      leftIcon={<field.icon size={21} color={colors.primary} />}
                      keyboardType={
                        field.key === 'email'
                          ? 'email-address'
                          : field.key === 'phone'
                          ? 'phone-pad'
                          : 'default'
                      }
                      autoCapitalize={field.key === 'name' ? 'words' : 'none'}
                      autoCorrect={false}
                      autoComplete={
                        field.key === 'name'
                          ? 'name'
                          : field.key === 'email'
                          ? 'email'
                          : 'tel'
                      }
                      returnKeyType={index === 2 ? 'done' : 'next'}
                      submitBehavior="submit"
                      onSubmitEditing={() => {
                        if (field.key === 'name') refs.current.email?.focus();
                        else if (field.key === 'email')
                          refs.current.phone?.focus();
                        else Keyboard.dismiss();
                      }}
                    />
                  )}
                />
              </View>
            </React.Fragment>
          ))}
        </View>
        {(email.trim().toLowerCase() !== profile.email.toLowerCase() ||
          phone !== (profile.phone ?? '')) && (
          <AppText variant="caption">
            Email and phone changes may require re-verification. Verification
            remains unchanged until the server confirms the update.
          </AppText>
        )}
        {form.formState.errors.root?.server?.message && (
          <AppText
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            color={colors.danger}
          >
            {form.formState.errors.root.server.message}
          </AppText>
        )}
        <View style={styles.save}>
          <GradientButton
            title="Save Changes"
            icon="none"
            disabled={!dirty || busy || saved || (!!photo && uploadHeld)}
            loading={form.formState.isSubmitting || mutation.isPending}
            onPress={() => {
              save().catch(() => {});
            }}
          />
        </View>
      </ScreenContainer>
    </KeyboardScreen>
  );
}
const styles = StyleSheet.create({
  countryField: { gap: 8 },
  countryRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countryName: { flex: 1, minWidth: 0 },
  content: {
    maxWidth: 480,
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 14,
  },
  header: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 44,
  },
  back: {
    position: 'absolute',
    left: -8,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  photoSection: { alignItems: 'center', paddingTop: 10, gap: 4 },
  avatarRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 5,
    borderColor: colors.softPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  camera: {
    position: 'absolute',
    right: -5,
    bottom: -2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  link: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  center: { textAlign: 'center' },
  verification: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  form: { gap: 12 },
  inputFrame: {
    borderWidth: 1,
    borderColor: colors.white,
    borderRadius: 16,
    padding: 2,
  },
  focused: { borderColor: colors.primary },
  save: { marginTop: 12 },
  loading: { paddingVertical: 32, gap: 16 },
});
