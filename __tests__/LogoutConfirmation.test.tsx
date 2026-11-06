import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { Modal } from 'react-native';
import { LogoutConfirmationModal } from '../src/features/auth/components/LogoutConfirmationModal';
import { useAuthStore } from '../src/store/authStore';
let tree: ReactTestRenderer;
const cancel = jest.fn(),
  confirm = jest.fn();
async function mount(busy = false) {
  await Renderer.act(async () => {
    tree = Renderer.create(
      <LogoutConfirmationModal
        visible
        busy={busy}
        onCancel={cancel}
        onConfirm={confirm}
      />,
    );
  });
}
async function press(label: string) {
  await Renderer.act(async () => {
    tree.root
      .findAll(n => n.props.accessibilityLabel === label && n.props.onPress)[0]
      .props.onPress();
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
});
afterEach(async () => {
  await Renderer.act(async () => tree?.unmount());
});
test('confirmation copy, Cancel and Android Back preserve session', async () => {
  await mount();
  for (const text of [
    'Log Out?',
    'Are you sure you want to log out of your account?',
    'Cancel',
    'Log Out',
  ])
    expect(
      tree.root.findAll(n => n.props.children === text).length,
    ).toBeGreaterThan(0);
  await press('Cancel logout');
  await Renderer.act(async () => {
    tree.root.findByType(Modal).props.onRequestClose();
  });
  expect(cancel).toHaveBeenCalledTimes(2);
  expect(confirm).not.toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('authenticated');
});
test('confirmation delegates to existing handler; pending state blocks all actions and Android dismissal', async () => {
  await mount();
  await press('Confirm logout');
  expect(confirm).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => {
    tree.update(
      <LogoutConfirmationModal
        visible
        busy
        onCancel={cancel}
        onConfirm={confirm}
      />,
    );
  });
  const button = tree.root.findAll(
    n =>
      n.props.accessibilityLabel === 'Confirm logout' &&
      n.props.accessibilityRole === 'button' &&
      n.props.onPress,
  )[0];
  expect(button.props.disabled).toBe(true);
  expect(button.props.accessibilityState.busy).toBe(true);
  await press('Cancel logout');
  await press('Confirm logout');
  await Renderer.act(async () => {
    tree.root.findByType(Modal).props.onRequestClose();
  });
  expect(cancel).not.toHaveBeenCalled();
  expect(confirm).toHaveBeenCalledTimes(1);
});
