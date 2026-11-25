import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { ApiError } from '../src/types/api';
import * as deals from '../src/features/deals/dealsService';
import {
  readDealContact,
  subscribeDealRevocation,
} from '../src/features/deals/dealContactService';
import {
  getConversation,
  sendMessage,
} from '../src/features/messages/services/chatService';
import { createOrReuseConversation } from '../src/features/messages/services/createConversationService';
const owner = { id: 1, name: 'Sender', email: 'test@example.test' };
const deal: deals.Deal = {
  id: 9,
  sender_listing_id: 11,
  carrier_listing_id: 12,
  sender_user_id: 1,
  carrier_user_id: 2,
  initiated_by: 1,
  requested_kg: 5,
  agreed_kg: 5,
  status: 'confirmed',
  acceptance_expires_at: null,
  capacity: { sender: null, carrier: null },
  allowed_actions: ['cancel'],
  conversation_id: 42,
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
const metadata = {
  id: 42,
  deal_id: 9 as number | null,
  listing: { id: 12, title: 'Carrier' },
  other_participant: { id: 2, display_name: 'Carrier' },
  created_at: null,
};
const response = (data: unknown, status = 200) => ({
  status,
  data: { success: true, message: 'OK', data },
});
beforeEach(() => {
  useDevelopmentStore.getState().exitPreview();
  useAuthStore.getState().setUser({ ...owner });
  jest
    .spyOn(secureStorage, 'getToken')
    .mockResolvedValue('dummy-private-token');
  jest.spyOn(deals, 'getDeal').mockResolvedValue(deal);
  jest
    .spyOn(apiClient, 'get')
    .mockImplementation(async path =>
      response(String(path).includes('/contact') ? contact : metadata),
    );
});
afterEach(() => {
  jest.restoreAllMocks();
  useAuthStore.getState().clear();
});
test('exact contact GET uses Bearer, strips unknown private fields and retains zero pairs', async () => {
  jest
    .mocked(apiClient.get)
    .mockResolvedValue(
      response({ ...contact, email: 'not exposed', address: 'not exposed' }),
    );
  const result = await readDealContact(9);
  expect(apiClient.get).toHaveBeenCalledWith(
    '/customer/deals/9/contact',
    expect.objectContaining({
      headers: { Authorization: 'Bearer dummy-private-token' },
    }),
  );
  expect(result.contact).toEqual(contact);
  expect(result.validUntil).toBeGreaterThan(Date.now());
});
test.each([401, 403, 404, 503])(
  'HTTP %s never grants contact and revokes previous disclosure',
  async status => {
    const revoke = jest.fn(),
      unsubscribe = subscribeDealRevocation(revoke);
    jest
      .mocked(apiClient.get)
      .mockRejectedValue(new ApiError('Rejected', 'forbidden', status));
    await expect(readDealContact(9)).rejects.toThrow();
    expect(revoke).toHaveBeenCalledWith(9);
    unsubscribe();
  },
);
test('confirmed status alone does not authorize a contact response', async () => {
  jest
    .mocked(apiClient.get)
    .mockRejectedValue(new ApiError('No permission', 'forbidden', 403));
  await expect(readDealContact(9)).rejects.toMatchObject({ status: 403 });
});
test.each(['pending', 'completed', 'cancelled', 'expired'] as const)(
  '%s cannot retain a contact grant even with a stale 200',
  async status => {
    jest.mocked(deals.getDeal).mockResolvedValue({ ...deal, status });
    await expect(readDealContact(9)).rejects.toMatchObject({ status: 403 });
  },
);
test('wrong counterpart/listing or incomplete pins fail closed', async () => {
  jest
    .mocked(apiClient.get)
    .mockResolvedValueOnce(
      response({ ...contact, counterpart: { id: 3, phone: 'never show' } }),
    )
    .mockResolvedValueOnce(
      response({
        ...contact,
        listing: { ...contact.listing, from_longitude: null },
      }),
    );
  await expect(readDealContact(9)).rejects.toThrow();
  await expect(readDealContact(9)).rejects.toThrow();
});
test('guest cannot fetch private contact', async () => {
  useAuthStore.getState().clear();
  await expect(readDealContact(9)).rejects.toMatchObject({ status: 401 });
  expect(apiClient.get).not.toHaveBeenCalled();
});
test('account switch during private read discards the response', async () => {
  let finish!: (value: any) => void;
  jest.mocked(apiClient.get).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const pending = readDealContact(9);
  while (!finish) await Promise.resolve();
  useAuthStore
    .getState()
    .setUser({ id: 3, name: 'Other', email: 'other@example.test' });
  finish(response(contact));
  await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
});
test.each([200, 201])(
  'deal conversation HTTP %s uses deal_id and preserves created/reused distinction',
  async status => {
    const post = jest
      .spyOn(apiClient, 'post')
      .mockResolvedValue(response(metadata, status));
    const result = await createOrReuseConversation(
      { id: 12, dealId: 9 },
      'Actual initial text',
    );
    expect(result.created).toBe(status === 201);
    expect(post).toHaveBeenCalledWith(
      '/customer/conversations',
      { deal_id: 9, message: 'Actual initial text' },
      expect.objectContaining({
        headers: { Authorization: 'Bearer dummy-private-token' },
      }),
    );
    expect(post).toHaveBeenCalledTimes(1);
  },
);
test('listing-only chat creation is blocked without a POST', async () => {
  const post = jest.spyOn(apiClient, 'post');
  await expect(
    createOrReuseConversation({ id: 12 }, 'Text'),
  ).rejects.toMatchObject({ kind: 'validation' });
  expect(post).not.toHaveBeenCalled();
});
test('legacy history is read-only and never sends a message', async () => {
  jest
    .mocked(apiClient.get)
    .mockResolvedValue(response({ ...metadata, deal_id: null }));
  const post = jest.spyOn(apiClient, 'post');
  expect((await getConversation('42')).canSend).toBe(false);
  await expect(sendMessage('42', 'Text', '')).rejects.toMatchObject({
    status: 403,
  });
  expect(post).not.toHaveBeenCalled();
});
test('bound chat permission is granted only by contact API and never carries phone or pins', async () => {
  const room = await getConversation('42');
  expect(room.canSend).toBe(true);
  expect(room.dealId).toBe(9);
  expect(JSON.stringify(room)).not.toContain('+10000000002');
  expect(JSON.stringify(room)).not.toContain('latitude');
  jest.mocked(apiClient.get).mockImplementation(async path => {
    if (String(path).includes('/contact'))
      throw new ApiError('Expired', 'forbidden', 403);
    return response(metadata);
  });
  expect((await getConversation('42')).canSend).toBe(false);
});
test('fresh authorization failure before sending makes no message POST', async () => {
  jest.mocked(apiClient.get).mockImplementation(async path => {
    if (String(path).includes('/contact'))
      throw new ApiError('Cancelled', 'forbidden', 403);
    return response(metadata);
  });
  const post = jest.spyOn(apiClient, 'post');
  await expect(sendMessage('42', 'Text', '')).rejects.toMatchObject({
    status: 403,
  });
  expect(post).not.toHaveBeenCalled();
});

test('carrier receives sender contact and sender pins, while the room remains anchored to the carrier listing', async () => {
  useAuthStore
    .getState()
    .setUser({ id: 2, name: 'Carrier', email: 'carrier@example.test' });
  jest.mocked(apiClient.get).mockImplementation(async path =>
    response(
      String(path).includes('/contact')
        ? {
            ...contact,
            counterpart: { id: 1, phone: null },
            listing: { ...contact.listing, id: 11 },
          }
        : {
            ...metadata,
            other_participant: { id: 1, display_name: 'Sender' },
          },
    ),
  );
  expect((await readDealContact(9)).contact.listing.id).toBe(11);
  expect((await getConversation('42')).canSend).toBe(true);
});

test('same participants do not authorize a conversation bound to another listing or room', async () => {
  jest
    .mocked(apiClient.get)
    .mockImplementation(async path =>
      response(
        String(path).includes('/contact')
          ? contact
          : { ...metadata, listing: { id: 99, title: null } },
      ),
    );
  expect((await getConversation('42')).canSend).toBe(false);
});

test('an accepted deal at the exact deadline is denied even if an old response claims success', async () => {
  jest.useFakeTimers();
  try {
    jest.setSystemTime(new Date('2030-01-02T12:00:00.000Z'));
    jest.mocked(deals.getDeal).mockResolvedValue({
      ...deal,
      status: 'accepted',
      acceptance_expires_at: '2030-01-02 12:00:00',
    });
    await expect(readDealContact(9)).rejects.toMatchObject({ status: 403 });
  } finally {
    jest.useRealTimers();
  }
});

test('invalid/missing secure token revokes access before any contact HTTP request', async () => {
  jest.mocked(secureStorage.getToken).mockResolvedValue(null);
  const revoke = jest.fn(),
    unsubscribe = subscribeDealRevocation(revoke);
  await expect(readDealContact(9)).rejects.toMatchObject({ status: 401 });
  expect(apiClient.get).not.toHaveBeenCalled();
  expect(revoke).toHaveBeenCalled();
  unsubscribe();
});

test('server HTTP Date prevents a slow device clock from extending acceptance disclosure', async () => {
  jest.useFakeTimers();
  try {
    jest.setSystemTime(new Date('2029-01-01T00:00:00Z'));
    jest.mocked(deals.getDeal).mockResolvedValue({
      ...deal,
      status: 'accepted',
      acceptance_expires_at: '2030-01-02 12:00:00',
    });
    jest.mocked(apiClient.get).mockResolvedValue({
      ...response(contact),
      headers: { date: 'Wed, 02 Jan 2030 11:59:59 GMT' },
    });
    await expect(readDealContact(9)).rejects.toMatchObject({ status: 403 });
  } finally {
    jest.useRealTimers();
  }
});
