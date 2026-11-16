import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import Toast, { BaseToast } from 'react-native-toast-message';
import { AppToast, showToast } from '../src/components/ui/AppToast';
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await Renderer.act(async () => tree.unmount());
  jest.restoreAllMocks();
});
test('compatibility delegate emits one library notification with an explicit type', () => {
  const show = jest.spyOn(Toast, 'show');
  showToast('Saved', 'Changes saved', 'success');
  expect(show).toHaveBeenCalledTimes(1);
  expect(show).toHaveBeenCalledWith({
    type: 'success',
    text1: 'Saved',
    text2: 'Changes saved',
  });
});
test.each([
  ['success', 'Success', '#4CAF50'],
  ['error', 'Error', '#E53935'],
  ['warning', 'Warning', '#F59E0B'],
  ['rejected', 'Rejected', '#6B7280'],
  ['info', 'Information', '#2196F3'],
])(
  '%s uses the shared white card and correct left bar',
  async (type, title, color) => {
    await Renderer.act(async () => {
      tree = Renderer.create(<AppToast />);
    });
    expect(tree.root.findAllByType(Toast)).toHaveLength(1);
    const host = tree.root.findByType(Toast);
    expect(host.props.position).toBe('top');
    expect(host.props.topOffset).toBeGreaterThanOrEqual(12);
    const message = 'A long message '.repeat(30);
    await Renderer.act(async () => {
      Toast.show({ type, text1: 'Operation result', text2: message });
    });
    const card = tree.root.findByType(BaseToast);
    expect(card.props.text1).toBe(title);
    expect(card.props.text2).toBe(`Operation result\n${message}`);
    expect(card.props.text1NumberOfLines).toBe(0);
    expect(card.props.text2NumberOfLines).toBe(0);
    expect(StyleSheet.flatten(card.props.style)).toMatchObject({
      backgroundColor: '#FFFFFF',
      borderLeftColor: color,
      borderLeftWidth: 6,
      borderRadius: 10,
      height: 'auto',
      minHeight: 68,
      elevation: 4,
    });
    expect(StyleSheet.flatten(card.props.text1Style)).toMatchObject({
      color: '#1B1B1B',
      fontWeight: '700',
    });
    expect(StyleSheet.flatten(card.props.text2Style).color).toBe('#858585');
    await Renderer.act(async () => {
      Toast.show({ type, text1: 'Operation result', text2: message });
    });
    expect(tree.root.findAllByType(BaseToast)).toHaveLength(1);
    await Renderer.act(async () => {
      Toast.show({ type: 'info', text1: 'Information', text2: 'Replacement' });
    });
    expect(tree.root.findAllByType(BaseToast)).toHaveLength(1);
    expect(tree.root.findByType(BaseToast).props.text2).toBe('Replacement');
  },
);
