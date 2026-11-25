import React from 'react';
import Renderer from 'react-test-renderer';
import { AppState, Linking } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import { LocationPinActions } from '../src/features/post-listing/components/LocationPinActions';
import { AppButton } from '../src/components/ui/AppButton';
let tree: Renderer.ReactTestRenderer;
beforeEach(() => {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  });
  jest.clearAllMocks();
});
afterEach(() => {
  Renderer.act(() => tree?.unmount());
  jest.restoreAllMocks();
});
function mount(text = '0, 0', isAuthorized = () => true) {
  Renderer.act(() => {
    tree = Renderer.create(
      <LocationPinActions
        text={text}
        label="From Location Pin"
        isAuthorized={isAuthorized}
      />,
    );
  });
}
function button(title: string) {
  return tree.root
    .findAllByType(AppButton)
    .find(node => node.props.title === title)!;
}
test('copy copies both coordinates including zero only on deliberate press', () => {
  mount();
  expect(Clipboard.setString).not.toHaveBeenCalled();
  Renderer.act(() => button('Copy Location').props.onPress());
  expect(Clipboard.setString).toHaveBeenCalledWith('0, 0');
});
test('opens external Google Maps with encoded coordinate pair', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  mount('-90, 180');
  await Renderer.act(async () => button('Open in Google Maps').props.onPress());
  expect(open).toHaveBeenCalledWith(
    'https://www.google.com/maps/search/?api=1&query=-90%2C%20180',
  );
});
test.each(['', '1', '91, 0', '0, 181', 'NaN, 2', 'null, 0'])(
  'invalid or absent pair %s hides actions',
  text => {
    mount(text);
    expect(tree.root.findAllByType(AppButton)).toHaveLength(0);
  },
);
test('unauthorized pair hides all actions', () => {
  mount('1, 2', () => false);
  expect(tree.root.findAllByType(AppButton)).toHaveLength(0);
});
test('revocation between render and press prevents copy and external disclosure', () => {
  let authorized = true;
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  mount('1, 2', () => authorized);
  authorized = false;
  Renderer.act(() => {
    button('Copy Location').props.onPress();
    button('Open in Google Maps').props.onPress();
  });
  expect(Clipboard.setString).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
});
test('background blocks disclosure', () => {
  mount();
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'background',
  });
  Renderer.act(() => button('Copy Location').props.onPress());
  expect(Clipboard.setString).not.toHaveBeenCalled();
});
test('maps error uses sanitized toast without coordinates', async () => {
  jest
    .spyOn(Linking, 'openURL')
    .mockRejectedValue(new Error('native raw 1, 2'));
  const show = jest.spyOn(Toast, 'show');
  mount('1, 2');
  await Renderer.act(async () => button('Open in Google Maps').props.onPress());
  expect(show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'error', text1: 'Maps unavailable' }),
  );
  expect(JSON.stringify(show.mock.calls)).not.toContain('1, 2');
});
