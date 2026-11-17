import { ListingDraft } from '../../src/features/post-listing/types/listingDraft';
import { getListingReferences } from '../../src/features/post-listing/services/listingReferencesService';
export const createListingDraft: ListingDraft = {
  type: 'carry',
  title: 'Travel parcel space',
  category: { id: 7, name: 'Documents' },
  currency: 'PKR',
  from: {
    country: { id: 1, name: 'Pakistan' },
    city: { id: 101, name: 'Karachi', countryId: 1 },
    area: { name: 'Clifton' },
    source: 'api',
  },
  to: {
    country: { id: 2, name: 'United Arab Emirates' },
    city: { id: 102, name: 'Dubai', countryId: 2 },
    area: { name: 'Deira' },
    source: 'api',
  },
  date: '2099-01-01',
  reachedOn: '2099-01-02',
  weight: '0',
};
export const createdListingRecord = {
  id: 123,
  category_id: 7,
  from_country_id: 1,
  from_city_id: 101,
  to_country_id: 2,
  to_city_id: 102,
  ad_type: 'Carring',
  title: 'Travel parcel space',
  description: null,
  from_area: 'Clifton',
  to_area: 'Deira',
  weight: 0,
  weight_price: null,
  currency: 'PKR',
  departure_on: '2099-01-01',
  reached_on: '2099-01-02',
  created_at: '2026-11-17 10:00:00',
  updated_at: '2026-11-17 10:00:00',
  status: 0,
  is_featured: false,
  show_contact_info: 0,
  image_url: null,
};
export function referenceResponse(url: string, config?: { params?: unknown }) {
  const country = (config?.params as { country_id?: number } | undefined)
    ?.country_id;
  const items =
    url === '/categories'
      ? [{ id: 7, name: 'Documents', image_url: null }]
      : url === '/countries'
      ? [
          { id: 1, name: 'Pakistan', short_name: null, image_url: null },
          {
            id: 2,
            name: 'United Arab Emirates',
            short_name: 'UAE',
            image_url: null,
          },
        ]
      : url === '/currencies'
      ? [{ code: 'PKR' }]
      : url === '/cities'
      ? [
          {
            id: country === 1 ? 101 : 102,
            country_id: country,
            name: country === 1 ? 'Karachi' : 'Dubai',
            short_name: null,
          },
        ]
      : [];
  return {
    status: 200,
    data: { success: true, message: 'Reference data.', data: { items } },
  };
}
export async function loadListingReferences() {
  await Promise.all([
    getListingReferences('categories'),
    getListingReferences('countries'),
    getListingReferences('currencies'),
    getListingReferences('cities', 1),
    getListingReferences('cities', 2),
  ]);
}
