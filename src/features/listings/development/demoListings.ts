import { getDemoMyListing } from './demoMyListings';
import type { Listing } from '../services/listingsService';
import type { ListingDetail } from '../services/listingDetailsService';
import type { SearchFilters } from '../../search/store/searchStore';
import type { LocationSelection } from '../../location/types/location';
import { isStaticMarketplaceEnabled } from './staticMarketplace';
export function isListingDemoMode() {
  return isStaticMarketplaceEnabled();
}
const names = [
  'Ali Raza',
  'Ahsan Khan',
  'Usman Saleem',
  'Bilal Ahmed',
  'Sara Khan',
  'Omar Ali',
  'Ayesha Noor',
  'Hamza Malik',
];
export const demoListings: ListingDetail[] = names.map((name, index) => {
  const date = new Date();
  date.setDate(date.getDate() + 7 + index);
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  return {
    id: 900001 + index,
    ownerId: 910001 + index,
    status: 'active',
    type: index < 6 ? 'carry' : 'send',
    title: index < 6 ? 'Traveller to Dubai' : 'Parcel to Dubai',
    origin: 'Karachi, Pakistan',
    destination: 'Dubai, UAE',
    departureDate: day,
    category: 'Personal Items',
    itemTypes: ['Documents', 'Gadgets', 'Personal Items'],
    contact: { conversationId: 'demo-listing-' + (900001 + index) },
    price: [120, 150, 100, 135, 110, 145, 80, 95][index],
    currency: 'USD',
    capacityKg: [15, 20, 10, 12, 18, 25, 5, 8][index],
    traveller: {
      id: 910001 + index,
      name,
      verified: index !== 5,
      rating: [4.9, 4.8, 5, 4.7, 4.9, 4.6, 4.8, 4.9][index],
      reviewCount: [128, 96, 214, 76, 54, 32, 87, 43][index],
    },
  };
});
function distance(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const a =
    Math.sin(radians(lat - centerLat) / 2) ** 2 +
    Math.cos(radians(lat)) *
      Math.cos(radians(centerLat)) *
      Math.sin(radians(lng - centerLng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}
export function getDemoListings(
  page: number,
  filters: SearchFilters,
  location: LocationSelection,
) {
  const matches = demoListings.filter(item => {
    if (filters.destinationCountry && filters.destinationCountry.code !== 'AE')
      return false;
    if (
      filters.weightKg !== undefined &&
      (item.capacityKg ?? 0) < filters.weightKg
    )
      return false;
    if (filters.from && filters.from.country.code !== 'PK') return false;
    if (filters.to && filters.to.country.code !== 'AE') return false;
    if (filters.type && item.type !== filters.type) return false;
    if (filters.verifiedOnly && !item.traveller?.verified) return false;
    if (
      filters.from &&
      !item.origin.toLowerCase().includes(filters.from.city.name.toLowerCase())
    )
      return false;
    if (
      filters.to &&
      !item.destination
        .toLowerCase()
        .includes(filters.to.city.name.toLowerCase())
    )
      return false;
    if (
      filters.origin &&
      !item.origin.toLowerCase().includes(filters.origin.toLowerCase())
    )
      return false;
    if (
      filters.destination &&
      !item.destination
        .toLowerCase()
        .includes(filters.destination.toLowerCase())
    )
      return false;
    if (
      filters.query &&
      !`${item.origin} ${item.destination} ${item.title}`
        .toLowerCase()
        .includes(filters.query.toLowerCase())
    )
      return false;
    if (filters.category && item.category !== filters.category) return false;
    if (
      filters.dates &&
      (item.departureDate < filters.dates.start ||
        item.departureDate > filters.dates.end)
    )
      return false;
    if (location.mode === 'radius') {
      const [lat, lng] =
        filters.radiusTarget === 'destination'
          ? [25.2048, 55.2708]
          : [24.8607, 67.0011];
      if (
        distance(
          lat,
          lng,
          location.filter.latitude,
          location.filter.longitude,
        ) > location.filter.radiusKm
      )
        return false;
    }
    return true;
  });
  const size = 4;
  return {
    data: matches.slice((page - 1) * size, page * size) as Listing[],
    meta: {
      current_page: page,
      last_page: Math.max(1, Math.ceil(matches.length / size)),
      total: matches.length,
    },
  };
}
export function getDemoListing(id: string) {
  return (
    demoListings.find(item => String(item.id) === id) ?? getDemoMyListing(id)
  );
}
