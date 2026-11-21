import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable as RNPressable, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, FadeInDown, FadeOut, LinearTransition, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

/** Motion tokens, same values as ScaleAgee (SR_APP/src/theme/motion.ts). */
export const duration = { instant: 100, fast: 150, base: 200, slow: 300 } as const;
export const easing = { standard: Easing.bezier(0.4, 0, 0.2, 1), enter: Easing.bezier(0, 0, 0.2, 1), exit: Easing.bezier(0.4, 0, 1, 1) } as const;
export const springs = {
  snappy: { damping: 20, stiffness: 300, mass: 0.6 },
  gentle: { damping: 18, stiffness: 180, mass: 0.8 },
} as const;
export const stagger = { step: 45, maxItems: 8 } as const;
export const PRESS_SCALE = 0.97;

/** Light haptic for primary actions (never throws, e.g. on devices without a haptic engine). */
export const tap = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };

type PProps = Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; children?: ReactNode; haptic?: boolean };

/** Drop-in Pressable: scales to 0.97 with a spring on press (off with Reduce Motion), optional light haptic. */
const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);
export function Pressable({ style, onPress, onPressIn, onPressOut, haptic, ...rest }: PProps) {
  const p = useSharedValue(0);
  const reduce = useReducedMotion();
  const a = useAnimatedStyle(() => ({ transform: [{ scale: 1 - (1 - PRESS_SCALE) * p.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPress={(e) => { if (haptic) tap(); onPress?.(e); }}
      onPressIn={(e) => { if (!reduce) p.value = withSpring(1, springs.snappy); onPressIn?.(e); }}
      onPressOut={(e) => { if (!reduce) p.value = withSpring(0, springs.snappy); onPressOut?.(e); }}
      style={[style, a]}
    />
  );
}

/** List item entrance: fade + rise 8px, staggered 45 ms per item (first 8 only). */
export const rise = (i = 0) => FadeInDown.duration(duration.base).delay(Math.min(i, stagger.maxItems) * stagger.step).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] });
export const fadeOut = FadeOut.duration(duration.fast);
export const reflow = LinearTransition.duration(duration.base);

/** Status / alert dot: colour changes animate; `pulse` rings it once when it appears or changes. */
export function AnimDot({ color, pulse }: { color: string; pulse?: boolean }) {
  const reduce = useReducedMotion();
  const c = useSharedValue(color);
  const ring = useSharedValue(0);
  const first = useRef(true);
  useEffect(() => {
    c.value = first.current || reduce ? color : withTiming(color, { duration: duration.base });
    if (pulse && !reduce) { ring.value = 0; ring.value = withTiming(1, { duration: 600, easing: easing.enter }); }
    first.current = false;
  }, [color, pulse]);
  const dot = useAnimatedStyle(() => ({ backgroundColor: c.value }));
  const halo = useAnimatedStyle(() => ({ backgroundColor: c.value, opacity: ring.value === 0 ? 0 : 0.5 * (1 - ring.value), transform: [{ scale: 1 + 1.6 * ring.value }] }));
  return (
    <View style={{ width: 8, height: 8 }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 8, height: 8, borderRadius: 4 }, halo]} />
      <Animated.View style={[{ width: 8, height: 8, borderRadius: 4 }, dot]} />
    </View>
  );
}

/** Outline that fades between colours (table tiles); `off` hides it. */
export function ColorRing({ color, off, radius = 14 }: { color: string; off?: boolean; radius?: number }) {
  const c = useSharedValue(color);
  const o = useSharedValue(off ? 0 : 1);
  useEffect(() => { c.value = withTiming(color, { duration: duration.base }); o.value = withTiming(off ? 0 : 1, { duration: duration.base }); }, [color, off]);
  const st = useAnimatedStyle(() => ({ borderColor: c.value, opacity: o.value }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius, borderWidth: 1 }, st]} />;
}

/** Number that counts up/down to its new value (about 250 ms). */
export function CountUp({ value, format = (n: number) => String(n), style }: { value: number; format?: (n: number) => string; style?: object }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce || from.current === value) { from.current = value; setShown(value); return; }
    const start = Date.now(); const a = from.current;
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / 250);
      const e = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(a + (value - a) * e));
      if (t < 1) raf = requestAnimationFrame(step); else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value]);
  return <Text style={style}>{format(shown)}</Text>;
}

/** Shimmering placeholder block. */
export function Skeleton({ w, h = 14, r = 7, style }: { w?: number | `${number}%`; h?: number; r?: number; style?: ViewStyle }) {
  const reduce = useReducedMotion();
  const x = useSharedValue(-1);
  useEffect(() => {
    if (reduce) return;
    x.value = -1; x.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(x);
  }, [reduce]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 160 }] }));
  return (
    <View style={[{ width: w ?? '100%', height: h, borderRadius: r, backgroundColor: '#17171a', overflow: 'hidden' }, style]}>
      <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: '35%', width: '30%', backgroundColor: 'rgba(255,255,255,0.05)' }, sweep]} />
    </View>
  );
}

/** Loading state: skeleton rows instead of a spinner. */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <View style={{ gap: 18, paddingVertical: 8 }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Skeleton w={40} h={40} r={20} />
          <View style={{ flex: 1, gap: 8 }}><Skeleton w="60%" h={13} /><Skeleton w="35%" h={11} /></View>
        </View>
      ))}
    </View>
  );
}

export { withDelay, withSequence };
