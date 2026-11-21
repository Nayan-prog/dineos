import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { auth, homeFor } from '../lib/api';
import { C } from '../lib/ui';

const WORD = 'DineOS'.split('');
const GO_AT = 1500; // ms until we move on to sign-in

/** One letter: fades in and springs up, staggered left to right. */
function Letter({ ch, i, still }: { ch: string; i: number; still: boolean }) {
  const o = useSharedValue(still ? 1 : 0);
  const y = useSharedValue(still ? 0 : 14);
  useEffect(() => {
    if (still) return;
    o.value = withDelay(180 + i * 55, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
    y.value = withDelay(180 + i * 55, withSpring(0, { damping: 14, stiffness: 160, mass: 0.8 }));
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  return <Animated.Text style={[{ color: '#f5f5f5', fontSize: 48, fontFamily: 'Comfortaa_700Bold' }, st]}>{ch}</Animated.Text>;
}

/** Landing: black screen, a soft glow breathes in, the wordmark types in letter by letter, a blue line draws under it, then everything lifts and fades into sign-in. */
export default function Landing() {
  const still = useReducedMotion();
  const scale = useSharedValue(still ? 1 : 0.94);
  const lift = useSharedValue(0);
  const out = useSharedValue(1);
  const glow = useSharedValue(0);
  const line = useSharedValue(0);
  useEffect(() => {
    if (!still) {
      scale.value = withSpring(1, { damping: 16, stiffness: 120, mass: 0.9 });
      glow.value = withSequence(withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }), withTiming(0.55, { duration: 600 }));
      line.value = withDelay(650, withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }));
      lift.value = withDelay(GO_AT - 420, withTiming(-36, { duration: 420, easing: Easing.in(Easing.cubic) }));
      out.value = withDelay(GO_AT - 340, withTiming(0, { duration: 340, easing: Easing.in(Easing.cubic) }));
    } else { glow.value = 0.5; line.value = 1; }
    const t = setTimeout(() => { const s = auth.get(); router.replace(s ? homeFor(s.staff.role) : '/welcome'); }, still ? 600 : GO_AT);
    return () => clearTimeout(t);
  }, []);
  const wrap = useAnimatedStyle(() => ({ opacity: out.value, transform: [{ translateY: lift.value }, { scale: scale.value }] }));
  const halo = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.6 + 0.4 * glow.value }] }));
  const bar = useAnimatedStyle(() => ({ width: 44 * line.value, opacity: line.value }));
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
      <StatusBar style="light" />
      <Animated.View style={[{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(59,130,246,0.10)' }, halo]} />
      <Animated.View style={[{ alignItems: 'center' }, wrap]}>
        <View style={{ flexDirection: 'row' }}>{WORD.map((ch, i) => <Letter key={i} ch={ch} i={i} still={still} />)}</View>
        <Animated.View style={[{ height: 2, borderRadius: 1, backgroundColor: C.blue2, marginTop: 14 }, bar]} />
      </Animated.View>
    </View>
  );
}
