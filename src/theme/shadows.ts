import { ViewStyle } from 'react-native';
import { colors } from './colors';
export const shadows = {
  card: {
    shadowColor: colors.navy,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  } satisfies ViewStyle,
};
