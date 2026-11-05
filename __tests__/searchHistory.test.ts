import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useRecentSearchStore,
  recentSearchLimit,
} from '../src/features/search/store/recentSearchStore';
import { routeFixture } from '../test/fixtures/search';
const key = 'friendie.recent-searches';
beforeEach(async () => {
  await AsyncStorage.removeItem(key);
  useRecentSearchStore.setState({ items: [], ready: false });
});
test('missing or corrupt history starts empty', async () => {
  for (const raw of [
    null,
    'broken',
    '{"version":2,"items":[]}',
    '{"version":1,"items":[{}]}',
  ]) {
    if (raw !== null) await AsyncStorage.setItem(key, raw);
    await useRecentSearchStore.getState().hydrate();
    expect(useRecentSearchStore.getState().items).toEqual([]);
  }
});
test('history is bounded, deduplicated and restored with complete location values', async () => {
  await useRecentSearchStore.getState().hydrate();
  for (let i = 0; i < 12; i++)
    await useRecentSearchStore
      .getState()
      .add({ ...routeFixture, query: 'route ' + i });
  await useRecentSearchStore
    .getState()
    .add({ ...routeFixture, query: 'route 11' });
  expect(useRecentSearchStore.getState().items).toHaveLength(recentSearchLimit);
  useRecentSearchStore.setState({ items: [], ready: false });
  await useRecentSearchStore.getState().hydrate();
  expect(useRecentSearchStore.getState().items[0]).toEqual({
    ...routeFixture,
    query: 'route 11',
  });
});
test('read failures remain retryable without overwriting stored history', async () => {
  await AsyncStorage.setItem(
    key,
    JSON.stringify({ version: 1, items: [routeFixture] }),
  );
  jest
    .mocked(AsyncStorage.getItem)
    .mockRejectedValueOnce(new Error('unavailable'));
  await expect(useRecentSearchStore.getState().hydrate()).rejects.toThrow(
    'unavailable',
  );
  expect(useRecentSearchStore.getState().ready).toBe(false);
  await useRecentSearchStore.getState().hydrate();
  expect(useRecentSearchStore.getState().items).toEqual([routeFixture]);
});
test('failed write does not claim a saved search and retries remain usable', async () => {
  await useRecentSearchStore.getState().hydrate();
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('full'));
  await expect(
    useRecentSearchStore.getState().add(routeFixture),
  ).rejects.toThrow('full');
  expect(useRecentSearchStore.getState().items).toHaveLength(0);
  await useRecentSearchStore.getState().add(routeFixture);
  await useRecentSearchStore.getState().clear();
  useRecentSearchStore.setState({ ready: false });
  await useRecentSearchStore.getState().hydrate();
  expect(useRecentSearchStore.getState().items).toEqual([]);
});
