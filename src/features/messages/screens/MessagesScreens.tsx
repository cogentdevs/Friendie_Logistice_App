import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { ChevronRight, MessageCircle } from 'lucide-react-native';
import {
  MessagesStackParamList,
  MainTabParamList,
} from '../../../navigation/navigationTypes';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { ScreenContainer } from '../../../components/layout/ScreenContainer';
import { PlaceholderScreen } from '../../../components/common/PlaceholderScreen';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import {
  isUiPreviewActive,
  useDevelopmentStore,
} from '../../../store/developmentStore';
import { demoConversations } from '../development/demoChat';
import { colors } from '../../../theme';
export function ConversationsScreen({
  navigation,
}: NativeStackScreenProps<MessagesStackParamList, 'Conversations'>) {
  const active = useDevelopmentStore(state => state.previewActive);
  const tabs = () =>
    navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  if (!active || !isUiPreviewActive())
    return (
      <PlaceholderScreen title="Messages">
        <AppText>Choose a conversation when messaging is connected.</AppText>
      </PlaceholderScreen>
    );
  return (
    <SafeScreen backgroundColor={colors.white}>
      <ScreenContainer backgroundColor={colors.white}>
        <AppText color={colors.primary} style={styles.label}>
          UI preview - demo conversations
        </AppText>
        {demoConversations.map(item => (
          <Pressable
            key={item.id}
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel={'Open demo chat with ' + item.name}
            onPress={() =>
              navigation.navigate('Chat', { conversationId: item.id })
            }
            style={styles.card}
          >
            <View style={styles.avatar}>
              <MessageCircle size={24} color={colors.primary} />
            </View>
            <View style={styles.text}>
              <AppText color={colors.navy} style={styles.name}>
                {item.name}
              </AppText>
              <AppText variant="caption">{item.preview}</AppText>
            </View>
            <ChevronRight size={18} color={colors.secondary} />
          </Pressable>
        ))}
        <AppButton
          title="Preview My Listings"
          variant="secondary"
          onPress={() => tabs()?.getParent()?.navigate('MyListings')}
        />
        <AppText variant="headingMD" color={colors.navy}>
          UI screen shortcuts
        </AppText>
        <AppButton
          title="Preview Post a Listing"
          variant="secondary"
          onPress={() =>
            tabs()?.navigate('PostListingStack', { screen: 'PostListing' })
          }
        />
        <AppButton
          title="Preview Listing Details"
          variant="secondary"
          onPress={() =>
            tabs()?.navigate('ListingsStack', {
              screen: 'ListingDetails',
              params: { listingId: '900001' },
            })
          }
        />
        <AppButton
          title="Preview Search Listings"
          variant="secondary"
          onPress={() => tabs()?.navigate('HomeStack', { screen: 'Search' })}
        />
        <AppButton
          title="Preview Filters"
          variant="secondary"
          onPress={() => tabs()?.navigate('HomeStack', { screen: 'Filters' })}
        />
      </ScreenContainer>
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  label: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  card: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.softPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 4 },
  name: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
});
