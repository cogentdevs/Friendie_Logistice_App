export const inboxItemFixture = {
  id: 71,
  listing: { id: 501, title: 'Parcel capacity' },
  other_participant: { id: 9, display_name: 'Other customer' },
  created_at: '2026-11-16 09:00:00',
  last_message: 'Is capacity available?',
  last_message_at: '2026-11-17 10:00:00',
  unread_count: 2,
};
export const inboxPageFixture = (page = 1) => ({
  items: [inboxItemFixture],
  pagination: { current_page: page, per_page: 20, total: 1, last_page: 1 },
});
