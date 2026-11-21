import React from 'react';
import Renderer from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomDrawerContent } from '../src/navigation/components/CustomDrawerContent';
import { AppAvatar } from '../src/components/ui/AppAvatar';
import { useAuthStore } from '../src/store/authStore';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
jest.mock('@react-navigation/drawer', () => ({
  DrawerContentScrollView: ({ children }: React.PropsWithChildren) => children,
  DrawerItem: () => null,
}));
const user = {
  id: 8,
  name: 'Member',
  email: 'member@example.test',
  avatarUrl: 'https://example.test/old-login.jpg',
};
let tree: Renderer.ReactTestRenderer;
let client: QueryClient;
beforeEach(() => {
  useAuthStore.getState().setUser(user);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client.clear();
  });
  useAuthStore.getState().clear();
});
async function mount() {
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <CustomDrawerContent
          {...({
            state: { routes: [{ name: 'MainTabs' }], index: 0 },
            navigation: {},
          } as unknown as DrawerContentComponentProps)}
        />
      </QueryClientProvider>,
    );
  });
}
test('Drawer observes the same profile cache and never restores Login avatar after authoritative null', async () => {
  client.setQueryData(['profile', 8], {
    ...user,
    avatarUrl: 'https://example.test/uploaded.jpg',
  });
  await mount();
  expect(tree.root.findByType(AppAvatar).props.uri).toBe(
    'https://example.test/uploaded.jpg',
  );
  await Renderer.act(async () => {
    client.setQueryData(['profile', 8], { ...user, avatarUrl: null });
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });
  expect(tree.root.findByType(AppAvatar).props.uri).toBeUndefined();
});
test('another account cached profile cannot provide the Drawer avatar', async () => {
  client.setQueryData(['profile', 8], {
    ...user,
    id: 9,
    avatarUrl: 'https://example.test/other.jpg',
  });
  await mount();
  expect(tree.root.findByType(AppAvatar).props.uri).toBe(user.avatarUrl);
});
