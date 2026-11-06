import { ApiError } from '../../../types/api';
import { contactSchema, ContactValues } from '../schemas/contactSchema';
// Populate only with approved business details and backend-provided category IDs.
// No contact information, category catalogue or support API contract is verified yet.
export const supportConfig: {
  email?: string;
  phone?: string;
  address?: string;
  hours?: string;
  categories: { id: string; name: string }[];
} = { categories: [] };
export const contactService = {
  async submit(
    values: ContactValues,
  ): Promise<{ accepted: true; reference?: string }> {
    contactSchema.parse(values);
    if (!supportConfig.categories.some(c => c.id === values.category))
      throw new ApiError(
        'Select an available support category.',
        'validation',
        422,
        { category: ['Select an available support category.'] },
      );
    // Do not serialize personal information to a guessed endpoint.
    throw new ApiError(
      'Contact support is not connected yet. Your message has not been sent.',
      'unknown',
    );
  },
};
export function contactError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.kind === 'network')
      return 'Could not connect. Your message has not been confirmed. Please try again.';
    if (error.kind === 'rate-limit')
      return 'Too many requests. Please try again later.';
    if (error.kind === 'unauthorized')
      return 'Your session has expired. Please sign in again.';
    if (error.kind === 'unknown') return error.message;
  }
  return 'Your message could not be confirmed. Please try again.';
}
