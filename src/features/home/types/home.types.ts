import type { ImageSourcePropType } from 'react-native';
import type { Listing } from '../../listings/services/listingsService';
export type HomeCategory = { id: string; name: string; imageUrl?: string };
export type DestinationCountry = {
  id: string | number;
  code: string;
  name: string;
};
export type HomeDestinationItem = {
  country: DestinationCountry;
  photo?: ImageSourcePropType;
  imageUrl?: string;
};
export type HomeAd = Listing & { coverImageUrl?: string | null };
export type CollectionQuery<T> = {
  data?: T[];
  isPending: boolean;
  isError: boolean;
  error?: unknown;
  refetch: () => Promise<unknown>;
};
