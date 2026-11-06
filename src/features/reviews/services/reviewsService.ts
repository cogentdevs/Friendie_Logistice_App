import { z } from 'zod';
import { ApiError } from '../../../types/api';
import { useAuthStore } from '../../../store/authStore';
import { isUiPreviewActive } from '../../../store/developmentStore';
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
  _signal?: AbortSignal,
): Promise<ReviewsPage> {
  assertReviewAccess(owner);
  z.number().int().positive().parse(page);
  if (owner === 'demo')
    return { items: [], nextPage: null, visibilityConfirmed: true };
  // GET /user/reviews returns a session-authenticated Blade view, not a Sanctum JSON API.
  // No mobile route, visibility policy or pagination contract is verified. Do not guess one.
  throw new ApiError(
    (tab === 'visitors' ? 'Received reviews' : 'Authored reviews') +
      ' are currently unavailable. Mobile review access is not connected yet.',
    'unknown',
  );
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
