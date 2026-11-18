import { useAuthStore } from '../../../store/authStore';
import { ApiError } from '../../../types/api';
type Operation = {
  kind: 'upload' | 'delete';
  state: 'pending' | 'unknown' | 'deleted';
  imageUrl?: string | null;
};
let operations = new WeakMap<object, Map<number, Operation>>();
useAuthStore.subscribe((state, previous) => {
  if (state.user !== previous.user || state.status !== previous.status)
    operations = new WeakMap();
});
export function listingImageOperation(id: number) {
  const user = useAuthStore.getState().user;
  return user ? operations.get(user)?.get(id) : undefined;
}
export function acquireListingImage(
  id: number,
  kind: Operation['kind'],
  imageUrl?: string | null,
) {
  const user = useAuthStore.getState().user;
  if (!user || useAuthStore.getState().status !== 'authenticated')
    throw new ApiError('Please sign in again.', 'unauthorized', 401);
  let entries = operations.get(user);
  if (!entries) {
    entries = new Map();
    operations.set(user, entries);
  }
  const previous = entries.get(id);
  if (
    previous &&
    !(
      kind === 'delete' &&
      previous.kind === 'delete' &&
      previous.state === 'deleted' &&
      imageUrl &&
      imageUrl !== previous.imageUrl
    )
  )
    throw new ApiError(
      'This image operation is pending or awaiting confirmation. Check your listing before proceeding.',
      'validation',
    );
  const operation: Operation = { kind, state: 'pending', imageUrl };
  entries.set(id, operation);
  return (state: Operation['state'] | 'release') => {
    if (operations.get(user)?.get(id) !== operation) return;
    if (state === 'release') entries!.delete(id);
    else operation.state = state;
  };
}
