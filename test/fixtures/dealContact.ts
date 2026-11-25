import type { Deal } from '../../src/features/deals/dealsService';
export const chatDealFixture: Deal = {
  id: 9,
  sender_listing_id: 124,
  carrier_listing_id: 123,
  sender_user_id: 8,
  carrier_user_id: 9,
  initiated_by: 8,
  requested_kg: 5,
  agreed_kg: 5,
  status: 'confirmed',
  acceptance_expires_at: null,
  conversation_id: 42,
  allowed_actions: ['cancel'],
  capacity: { sender: null, carrier: null },
};
export function chatAuthorizationFixture(carrierListingId = 123) {
  return {
    contact: {
      deal_id: 9,
      counterpart: { id: 9, phone: null },
      listing: {
        id: carrierListingId,
        from_latitude: null,
        from_longitude: null,
        to_latitude: null,
        to_longitude: null,
      },
    },
    deal: { ...chatDealFixture, carrier_listing_id: carrierListingId },
    validUntil: Date.now() + 15000,
  };
}
