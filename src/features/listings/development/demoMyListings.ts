import type { ListingDetail } from '../services/listingDetailsService';
export const demoMyListingOwner = 920001;
function day(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
export const demoMyListings: ListingDetail[] = [
  { origin: 'Karachi', destination: 'Dubai', status: 'active', capacityKg: 15 },
  { origin: 'Lahore', destination: 'Riyadh', status: 'active', capacityKg: 20 },
  {
    origin: 'Islamabad',
    destination: 'London',
    status: 'active',
    capacityKg: 10,
  },
  {
    origin: 'Karachi',
    destination: 'Doha',
    status: 'completed',
    capacityKg: 5,
  },
  { origin: 'Lahore', destination: 'Dubai', status: 'expired', capacityKg: 8 },
].map((row, index) => ({
  id: 930001 + index,
  ownerId: demoMyListingOwner,
  type: index === 3 ? 'send' : 'carry',
  title: 'Demo own listing',
  origin: row.origin,
  destination: row.destination,
  departureDate: day(index < 3 ? 7 + index : index === 3 ? -7 : -14),
  category: 'Personal Items',
  price: [120, 150, 100, 80, 95][index],
  currency: 'USD',
  capacityKg: row.capacityKg,
  status: row.status as ListingDetail['status'],
  traveller: { id: demoMyListingOwner, name: 'Demo Traveller' },
  itemTypes: ['Documents', 'Personal Items'],
}));
export function getDemoMyListing(id: string) {
  return demoMyListings.find(item => String(item.id) === id);
}
