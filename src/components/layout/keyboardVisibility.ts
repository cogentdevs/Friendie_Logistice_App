import { Keyboard, ScrollView, TextInput } from 'react-native';
import { spacing } from '../../theme';

type Input = NonNullable<
  ReturnType<typeof TextInput.State.currentlyFocusedInput>
>;

// Native ScrollView's scroll-to-keyboard helper compares content coordinates
// with the screen's keyboard Y. Forms below a header/above a footer need the
// actual visible viewport instead. Never move an input which is already visible.
export function revealInputInViewport(
  scroll: React.ComponentRef<typeof ScrollView> | null,
  input: Input | null | undefined,
  isCurrent: () => boolean,
) {
  const viewport = scroll?.getNativeScrollRef();
  const content = scroll?.getInnerViewRef();
  if (!scroll || !input || !viewport || !content || !isCurrent()) return;
  input.measureLayout(
    content,
    (_left, contentY, _width, height) => {
      viewport.measureInWindow(
        (_viewportX, viewportY, _viewportWidth, viewportHeight) => {
          input.measureInWindow((_inputX, inputY) => {
            if (!isCurrent() || viewportHeight <= 0 || height <= 0) return;
            const bottom = Math.min(
              viewportY + viewportHeight,
              Keyboard.metrics()?.screenY ?? Infinity,
            );
            const visibleHeight = bottom - viewportY;
            if (visibleHeight <= 0) return;
            const gap = spacing.lg;
            let target: number | undefined;
            if (inputY + height + gap > bottom)
              target = contentY + height + gap - visibleHeight;
            else if (inputY < viewportY + gap) target = contentY - gap;
            if (target !== undefined)
              scroll.scrollTo({ y: Math.max(0, target), animated: true });
          });
        },
      );
    },
    () => {},
  );
}
