import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check, ChevronDown, Phone } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { colors } from '../../../theme';
import { PhoneCountry, phoneCountries } from '../schemas/registerSchema';
export function CallingCodeSelector({
  value,
  disabled,
  onChange,
}: {
  value: PhoneCountry;
  disabled: boolean;
  onChange: (value: PhoneCountry) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = phoneCountries.find(country => country.id === value)!;
  return (
    <>
      <Pressable
        cssInterop={false}
        accessibilityRole="button"
        accessibilityLabel={`Calling code: ${selected.name} +${selected.dial}`}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={styles.trigger}
      >
        <Phone size={20} color={colors.secondary} />
        <AppText color={colors.navy}>+{selected.dial}</AppText>
        <ChevronDown size={16} color={colors.secondary} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <View accessibilityViewIsModal style={styles.sheet}>
            <AppText variant="headingMD" accessibilityRole="header">
              Country calling code
            </AppText>
            <AppText variant="caption">Supported mobile number formats</AppText>
            <ScrollView>
              {phoneCountries.map(country => (
                <Pressable
                  cssInterop={false}
                  key={country.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: value === country.id }}
                  accessibilityLabel={`${country.name} +${country.dial}`}
                  onPress={() => {
                    onChange(country.id);
                    setOpen(false);
                  }}
                  style={styles.row}
                >
                  <AppText color={colors.navy} style={styles.name}>
                    {country.name} (+{country.dial})
                  </AppText>
                  {country.id === value && (
                    <Check size={20} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              cssInterop={false}
              accessibilityRole="button"
              accessibilityLabel="Close country selector"
              onPress={() => setOpen(false)}
              style={styles.row}
            >
              <AppText color={colors.primary}>Cancel</AppText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  trigger: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.softPink,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    alignSelf: 'center',
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.white,
    gap: 12,
  },
  row: {
    minHeight: 52,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { flex: 1 },
});
