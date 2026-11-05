import { RouteSearch } from '../../src/features/search/types/search';
export const routeFixture: RouteSearch = {
  type: 'send',
  from: {
    country: { id: 1, code: 'PK', name: 'Pakistan' },
    city: { id: 101, name: 'Karachi' },
    area: { id: 201, name: 'Clifton' },
    placeId: 'fixture:karachi:clifton',
    coordinates: { latitude: 24.82, longitude: 67.03 },
    source: 'manual',
  },
  to: {
    country: { id: 2, code: 'AE', name: 'United Arab Emirates' },
    city: { id: 102, name: 'Dubai' },
    area: { id: 202, name: 'Deira' },
    placeId: 'fixture:dubai:deira',
    coordinates: { latitude: 25.27, longitude: 55.3 },
    source: 'manual',
  },
};
