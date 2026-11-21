import { Keyboard } from 'react-native';
import { revealInputInViewport } from '../src/components/layout/keyboardVisibility';
import { keyboardMeasurements } from '../test/fixtures/keyboard';

beforeEach(() => jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined));
afterEach(() => jest.restoreAllMocks());

test('scrolls a hidden lower field using the resized viewport, not global keyboard Y', () => {
  const m = keyboardMeasurements();
  revealInputInViewport(m.scroll as never, m.input as never, () => true);
  expect(m.scrollTo).toHaveBeenCalledWith({ y: 514, animated: true });
});

test('does not jump when a lower field is already visible above the fixed form footer', () => {
  const m = keyboardMeasurements();
  m.input.measureInWindow.mockImplementation(done => done(0, 300, 300, 48));
  revealInputInViewport(m.scroll as never, m.input as never, () => true);
  expect(m.scrollTo).not.toHaveBeenCalled();
});

test('clips the visible viewport at the actual keyboard if it overlays the viewport', () => {
  const m = keyboardMeasurements();
  jest.mocked(Keyboard.metrics).mockReturnValue({ screenY: 400 } as never);
  revealInputInViewport(m.scroll as never, m.input as never, () => true);
  expect(m.scrollTo).toHaveBeenCalledWith({ y: 564, animated: true });
});

test('reveals a field above the viewport and never creates negative scrolling', () => {
  const m = keyboardMeasurements();
  m.input.measureInWindow.mockImplementation(done => done(0, 80, 300, 48));
  m.input.measureLayout.mockImplementation((_ancestor, done) =>
    done(0, 5, 300, 48),
  );
  revealInputInViewport(m.scroll as never, m.input as never, () => true);
  expect(m.scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
});

test('a stale native measurement cannot scroll a blurred or replaced screen', () => {
  const m = keyboardMeasurements();
  let active = true;
  let measured: (() => void) | undefined;
  m.input.measureLayout.mockImplementation((_ancestor, done) => {
    measured = () => done(0, 800, 300, 48);
  });
  revealInputInViewport(m.scroll as never, m.input as never, () => active);
  active = false;
  measured!();
  expect(m.scrollTo).not.toHaveBeenCalled();
});

test('missing/unmounted input or zero-height viewport never scrolls', () => {
  const m = keyboardMeasurements();
  revealInputInViewport(null, m.input as never, () => true);
  revealInputInViewport(m.scroll as never, undefined, () => true);
  m.viewport.measureInWindow.mockImplementation(done => done(0, 100, 320, 0));
  revealInputInViewport(m.scroll as never, m.input as never, () => true);
  expect(m.scrollTo).not.toHaveBeenCalled();
});
