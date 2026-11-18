export const homeListing = {
  id: 703,
  ad_type: 'Carring',
  title: 'Actual trip',
  short_description: 'Public text',
  image_url: 'https://media.example.test/ad.jpg',
  category: { id: 42, name: 'Documents' },
  origin: { country_id: 8, country: 'Origin', city_id: 9, city: 'Start' },
  destination: {
    country_id: 11,
    country: 'Destination',
    city_id: 12,
    city: 'End',
  },
  weight: 0,
  weight_price: 0,
  currency: 'USD',
  departure_on: '2026-12-21',
  reached_on: '2026-12-22',
  is_featured: false,
  created_at: '2026-11-18 01:02:03',
  owner: { id: 81, display_name: 'Public Name', image_url: null },
};

export const homeResponse = () => ({
  success: true,
  message: 'Home retrieved successfully.',
  data: {
    categories: [{ id: 42, name: 'Documents', image_url: null }],
    featured_listings: [],
    latest_listings: [{ ...homeListing }],
  },
});
