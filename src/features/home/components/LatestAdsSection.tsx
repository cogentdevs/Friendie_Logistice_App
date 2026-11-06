import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { colors } from '../../../theme';
import { useAuthStore } from '../../../store/authStore';
import { useDevelopmentStore } from '../../../store/developmentStore';
import { useListingBookmarks } from '../../listings/store/bookmarkStore';
import { ListingCard } from '../../listings/components/ListingCard';
import { CollectionQuery, HomeAd } from '../types/home.types';
import { CollectionFeedback, HomeSectionHeader } from './HomeSections';
export function LatestAdsSection({
  query,
  demo,
  onOpen,
  onViewAll,
}: {
  query: CollectionQuery<HomeAd>;
  demo: boolean;
  onOpen: (id: number) => void;
  onViewAll: () => void;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(220, Math.min(width - 56, 330));
  const owner = useAuthStore(s => s.user?.id),
    bookmarks = useListingBookmarks();
  const [saving, setSaving] = useState<number[]>([]),
    [error, setError] = useState('');
  const inFlight = useRef(new Set<number>());
  const load = bookmarks.load;
  useEffect(() => {
    load().catch(() => setError('Could not read your saved listings.'));
  }, [owner, load]);
  const save = async (id: number) => {
    if (useAuthStore.getState().status !== 'authenticated') {
      Alert.alert(
        'Sign in required',
        'Saving listings requires a signed-in account. No session is created by UI preview.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign In',
            onPress: () => useDevelopmentStore.getState().requestLogin(),
          },
        ],
      );
      return;
    }
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setSaving(ids => [...ids, id]);
    setError('');
    try {
      await useListingBookmarks.getState().toggle(id);
    } catch {
      setError('Could not save this listing on your device. Please try again.');
    } finally {
      inFlight.current.delete(id);
      setSaving(ids => ids.filter(i => i !== id));
    }
  };
  return (
    <View style={styles.section}>
      <HomeSectionHeader
        title="Latest Ads"
        subtitle="Check out the latest ads from our members."
        action="View all latest ads"
        onViewAll={onViewAll}
      />
      <CollectionFeedback query={query} label="Latest ads" />
      {error && (
        <AppText accessibilityRole="alert" color={colors.danger}>
          {error}
        </AppText>
      )}
      {!query.isError && (
        <FlatList
          horizontal
          data={(query.data ?? []).slice(0, 3)}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.carousel}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={{ width: cardWidth }}>
              <ListingCard
                key={item.id}
                item={item}
                showSummary
                coverSource={
                  demo
                    ? require('../../../assets/demo-destinations/uae.jpg')
                    : undefined
                }
                saved={
                  !!owner &&
                  bookmarks.owner === owner &&
                  bookmarks.ids.includes(item.id)
                }
                saving={saving.includes(item.id)}
                onOpen={onOpen}
                onSave={id => {
                  save(id).catch(() => {});
                }}
              />
            </View>
          )}
        />
      )}
      <AppText variant="caption">
        Saved listings are stored on this device.
      </AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: 12 },
  carousel: { gap: 12, paddingBottom: 5 },
});
