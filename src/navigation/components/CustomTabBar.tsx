import {
  isUiPreviewActive,
  useDevelopmentStore,
} from '../../store/developmentStore';
import React from 'react';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { View, Pressable, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Home,
  Package,
  Plus,
  MessageCircle,
  UserRound,
} from 'lucide-react-native';
import { colors, spacing, radius } from '../../theme';
import { AppText } from '../../components/ui/AppText';
const icons = [Home, Package, Plus, MessageCircle, UserRound];
const labels = ['Home', 'Listings', 'Post', 'Messages', 'Profile'];
export function CustomTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  const previewActive = useDevelopmentStore(store => store.previewActive);
  const preview = previewActive && isUiPreviewActive();
  const active = state.routes[state.index];
  if (
    active.name === 'ProfileStack' &&
    getFocusedRouteNameFromRoute(active) === 'EditProfile'
  )
    return null;
  if (!preview && active.name === 'PostListingStack') return null;
  if (
    !preview &&
    active.name === 'MessagesStack' &&
    getFocusedRouteNameFromRoute(active) === 'Chat'
  )
    return null;
  if (
    !preview &&
    (active.name === 'HomeStack' || active.name === 'ListingsStack') &&
    ['Search', 'Filters', 'Results', 'ListingDetails', 'Listings'].includes(
      getFocusedRouteNameFromRoute(active) ?? '',
    )
  )
    return null;
  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, spacing.sm) },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index,
          Icon = icons[index],
          post = route.name === 'PostListingStack';
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={
              descriptors[route.key].options.tabBarAccessibilityLabel ??
              labels[index]
            }
            onLongPress={() =>
              navigation.emit({ type: 'tabLongPress', target: route.key })
            }
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (event.defaultPrevented) return;
              if (preview) {
                const entry: Record<string, string> = {
                  HomeStack: 'Home',
                  ListingsStack: 'Listings',
                  PostListingStack: 'PostListing',
                  MessagesStack: 'Conversations',
                  ProfileStack: 'Profile',
                };
                navigation.navigate(route.name, { screen: entry[route.name] });
              } else if (!focused)
                navigation.navigate(route.name, route.params);
            }}
            style={styles.item}
          >
            <View style={post ? styles.post : styles.icon}>
              <Icon
                size={post ? 26 : 22}
                color={
                  post
                    ? colors.white
                    : focused
                    ? colors.primary
                    : colors.textMuted
                }
              />
            </View>
            <AppText
              variant="caption"
              color={focused ? colors.primary : colors.secondary}
              style={styles.label}
            >
              {labels[index]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  item: { flex: 1, minHeight: 56, alignItems: 'center', gap: spacing.xs },
  icon: { height: 40, justifyContent: 'center' },
  post: {
    minWidth: 48,
    height: 40,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textAlign: 'center' },
});
