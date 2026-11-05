import React, { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { Package } from 'lucide-react-native';
import { SafeScreen } from '../layout/SafeScreen';
import { ScreenContainer } from '../layout/ScreenContainer';
import { AppCard } from '../ui/AppCard';
import { AppBadge } from '../ui/AppBadge';
import { AppText } from '../ui/AppText';
import { colors, spacing } from '../../theme';
export function PlaceholderScreen({
  title,
  description,
  children,
  fullScreen = false,
}: PropsWithChildren<{
  title: string;
  description?: string;
  fullScreen?: boolean;
}>) {
  return (
    <SafeScreen
      edges={
        fullScreen
          ? ['top', 'bottom', 'left', 'right']
          : ['left', 'right', 'bottom']
      }
    >
      <ScreenContainer>
        <View
          className="bg-softPink rounded-2xl p-6"
          style={{ gap: spacing.md }}
        >
          <Package color={colors.primary} size={36} />
          <AppText variant="headingXL" color={colors.navy}>
            {title}
          </AppText>
          <AppText>
            {description ?? 'Your Friendie Logistics experience starts here.'}
          </AppText>
        </View>
        <AppCard>
          <AppBadge label="Foundation preview" />
          <AppText>This screen is ready for its detailed design.</AppText>
          {children}
        </AppCard>
      </ScreenContainer>
    </SafeScreen>
  );
}
