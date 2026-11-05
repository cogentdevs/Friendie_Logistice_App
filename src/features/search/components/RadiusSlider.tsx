import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { colors } from '../../../theme';
export function RadiusSlider({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const view = useRef<React.ComponentRef<typeof View>>(null);
  const config = useRef({ value, onChange, disabled });
  config.current = { value, onChange, disabled };
  const drag = useRef({
    active: false,
    ready: false,
    origin: 0,
    width: 0,
    x: 0,
    version: 0,
  });
  const responder = useMemo(() => {
    const update = () => {
      const d = drag.current;
      if (d.active && d.ready && !config.current.disabled && d.width > 24) {
        const fraction = Math.max(
          0,
          Math.min(1, (d.x - d.origin - 12) / (d.width - 24)),
        );
        config.current.onChange(1 + Math.round(fraction * 199));
      }
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !config.current.disabled,
      onMoveShouldSetPanResponder: () => !config.current.disabled,
      onPanResponderGrant: (_event, gesture) => {
        const d = drag.current;
        d.active = true;
        d.ready = false;
        d.x = gesture.x0;
        const version = ++d.version;
        view.current?.measureInWindow((x, _y, w) => {
          if (d.active && d.version === version) {
            d.origin = x;
            d.width = w;
            d.ready = true;
            update();
          }
        });
      },
      onPanResponderMove: (_event, gesture) => {
        drag.current.x = gesture.moveX;
        update();
      },
      onPanResponderRelease: () => {
        drag.current.active = false;
      },
      onPanResponderTerminate: () => {
        drag.current.active = false;
      },
      onPanResponderTerminationRequest: () => true,
    });
  }, []);
  const fraction = (value - 1) / 199;
  return (
    <View
      ref={view}
      collapsable={false}
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Search radius"
      accessibilityState={{ disabled }}
      accessibilityValue={{
        min: 1,
        max: 200,
        now: value,
        text: value + ' kilometres',
      }}
      accessibilityActions={[
        { name: 'increment', label: 'Increase radius' },
        { name: 'decrement', label: 'Decrease radius' },
      ]}
      onAccessibilityAction={event => {
        if (disabled) return;
        if (event.nativeEvent.actionName === 'increment')
          onChange(Math.min(200, value + 1));
        if (event.nativeEvent.actionName === 'decrement')
          onChange(Math.max(1, value - 1));
      }}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      style={[styles.touch, disabled && styles.disabled]}
    >
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: (fraction * 100 + '%') as `${number}%` },
          ]}
        />
      </View>
      <View
        style={[styles.thumb, { left: Math.max(0, width - 24) * fraction }]}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  touch: { minHeight: 48, justifyContent: 'center', width: '100%' },
  track: {
    height: 6,
    marginHorizontal: 12,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: 6, backgroundColor: colors.primary },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    elevation: 2,
    shadowColor: colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  disabled: { opacity: 0.4 },
});
