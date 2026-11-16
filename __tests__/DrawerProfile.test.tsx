import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomDrawerContent } from '../src/navigation/components/CustomDrawerContent';
import { AppAvatar } from '../src/components/ui/AppAvatar';
import { AppBadge } from '../src/components/ui/AppBadge';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
jest.mock('@react-navigation/drawer', () => ({
  DrawerContentScrollView: ({ children }: { children: React.ReactNode }) =>
    children,
  DrawerItem: () => null,
}));
const member = { id: 8, name: 'Login Member', email: 'member@example.test' };
let client: QueryClient, tree: ReactTestRenderer;
const props = {
  state: { routes: [{ name: 'MainTabs' }], index: 0 },
  navigation: { navigate: jest.fn(), closeDrawer: jest.fn() },
} as unknown as React.ComponentProps<typeof CustomDrawerContent>;
async function update(action: () => void) {
  await Renderer.act(async () => {
    action();
    await new Promise<void>(resolve => setTimeout(resolve, 15));
  });
}
beforeEach(async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.getState().setUser(member);
  useDevelopmentStore.setState({ previewActive: false });
  await update(() => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <CustomDrawerContent {...props} />
      </QueryClientProvider>,
    );
  });
});
afterEach(async () => {
  await update(() => tree.unmount());
  client.clear();
  useAuthStore.getState().clear();
});
const avatar = () => tree.root.findByType(AppAvatar).props;
test('reactively uses normalized cache and preserves false verification', async () => {
  expect(avatar().name).toBe(member.name);
  await update(() => {
    client.setQueryData(['profile', 8], {
      ...member,
      name: 'Latest Member',
      avatarUrl: 'https://example.test/a.jpg',
      verified: true,
    });
  });
  expect(avatar().name).toBe('Latest Member');
  expect(avatar().uri).toBe('https://example.test/a.jpg');
  expect(tree.root.findByType(AppBadge).props.label).toBe('Verified');
  await update(() => {
    client.setQueryData(['profile', 8], { ...member, verified: false });
  });
  expect(tree.root.findByType(AppBadge).props.label).toBe(
    'Verification pending',
  );
  expect(client.isFetching()).toBe(0);
});
test('failed image falls back and a changed URL becomes visible', async () => {
  await update(() =>
    client.setQueryData(['profile', 8], {
      ...member,
      avatarUrl: 'https://example.test/a.jpg',
    }),
  );
  await update(() => avatar().onError());
  expect(avatar().uri).toBeUndefined();
  await update(() =>
    client.setQueryData(['profile', 8], {
      ...member,
      avatarUrl: 'https://example.test/b.jpg',
    }),
  );
  expect(avatar().uri).toBe('https://example.test/b.jpg');
});
test('logout, demo and account switch cannot show previous owner data', async () => {
  await update(() =>
    client.setQueryData(['profile', 8], { ...member, name: 'Private Name' }),
  );
  await update(() => useAuthStore.getState().clear());
  expect(avatar().name).toBe('Guest');
  await update(() =>
    client.setQueryData(['profile', 8], { ...member, name: 'Late Name' }),
  );
  expect(avatar().name).toBe('Guest');
  await update(() => useDevelopmentStore.setState({ previewActive: true }));
  expect(avatar().name).toBe('UI Preview');
  await update(() =>
    useAuthStore.getState().setUser({ ...member, id: 9, name: 'Other Member' }),
  );
  expect(avatar().name).toBe('Other Member');
  await update(() =>
    client.setQueryData(['profile', 9], { ...member, name: 'Wrong Owner' }),
  );
  expect(avatar().name).toBe('Other Member');
  expect(client.isFetching()).toBe(0);
});
