import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { AppState, Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DealContactPanel } from '../src/features/deals/DealContactPanel';
import * as contacts from '../src/features/deals/dealContactService';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { AppButton } from '../src/components/ui/AppButton';
import { ApiError } from '../src/types/api';
import type { Deal } from '../src/features/deals/dealsService';
import { useDealContact } from '../src/features/deals/useDealContact';
// Initialize RN's lazy native exports outside individual interaction test budgets.
for (const name of [
  'View',
  'Text',
  'Modal',
  'ScrollView',
  'TextInput',
  'Pressable',
  'KeyboardAvoidingView',
  'ActivityIndicator',
])
  Reflect.get(require('react-native'), name);
const deal: Deal = {
  id: 9,
  sender_listing_id: 11,
  carrier_listing_id: 12,
  sender_user_id: 1,
  carrier_user_id: 2,
  initiated_by: 1,
  requested_kg: 5,
  agreed_kg: 5,
  status: 'accepted',
  acceptance_expires_at: '2030-01-02 12:00:00',
  capacity: { sender: null, carrier: null },
  allowed_actions: ['cancel'],
};
const contact = {
  deal_id: 9,
  counterpart: { id: 2, phone: '+10000000002' },
  listing: {
    id: 12,
    from_latitude: 0,
    from_longitude: 0,
    to_latitude: null,
    to_longitude: null,
  },
};
let tree: ReactTestRenderer,
  client: QueryClient,
  stateChange: (state: string) => void;
const element = (focused = true) => (
  <QueryClientProvider client={client}>
    <DealContactPanel deal={deal} focused={focused} />
  </QueryClientProvider>
);
async function mount() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(element());
  });
}
async function reveal() {
  await Renderer.act(async () => {
    tree.root
      .findAllByType(AppButton)
      .find(node => node.props.title === 'View authorized contact')!
      .props.onPress();
    await Promise.resolve();
  });
}
beforeEach(() => {
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
  });
  useDevelopmentStore.getState().exitPreview();
  useAuthStore
    .getState()
    .setUser({ id: 1, name: 'Sender', email: 'test@example.test' });
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      stateChange = listener as any;
      return { remove: jest.fn() };
    });
  jest.spyOn(contacts, 'readDealContact').mockImplementation(async () => ({
    contact,
    deal,
    validUntil: Date.now() + 1000,
  }));
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client?.clear();
  });
  jest.restoreAllMocks();
  jest.useRealTimers();
  useAuthStore.getState().clear();
});
test('contact is disclosed only after API success; coordinates are selectable and never query-cached', async () => {
  await mount();
  expect(JSON.stringify(tree.toJSON())).not.toContain('+10000000002');
  await reveal();
  expect(JSON.stringify(tree.toJSON())).toContain('+10000000002');
  const pin = tree.root
    .findAllByType(Text)
    .find(
      node => node.props.accessibilityLabel === 'Counterpart From Location Pin',
    )!;
  expect(pin.props.selectable).toBe(true);
  expect(JSON.stringify(pin.props.children)).toContain('0, 0');
  expect(
    tree.root
      .findAllByType(Text)
      .some(
        node => node.props.accessibilityLabel === 'Counterpart To Location Pin',
      ),
  ).toBe(false);
  expect(JSON.stringify(client.getQueryCache().getAll())).not.toContain(
    '+10000000002',
  );
});
test.each(['cancel', 'logout', 'background', 'blur'])(
  '%s clears disclosed information',
  async scenario => {
    await mount();
    await reveal();
    await Renderer.act(async () => {
      if (scenario === 'cancel') contacts.revokeDealAccess(9);
      else if (scenario === 'logout') useAuthStore.getState().clear();
      else if (scenario === 'background') stateChange('background');
      else tree.update(element(false));
    });
    expect(JSON.stringify(tree.toJSON())).not.toContain('+10000000002');
  },
);
test('expiry removes disclosure before reauthorization and a denied API cannot restore it', async () => {
  jest.useFakeTimers();
  await mount();
  await reveal();
  jest
    .mocked(contacts.readDealContact)
    .mockRejectedValue(new ApiError('Expired', 'forbidden', 403));
  await Renderer.act(async () => {
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
  });
  expect(JSON.stringify(tree.toJSON())).not.toContain('+10000000002');
  expect(JSON.stringify(tree.toJSON())).toContain('unavailable or expired');
});
test('late private response after logout is ignored', async () => {
  let finish!: (value: any) => void;
  jest.mocked(contacts.readDealContact).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await mount();
  await reveal();
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
    finish({ contact, deal, validUntil: Date.now() + 1000 });
  });
  expect(JSON.stringify(tree.toJSON())).not.toContain('+10000000002');
});

test('account replacement never renders the previous account contact, including before effect cleanup', async () => {
  const frames: { owner?: number; phone?: string | null }[] = [];
  function Probe() {
    const owner = useAuthStore(state => state.user);
    const access = useDealContact(9, true);
    frames.push({ owner: owner?.id, phone: access.contact?.counterpart.phone });
    return (
      <AppButton
        title="View authorized contact"
        onPress={() => {
          access.load().catch(() => {});
        }}
      />
    );
  }
  client = new QueryClient();
  await Renderer.act(async () => {
    tree = Renderer.create(<Probe />);
  });
  await reveal();
  expect(frames.some(frame => frame.phone === contact.counterpart.phone)).toBe(
    true,
  );
  await Renderer.act(async () => {
    useAuthStore
      .getState()
      .setUser({ id: 3, name: 'Other', email: 'other@example.test' });
  });
  expect(
    frames
      .filter(frame => frame.owner === 3)
      .every(frame => frame.phone === undefined),
  ).toBe(true);
});

test('new terminal deal status hides disclosed contact and messaging without waiting for a timer', async () => {
  await mount();
  await reveal();
  await Renderer.act(async () => {
    tree.update(
      <QueryClientProvider client={client}>
        <DealContactPanel deal={{ ...deal, status: 'cancelled' }} focused />
      </QueryClientProvider>,
    );
  });
  expect(JSON.stringify(tree.toJSON())).not.toContain(
    contact.counterpart.phone,
  );
  expect(
    tree.root
      .findAllByType(AppButton)
      .some(node => node.props.title === 'Message deal participant'),
  ).toBe(false);
});
