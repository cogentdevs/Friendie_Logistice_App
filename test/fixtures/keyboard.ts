// Native measurement fixture: scroll viewport is 100..450, input is below it
// at 600..648, and its content-space Y is 800. Expected target is 514 (16 gap).
export function keyboardMeasurements() {
  const input = {
    isFocused: jest.fn(() => true),
    focus: jest.fn(),
    measureLayout: jest.fn((_ancestor, success) => success(0, 800, 300, 48)),
    measureInWindow: jest.fn(success => success(0, 600, 300, 48)),
  };
  const viewport = {
    measureInWindow: jest.fn(success => success(0, 100, 320, 350)),
  };
  const content = {};
  const scrollTo = jest.fn();
  const scroll = {
    getNativeScrollRef: () => viewport,
    getInnerViewRef: () => content,
    scrollTo,
  };
  return { input, viewport, content, scrollTo, scroll };
}
