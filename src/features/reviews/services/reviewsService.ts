import { z } from 'zod';
import { ApiError } from '../../../types/api';
import { useAuthStore } from '../../../store/authStore';
import { isUiPreviewActive } from '../../../store/developmentStore';
import {
  getReceivedVisitorReviews,
  getGivenReviews,
} from './visitorReviewsService';
import {
  ReviewOwner,
  ReviewsPage,
  ReviewsSummary,
  ReviewsTab,
  websiteReviewSchema,
  reviewSchema,
  reviewsPageSchema,
} from '../types/reviews.types';
export function currentReviewOwner(): ReviewOwner {
  const account = useAuthStore.getState();
  return account.status === 'authenticated' && account.user
    ? account.user.id
    : isUiPreviewActive()
    ? 'demo'
    : 'guest';
}
export function reviewScope(owner: ReviewOwner) {
  return typeof owner === 'number' ? 'user:' + owner : owner;
}
export function assertReviewAccess(owner: ReviewOwner) {
  if (owner === 'guest' || currentReviewOwner() !== owner)
    throw new ApiError('Sign in to view your reviews.', 'unauthorized', 401);
}
export function mapWebsiteReview(
  input: unknown,
  tab: ReviewsTab,
  owner: number,
  visibilityConfirmed = false,
) {
  if (!visibilityConfirmed)
    throw new ApiError('Review visibility is not confirmed.', 'forbidden', 403);
  const row = websiteReviewSchema.parse(input);
  if ((tab === 'visitors' ? row.to_user_id : row.from_user_id) !== owner)
    throw new ApiError(
      'This review does not belong to your account.',
      'forbidden',
      403,
    );
  const date = z.iso.date().safeParse(row.date_time);
  // Website authored query joins the author again; never label that name as the recipient.
  return reviewSchema.parse({
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    rating: row.rating,
    comment: row.review,
    date: date.success ? date.data : null,
    person: {
      id: tab === 'visitors' ? row.from_user_id : row.to_user_id,
      name: tab === 'visitors' ? row.from_user_name : null,
    },
    listing: { id: row.post_ads_id, title: row.ad_title, canOpen: false },
  });
}
export function validateReviewPage(
  input: unknown,
  tab: ReviewsTab,
  owner: ReviewOwner,
  page: number,
) {
  assertReviewAccess(owner);
  const result = reviewsPageSchema.parse(input);
  if (result.nextPage !== null && result.nextPage <= page)
    throw new ApiError('Invalid review pagination.', 'unknown');
  if (
    typeof owner === 'number' &&
    result.items.some(
      item => (tab === 'visitors' ? item.toUserId : item.fromUserId) !== owner,
    )
  )
    throw new ApiError('Unable to access these reviews.', 'forbidden', 403);
  return result;
}
async function feed(
  tab: ReviewsTab,
  owner: ReviewOwner,
  page: number,
  signal?: AbortSignal,
): Promise<ReviewsPage> {
  assertReviewAccess(owner);
  z.number().int().positive().parse(page);
  if (owner === 'demo')
    return { items: [], nextPage: null, visibilityConfirmed: true };
  const sessionUser = useAuthStore.getState().user;
  try {
    const result = await (tab === 'visitors'
      ? getReceivedVisitorReviews
      : getGivenReviews)(page, signal);
    if (signal?.aborted || useAuthStore.getState().user !== sessionUser)
      throw new ApiError('Review request cancelled.', 'cancelled');
    assertReviewAccess(owner);
    return reviewsPageSchema.parse({
      items: result.items.map(row => {
        const person =
          tab === 'visitors' ? row.reviewer : row.reviewed_customer;
        const date = z.iso.date().safeParse(row.date_time);
        return {
          id: row.id,
          fromUserId: row.reviewer.id,
          toUserId: row.reviewed_customer.id,
          rating: row.rating,
          comment: row.review,
          date: date.success ? date.data : null,
          person: { id: person.id, name: person.display_name },
          // Private historical reviews do not establish current public listing access.
          listing: {
            id: row.listing.id,
            title: row.listing.title ?? undefined,
            canOpen: false,
          },
        };
      }),
      nextPage: result.nextPage,
      total: result.pagination.total,
      visibilityConfirmed: true,
    });
  } catch (error) {
    if (error instanceof ApiError)
      throw new ApiError(reviewErrorMessage(error), error.kind, error.status);
    throw new ApiError('Unable to read reviews. Please try again.', 'unknown');
  }
}
export function reviewErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.kind === 'unauthorized') return 'Please sign in again.';
    if (error.kind === 'forbidden') return 'Unable to access these reviews.';
    if (error.kind === 'rate-limit')
      return 'Too many attempts. Please wait before trying again.';
    if (error.kind === 'network')
      return 'Unable to connect or request timed out. Please try again.';
    if (error.kind === 'cancelled') return 'Review request cancelled.';
  }
  return 'Reviews are temporarily unavailable. Please try again.';
}
export const reviewsService = {
  received: (owner: ReviewOwner, page: number, signal?: AbortSignal) =>
    feed('visitors', owner, page, signal),
  authored: (owner: ReviewOwner, page: number, signal?: AbortSignal) =>
    feed('your', owner, page, signal),
  async summary(
    owner: ReviewOwner,
    _signal?: AbortSignal,
  ): Promise<ReviewsSummary> {
    assertReviewAccess(owner);
    if (owner === 'demo') return { total: 0, averageRating: null };
    throw new ApiError(
      'Review totals and ratings are currently unavailable.',
      'unknown',
    );
  },
};
