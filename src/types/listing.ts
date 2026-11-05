export interface Listing {
  id: number;
  type: 'send' | 'carry';
  title: string;
  origin: string;
  destination: string;
  departureDate: string;
  category: string;
  price: number;
  currency: string;
}
