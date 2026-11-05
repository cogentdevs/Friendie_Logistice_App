import { create } from 'zustand';
import { RouteLocation, DateRange } from '../types/search';
export interface SearchFilters {
  query?: string;
  verifiedOnly?: boolean;
  availableNow?: boolean;
  radiusTarget?: 'origin' | 'destination';
  from?: RouteLocation;
  to?: RouteLocation;
  dates?: DateRange;
  type?: 'send' | 'carry';
  origin?: string;
  destination?: string;
  date?: string;
  category?: string;
}
export const useSearchStore = create<{
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  reset: () => void;
  resetRoute: () => void;
}>(set => ({
  filters: {},
  setFilters: filters =>
    set(state => ({ filters: { ...state.filters, ...filters } })),
  reset: () => set({ filters: {} }),
  resetRoute: () =>
    set(state => ({
      filters: {
        ...(state.filters.verifiedOnly !== undefined
          ? { verifiedOnly: state.filters.verifiedOnly }
          : {}),
        ...(state.filters.availableNow !== undefined
          ? { availableNow: state.filters.availableNow }
          : {}),
        ...(state.filters.radiusTarget
          ? { radiusTarget: state.filters.radiusTarget }
          : {}),
      },
    })),
}));
