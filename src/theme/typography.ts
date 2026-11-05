import { Platform, TextStyle } from 'react-native';
const fontFamily = Platform.OS === 'ios' ? 'System' : 'sans-serif';
export const typography = {
  display: { fontFamily, fontSize: 36, lineHeight: 44, fontWeight: '700' },
  headingXL: { fontFamily, fontSize: 28, lineHeight: 36, fontWeight: '700' },
  headingLG: { fontFamily, fontSize: 24, lineHeight: 32, fontWeight: '700' },
  headingMD: { fontFamily, fontSize: 20, lineHeight: 28, fontWeight: '600' },
  body: { fontFamily, fontSize: 16, lineHeight: 24 },
  bodySmall: { fontFamily, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily, fontSize: 12, lineHeight: 18 },
  button: { fontFamily, fontSize: 16, lineHeight: 24, fontWeight: '600' },
} satisfies Record<string, TextStyle>;
