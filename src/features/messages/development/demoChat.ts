import type { ChatMessage, Conversation } from '../services/chatService';
import { getDemoListing } from '../../listings/development/demoListings';
import {
  isUiPreviewActive,
  useDevelopmentStore,
} from '../../../store/developmentStore';
import { useAuthStore } from '../../../store/authStore';
export const demoChatOwner = 999999999;
export const demoConversations = [
  {
    id: 'demo-chat-ali',
    name: 'Ali Raza',
    preview: 'Sure! I can carry your parcel.',
  },
  {
    id: 'demo-chat-ahsan',
    name: 'Ahsan Khan',
    preview: 'What is the weight and item type?',
  },
  {
    id: 'demo-chat-sara',
    name: 'Sara Khan',
    preview: 'Let me know your travel dates.',
  },
];
const threads = new Map<string, ChatMessage[]>();
export function chatOwnerId() {
  return isUiPreviewActive()
    ? demoChatOwner
    : useAuthStore.getState().status === 'authenticated'
    ? useAuthStore.getState().user?.id
    : undefined;
}
export function demoConversation(id: string): Conversation {
  const listing = id.startsWith('demo-listing-')
    ? getDemoListing(id.slice('demo-listing-'.length))
    : undefined;
  const name =
    listing?.traveller?.name ??
    demoConversations.find(item => item.id === id)?.name ??
    'Ali Raza';
  return {
    id,
    canSend: true,
    participant: { id: listing?.ownerId ?? 910001, name, deleted: false },
  };
}
export function demoMessages(id: string) {
  if (!threads.has(id)) {
    const start = Date.now() - 12 * 60000;
    const texts = [
      "Hi! I'm interested in your listing for Karachi to Dubai.",
      'Hello! Yes, I can carry your item. What is the weight and type?',
      'It is around 8 kg, a personal item. Can you confirm the charges?',
      'Sure! Please share the item details so we can discuss the fee.',
    ];
    threads.set(
      id,
      texts.map((body, index) => ({
        id: 'demo-' + id + '-' + index,
        conversationId: id,
        senderId:
          index % 2 === 0 ? demoConversation(id).participant.id : demoChatOwner,
        body,
        createdAt: new Date(start + index * 2 * 60000).toISOString(),
      })),
    );
  }
  return { data: [...threads.get(id)!].reverse(), nextCursor: null };
}
export async function demoSend(id: string, body: string, clientId: string) {
  demoMessages(id);
  const previous = threads
    .get(id)!
    .find(message => message.clientId === clientId);
  if (previous) return previous;
  await new Promise<void>(resolve => setTimeout(() => resolve(), 200));
  const existing = threads
    .get(id)
    ?.find(message => message.clientId === clientId);
  if (existing) return existing;
  const message: ChatMessage = {
    id: 'demo-local-' + clientId,
    conversationId: id,
    senderId: demoChatOwner,
    body,
    clientId,
    createdAt: new Date().toISOString(),
  };
  if (isUiPreviewActive()) threads.get(id)?.push(message);
  return message;
}
useDevelopmentStore.subscribe((state, previous) => {
  if (previous.previewActive && !state.previewActive) threads.clear();
});
