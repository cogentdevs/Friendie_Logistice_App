import { AppText } from '../src/components/ui/AppText';
import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import {
  QueryClient,
  QueryClientProvider,
  notifyManager,
} from '@tanstack/react-query';
import {
  DealHistoryScreen,
  IncomingRequestsScreen,
  OutgoingRequestsScreen,
  DealDetailsScreen,
} from '../src/features/deals/DealScreens';
import { RequestConfirmationDialog } from '../src/features/listings/components/RequestConfirmationDialog';
import * as service from '../src/features/deals/dealsService';
import { useAuthStore } from '../src/store/authStore';
import { AppButton } from '../src/components/ui/AppButton';
import { ApiError } from '../src/types/api';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
// Load RN lazy native views before individual interaction budgets begin.
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
const readyTarget = {
  availability: {
    total_kg: 12,
    reserved_kg: 0,
    committed_kg: 0,
    remaining_kg: 12,
    available: true,
  },
  requestEligibility: { eligible: true, reason: 'eligible' },
};
const member = { id: 1, name: 'Member', email: 'member@example.test' };
const capacity = {
  total_kg: 12,
  committed_kg: 0,
  reserved_kg: 5,
  remaining_kg: 7,
  available: false,
};
const deal: service.Deal = {
  id: 9,
  sender_listing_id: 11,
  carrier_listing_id: 12,
  sender_user_id: 1,
  carrier_user_id: 2,
  initiated_by: 2,
  requested_kg: 5,
  agreed_kg: 5,
  status: 'accepted',
  acceptance_expires_at: '2030-01-02 12:00:00',
  capacity: {
    sender: { ...capacity, total_kg: 5, remaining_kg: 0 },
    carrier: capacity,
  },
  allowed_actions: ['cancel'],
};
let tree: ReactTestRenderer, client: QueryClient;
const navigation = { navigate: jest.fn() };
async function mount(element: React.ReactElement) {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>{element}</QueryClientProvider>,
    );
  });
  await Renderer.act(async () => {
    await Promise.resolve();
  });
}
const buttons = () => tree.root.findAllByType(AppButton);
async function press(title: string) {
  await Renderer.act(async () => {
    buttons()
      .find(node => node.props.title === title)!
      .props.onPress();
    await Promise.resolve();
  });
}
beforeEach(() => {
  notifyManager.setScheduler(callback => callback());
  useAuthStore.getState().setUser({ ...member });
  jest.spyOn(service, 'getDeals').mockResolvedValue({
    items: [deal, { ...deal, id: 10, initiated_by: 1 }],
    pagination: { current_page: 1, last_page: 1, per_page: 20, total: 2 },
  });
  jest.spyOn(service, 'getDeal').mockResolvedValue(deal);
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client?.clear();
  });
  jest.restoreAllMocks();
  notifyManager.setScheduler(callback => setTimeout(callback, 0));
  useAuthStore.getState().clear();
});
test('Incoming uses initiator identity, shows backend remaining KG/status and opens exact deal', async () => {
  await mount(
    <IncomingRequestsScreen
      navigation={navigation as any}
      route={{ name: 'IncomingRequests', key: 'in' }}
    />,
  );
  expect(buttons().some(node => node.props.title === 'View deal 9')).toBe(true);
  expect(buttons().some(node => node.props.title === 'View deal 10')).toBe(
    false,
  );
  expect(JSON.stringify(tree.toJSON())).toContain('Not Available');
  expect(JSON.stringify(tree.toJSON())).toContain('2030-01-02 12:00:00');
  await press('View deal 9');
  expect(navigation.navigate).toHaveBeenCalledWith('DealDetails', {
    dealId: 9,
  });
});
test('Outgoing shows initiated requests only', async () => {
  await mount(
    <OutgoingRequestsScreen
      navigation={navigation as any}
      route={{ name: 'OutgoingRequests', key: 'out' }}
    />,
  );
  expect(buttons().some(node => node.props.title === 'View deal 10')).toBe(
    true,
  );
  expect(buttons().some(node => node.props.title === 'View deal 9')).toBe(
    false,
  );
});

test('request pagination preserves pages and filters duplicate backend IDs', async () => {
  jest.mocked(service.getDeals).mockImplementation(async page => ({
    items: page === 1 ? [deal] : [deal, { ...deal, id: 15 }],
    pagination: {
      current_page: page ?? 1,
      last_page: 2,
      per_page: 20,
      total: 2,
    },
  }));
  await mount(
    <IncomingRequestsScreen
      navigation={navigation as any}
      route={{ name: 'IncomingRequests', key: 'in' }}
    />,
  );
  await press('Load more requests');
  expect(
    buttons().filter(node => node.props.title === 'View deal 9'),
  ).toHaveLength(1);
  expect(buttons().some(node => node.props.title === 'View deal 15')).toBe(
    true,
  );
  expect(
    buttons().some(node => node.props.title === 'Load more requests'),
  ).toBe(false);
});
test('Details renders only allowed actions and suppresses duplicate action taps', async () => {
  let finish!: (value: service.Deal) => void;
  const act = jest.spyOn(service, 'actOnDeal').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  jest.spyOn(service, 'refreshDealData').mockResolvedValue(undefined);
  await mount(
    <DealDetailsScreen
      navigation={navigation as any}
      route={{ key: 'deal', name: 'DealDetails', params: { dealId: 9 } }}
    />,
  );
  expect(buttons().some(node => node.props.title === 'Accept')).toBe(false);
  await press('Cancel');
  await press('Cancel');
  expect(act).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => {
    finish(deal);
  });
  expect(service.refreshDealData).toHaveBeenCalledTimes(1);
});
test('empty list, failed retry and guest isolation render safely', async () => {
  jest.mocked(service.getDeals).mockResolvedValue({
    items: [],
    pagination: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
  });
  await mount(
    <IncomingRequestsScreen
      navigation={navigation as any}
      route={{ name: 'IncomingRequests', key: 'in' }}
    />,
  );
  expect(JSON.stringify(tree.toJSON())).toContain('No ');
  jest
    .mocked(service.getDeals)
    .mockRejectedValue(new ApiError('Offline', 'network'));
  await press('Refresh requests');
  expect(JSON.stringify(tree.toJSON())).toContain(
    'Unable to load or update requests',
  );
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
  });
  expect(
    buttons().some(node => node.props.title?.startsWith('View deal')),
  ).toBe(false);
});
test('request dialog requires a verified selection and submits once; Cancel never calls create', async () => {
  const target = { id: 12, ...readyTarget },
    selected = { id: 11 },
    onCancel = jest.fn(),
    onCreated = jest.fn();
  jest.spyOn(service, 'requestCandidates').mockResolvedValue({
    ownerId: 1,
    items: [{ id: 11, title: 'My parcel', weight: 5 } as any],
    pagination: { current_page: 1, last_page: 1, total: 1, per_page: 20 },
  });
  jest.spyOn(service, 'verifyCandidate').mockResolvedValue(selected as any);
  const create = jest.spyOn(service, 'createDeal').mockResolvedValue(deal);
  jest.spyOn(service, 'refreshDealData').mockResolvedValue(undefined);
  await mount(
    <RequestConfirmationDialog
      visible
      target={target}
      onCancel={onCancel}
      onCreated={onCreated}
    />,
  );
  expect(
    buttons().find(node => node.props.title === 'Send Request')!.props.disabled,
  ).toBe(true);
  await press('Cancel request');
  expect(create).not.toHaveBeenCalled();
  expect(onCancel).toHaveBeenCalledTimes(1);
  await press('My parcel (5 KG)');
  await press('Send Request');
  expect(create).toHaveBeenCalledWith(
    target,
    selected,
    expect.any(AbortSignal),
  );
  expect(onCreated).toHaveBeenCalledWith(deal);
});
test('uncertain submission retains selection and disables unsafe repeat', async () => {
  jest.spyOn(service, 'requestCandidates').mockResolvedValue({
    ownerId: 1,
    items: [{ id: 11, title: 'My parcel', weight: 5 } as any],
    pagination: { current_page: 1, last_page: 1, total: 1, per_page: 20 },
  });
  jest.spyOn(service, 'verifyCandidate').mockResolvedValue({ id: 11 } as any);
  const create = jest
    .spyOn(service, 'createDeal')
    .mockRejectedValue(new service.UncertainDealError());
  await mount(
    <RequestConfirmationDialog
      visible
      target={{ id: 12, ...readyTarget }}
      onCancel={jest.fn()}
    />,
  );
  await press('My parcel (5 KG)');
  await press('Send Request');
  await press('Send Request');
  expect(create).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(tree.toJSON())).toContain('Submission uncertain');
});

test('logout during submission cannot navigate or update another account cache', async () => {
  jest.spyOn(service, 'requestCandidates').mockResolvedValue({
    ownerId: 1,
    items: [{ id: 11, title: 'My parcel', weight: 5 } as any],
    pagination: { current_page: 1, last_page: 1, total: 1, per_page: 20 },
  });
  jest.spyOn(service, 'verifyCandidate').mockResolvedValue({ id: 11 } as any);
  let finish!: (value: service.Deal) => void;
  jest.spyOn(service, 'createDeal').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const refresh = jest
      .spyOn(service, 'refreshDealData')
      .mockResolvedValue(undefined),
    onCreated = jest.fn();
  await mount(
    <RequestConfirmationDialog
      visible
      target={{ id: 12, ...readyTarget }}
      onCancel={jest.fn()}
      onCreated={onCreated}
    />,
  );
  await press('My parcel (5 KG)');
  await press('Send Request');
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
    finish(deal);
  });
  expect(onCreated).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
});

test('an open request dialog disables submission when refreshed target availability is lost', async () => {
  jest.spyOn(service, 'requestCandidates').mockResolvedValue({
    ownerId: 1,
    items: [{ id: 11, title: 'My parcel', weight: 5 } as any],
    pagination: { current_page: 1, last_page: 1, total: 1, per_page: 20 },
  });
  jest.spyOn(service, 'verifyCandidate').mockResolvedValue({ id: 11 } as any);
  const create = jest.spyOn(service, 'createDeal');
  await mount(
    <RequestConfirmationDialog
      visible
      target={{ id: 12, ...readyTarget }}
      onCancel={jest.fn()}
    />,
  );
  await press('My parcel (5 KG)');
  expect(
    buttons().find(n => n.props.title === 'Send Request')!.props.disabled,
  ).toBe(false);
  await Renderer.act(async () => {
    tree.update(
      <QueryClientProvider client={client}>
        <RequestConfirmationDialog
          visible
          target={{
            id: 12,
            ...readyTarget,
            availability: { ...readyTarget.availability, available: false },
          }}
          onCancel={jest.fn()}
        />
      </QueryClientProvider>,
    );
  });
  expect(
    buttons().find(n => n.props.title === 'Send Request')!.props.disabled,
  ).toBe(true);
  await press('Send Request');
  expect(create).not.toHaveBeenCalled();
});

test('history tabs request authoritative groups and preserve confirmed pending journeys', async () => {
  await mount(
    <DealHistoryScreen
      navigation={navigation as never}
      route={{ key: 'history', name: 'DealHistory' }}
    />,
  );
  expect(service.getDeals).toHaveBeenCalledWith(
    1,
    expect.anything(),
    'pending',
  );
  await press('Completed');
  expect(service.getDeals).toHaveBeenCalledWith(
    1,
    expect.anything(),
    'completed',
  );
  expect(buttons().some(button => button.props.title === 'View deal 9')).toBe(
    true,
  );
});
test('history guest never fetches private data', async () => {
  useAuthStore.getState().clear();
  await mount(
    <DealHistoryScreen
      navigation={navigation as never}
      route={{ key: 'history', name: 'DealHistory' }}
    />,
  );
  expect(service.getDeals).not.toHaveBeenCalled();
});
test('pickup and completion labels follow backend actions and no cancel after pickup', async () => {
  jest.mocked(service.getDeal).mockResolvedValue({
    ...deal,
    status: 'confirmed',
    picked_up_at: '2026-11-25T10:00:00Z',
    allowed_actions: ['complete'],
  });
  await mount(
    <DealDetailsScreen
      navigation={navigation as never}
      route={{ key: 'deal', name: 'DealDetails', params: { dealId: 9 } }}
    />,
  );
  expect(
    buttons().some(button => button.props.title === 'Complete Delivery'),
  ).toBe(true);
  expect(buttons().some(button => button.props.title === 'Cancel')).toBe(false);
});

const namedHistory = {
  sender: {
    user: { id: 1, display_name: 'Sender' },
    listing: {
      id: 11,
      title: 'Parcel',
      ad_type: 'Send' as const,
      weight_kg: 5,
      route: {
        from_country_id: 1,
        from_city_id: 2,
        to_country_id: 3,
        to_city_id: 4,
        from_country_name: 'Historical Country',
        from_city_name: 'Historical City',
        to_country_name: 'Destination Country',
        to_city_name: 'Destination City',
      },
    },
  },
  carrier: {
    user: { id: 2, display_name: null },
    listing: {
      id: 12,
      title: null,
      ad_type: null,
      weight_kg: null,
      route: {
        from_country_id: 1,
        from_city_id: 2,
        to_country_id: null,
        to_city_id: null,
        from_country_name: null,
        from_city_name: '',
        to_country_name: null,
        to_city_name: null,
      },
    },
  },
};
const displayedText = () =>
  tree.root
    .findAllByType(AppText)
    .map(node => [node.props.children].flat(Infinity).join(''))
    .join('\n');
test('both History tabs display backend route names and safe partial fallbacks', async () => {
  jest.mocked(service.getDeals).mockResolvedValue({
    items: [{ ...deal, history: namedHistory }],
    pagination: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
  });
  await mount(
    <DealHistoryScreen
      navigation={navigation as never}
      route={{ key: 'history', name: 'DealHistory' }}
    />,
  );
  expect(displayedText()).toContain(
    'From: Historical Country / Historical City',
  );
  expect(displayedText()).toContain(
    'To: Destination Country / Destination City',
  );
  expect(displayedText()).toContain('From: Country 1 / City 2');
  expect(displayedText()).toContain(
    'To: Country unavailable / City unavailable',
  );
  await press('Completed');
  expect(displayedText()).toContain(
    'From: Historical Country / Historical City',
  );
  expect(service.getDeals).toHaveBeenCalledWith(
    1,
    expect.anything(),
    'completed',
  );
});
test('Deal Details uses the same snapshot route names without reference requests', async () => {
  jest
    .mocked(service.getDeal)
    .mockResolvedValue({ ...deal, history: namedHistory });
  await mount(
    <DealDetailsScreen
      navigation={navigation as never}
      route={{ key: 'deal', name: 'DealDetails', params: { dealId: 9 } }}
    />,
  );
  expect(displayedText()).toContain(
    'From: Historical Country / Historical City',
  );
  expect(displayedText()).toContain(
    'To: Destination Country / Destination City',
  );
  expect(service.getDeals).not.toHaveBeenCalled();
});
