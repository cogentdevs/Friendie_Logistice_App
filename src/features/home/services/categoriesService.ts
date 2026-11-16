import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { ApiError } from '../../../types/api';
import { appConfig } from '../../../constants/appConfig';
import { isStaticMarketplaceEnabled } from '../../listings/development/staticMarketplace';
import { HomeCategory } from '../types/home.types';

// Only the explicitly labelled native testing build keeps fixture categories.
// Debug alone is not a reason to replace real public API data.
export function categoriesDataSource() {
  return appConfig.staticTestingBuild && isStaticMarketplaceEnabled()
    ? 'static-testing'
    : 'api';
}
const responseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    items: z.array(
      z.object({
        id: z.number().int().positive(),
        name: z.string(),
        image_url: z
          .url()
          .refine(url => /^https?:\/\//i.test(url))
          .nullable(),
      }),
    ),
  }),
});
export async function getCategories(
  signal?: AbortSignal,
  search?: string,
): Promise<HomeCategory[]> {
  const term = search?.trim();
  if (term && term.length > 100)
    throw new ApiError(
      'Category search must be 100 characters or fewer.',
      'validation',
    );
  const response = await apiClient.get<unknown>(endpoints.categories, {
    signal,
    headers: { Authorization: false },
    ...(term ? { params: { search: term } } : {}),
  });
  if (signal?.aborted) throw new ApiError('Request cancelled.', 'cancelled');
  const parsed = responseSchema.safeParse(response.data);
  if (response.status !== 200 || !parsed.success)
    throw new ApiError(
      'Unable to read categories. Please try again.',
      'unknown',
    );
  return parsed.data.data.items.map(item => ({
    id: String(item.id),
    name: item.name,
    ...(item.image_url ? { imageUrl: item.image_url } : {}),
  }));
}
export function categoriesErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.kind === 'network')
      return 'Unable to connect or request timed out. Please try again.';
    if (error.kind === 'rate-limit')
      return 'Too many attempts. Please wait before trying again.';
  }
  return 'Unable to load categories. Please try again later.';
}
