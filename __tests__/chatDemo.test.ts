import { appConfig } from '../src/constants/appConfig';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { useAuthStore } from '../src/store/authStore';
import { apiClient } from '../src/services/api/apiClient';
import {
  getConversation,
  getMessages,
  sendMessage,
} from '../src/features/messages/services/chatService';
let previous: boolean;
beforeEach(() => {
  previous = appConfig.uiPreviewEnabled;
  appConfig.uiPreviewEnabled = true;
  useAuthStore.getState().clear();
  useDevelopmentStore.setState({ previewActive: true });
});
afterEach(() => {
  useDevelopmentStore.setState({ previewActive: false });
  appConfig.uiPreviewEnabled = previous;
  jest.restoreAllMocks();
});
test('demo IDs load sample chat and duplicate local retry does not create another message', async () => {
  const get = jest.spyOn(apiClient, 'get'),
    post = jest.spyOn(apiClient, 'post');
  const conversation = await getConversation('demo-chat-ali');
  expect(conversation.participant.name).toBe('Ali Raza');
  const original = await getMessages(conversation.id, null);
  expect(original.data).toHaveLength(4);
  const first = await sendMessage(
    conversation.id,
    'Demo only',
    'demo-client-1',
  );
  const retry = await sendMessage(
    conversation.id,
    'Demo only',
    'demo-client-1',
  );
  expect(first.id).toBe(retry.id);
  const messages = await getMessages(conversation.id, null);
  expect(
    messages.data.filter(item => item.clientId === 'demo-client-1'),
  ).toHaveLength(1);
  expect(first.status).toBeUndefined();
  expect(get).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
});
test('turning off UI preview restores real authorization gates', async () => {
  useDevelopmentStore.setState({ previewActive: false });
  await expect(getConversation('demo-chat-ali')).rejects.toThrow('Sign in');
});
