import { Children, type ReactNode } from 'react';
import { Dimensions, Modal, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle, type ViewStyle } from 'react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname, useGlobalSearchParams } from 'expo-router';
import { auth, api, useLive } from './api';
import { ICON, Icon } from './icons';
import { useNotifications } from './notify';
import { AnimDot, duration, easing, fadeOut, Pressable, reflow, rise, SkeletonRows, springs } from './motion';

export const C = {
  bg: '#0b0b0c', card: '#111113', chip: '#17171a', chip2: '#232327', line: '#1c1c20', border: '#2c2c31',
  text: '#f2f2f3', muted: '#a1a1a8', dim: '#8b8b93', blue: '#7db0f9', blue2: '#3b82f6', green: '#5eb88a', amber: '#f5b454', taupe: '#c9b29b', red: '#e0705c',
};
export const STATUS: Record<string, string> = { waiting: C.muted, cooking: C.amber, ready: C.green, served: C.blue, cancelled: C.red };

export const FONT = { brand: 'Comfortaa_700Bold', '400': 'Inter_400Regular', '500': 'Inter_500Medium', '600': 'Inter_600SemiBold', '700': 'Inter_700Bold' } as const;

/** Text: Inter by weight; `brand` uses Comfortaa 700 (wordmark and section titles). */
export function T({ children, style, size = 14, w, color = C.text, numberOfLines, brand }: { children: ReactNode; style?: TextStyle; size?: number; w?: '400' | '500' | '600' | '700'; color?: string; numberOfLines?: number; brand?: boolean }) {
  return <Text numberOfLines={numberOfLines} style={[{ color, fontSize: size, fontFamily: brand ? FONT.brand : FONT[w ?? '400'] }, style]}>{children}</Text>;
}

export function Btn({ label, onPress, kind = 'primary', small, disabled, style, haptic }: { label: string; onPress: () => void; kind?: 'primary' | 'light' | 'ghost' | 'danger'; small?: boolean; disabled?: boolean; style?: ViewStyle; haptic?: boolean }) {
  const bg = kind === 'primary' ? C.blue2 : kind === 'light' ? C.text : 'transparent';
  const fg = kind === 'light' ? C.bg : kind === 'danger' ? C.red : '#fff';
  return (
    <Pressable onPress={onPress} disabled={disabled} haptic={haptic ?? (kind === 'primary' || kind === 'light')} accessibilityRole="button" style={[{ height: small ? 36 : 48, paddingHorizontal: small ? 14 : 20, borderRadius: 24, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1, borderWidth: kind === 'ghost' || kind === 'danger' ? 1 : 0, borderColor: C.border }, style]}>
      <T w="600" color={fg} size={small ? 13.5 : 15}>{label}</T>
    </Pressable>
  );
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={C.dim} {...props} style={[s.input, props.style]} />;
}

export function Sec({ title, n, children }: { title: string; n?: number | string; children: ReactNode }) {
  return <View style={{ gap: 2 }}><View style={{ flexDirection: 'row', marginBottom: 4 }}><T brand color={C.muted} size={15} style={{ flex: 1 }}>{title}</T>{n !== undefined && <T w="600" color={C.muted}>{n}</T>}</View>{children}</View>;
}

/** List row: fades + rises in (staggered by `i`), collapses out, and reflows when neighbours change. */
export function Row({ children, style, i = 0 }: { children: ReactNode; style?: ViewStyle; i?: number }) {
  const { opacity, ...rest } = StyleSheet.flatten(style) ?? {};
  return (
    <Animated.View entering={rise(i)} exiting={fadeOut} layout={reflow} style={s.rowOuter}>
      <View style={[s.rowInner, rest, opacity !== undefined ? { opacity } : null]}>{children}</View>
    </Animated.View>
  );
}
export const Dot = ({ color, pulse }: { color: string; pulse?: boolean }) => <AnimDot color={color} pulse={pulse} />;
export const Loading = () => <View style={{ padding: 16 }}><SkeletonRows /></View>;
export const Empty = ({ text }: { text: string }) => <View style={s.empty}><T color={C.dim}>{text}</T></View>;

export function Pills<V extends string | number>({ items, value, onChange }: { items: [V, string][]; value: V; onChange: (v: V) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {items.map(([v, l]) => { const on = v === value; return <Pressable key={String(v)} onPress={() => onChange(v)} style={[s.pill, on && { backgroundColor: C.text, borderColor: C.text }]}><T color={on ? C.bg : C.muted} w={on ? '600' : '500'}>{l}</T></Pressable>; })}
    </ScrollView>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Pressable style={s.step} onPress={() => onChange(Math.max(min, value - 1))} accessibilityLabel="Less"><T size={18}>−</T></Pressable>
      <T w="700" style={{ minWidth: 32, textAlign: 'center' }}>{value}</T>
      <Pressable style={s.step} onPress={() => onChange(Math.min(max, value + 1))} accessibilityLabel="More"><T size={18}>+</T></Pressable>
    </View>
  );
}

/** Bottom sheet: backdrop fades, sheet springs up from the bottom (instant with Reduce Motion). */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const p = useSharedValue(0);
  useEffect(() => {
    if (visible) { setMounted(true); p.value = reduce ? 1 : withSpring(1, { ...springs.gentle, overshootClamping: true }); return; }
    p.value = reduce ? 0 : withTiming(0, { duration: duration.base, easing: easing.exit });
    const t = setTimeout(() => setMounted(false), reduce ? 0 : duration.base);
    return () => clearTimeout(t);
  }, [visible]);
  const H = Dimensions.get('window').height;
  const back = useAnimatedStyle(() => ({ opacity: p.value }));
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - p.value) * H }] }));
  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,.6)' }, back]}><Pressable style={{ flex: 1 }} onPress={onClose} /></Animated.View>
        <Animated.View style={[s.sheet, sheet]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><T w="700" size={19} style={{ flex: 1 }}>{title}</T><Pressable onPress={onClose} hitSlop={12}><T color={C.muted} size={20}>✕</T></Pressable></View>
          <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>{children}</ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

type Tab = [label: string, href: string];
const TABS: Record<string, Tab[]> = {
  waiter: [['Home', '/waiter'], ['Take order', '/waiter/take-order']],
  chef: [['Queue', '/chef']],
};

/** Screen frame: header with name + live dot, scrollable body, bottom bar for the role. */
export function Screen({ title, sub, right, children, role, scroll = true, footer }: { title: string; sub?: string; right?: ReactNode; children: ReactNode; role: 'waiter' | 'chef'; scroll?: boolean; footer?: ReactNode }) {
  const online = useLive();
  const path = usePathname();
  const me = auth.get()?.staff;
  const logout = async () => { await api('/auth/logout', { body: {} }).catch(() => {}); await auth.clear(); router.replace('/welcome'); };
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 64, gap: 12 }}>
        <View style={s.avatar}><T w="700">{me?.name[0] ?? '?'}</T></View>
        <View style={{ flex: 1 }}><T w="700" size={16}>{title}</T>{sub ? <T size={12.5} color={C.muted} numberOfLines={1}>{sub}</T> : null}</View>
        {right}
        <Dot color={online ? C.green : C.amber} />
        <Pressable onPress={logout} hitSlop={8}><T color={C.red} w="600" size={13}>Log out</T></Pressable>
      </View>
      <Body style={{ flex: 1 }} contentContainerStyle={scroll ? { padding: 16, gap: 22, paddingBottom: 32 } : undefined}>{children}</Body>
      {footer}
      {TABS[role].length > 1 && (
        <View style={s.nav}>
          {TABS[role].map(([l, h]) => { const on = path === h; return <Pressable key={h} onPress={() => router.replace(h as any)} style={[s.navItem, on && { backgroundColor: '#2c2c31' }]}><T color={on ? C.text : C.muted} w="600">{l}</T></Pressable>; })}
        </View>
      )}
    </SafeAreaView>
  );
}


// ---------- manager side (owner · manager · admin), from the App-Dashboard / App-Tables designs ----------
export const MenuButton = () => <Pressable accessibilityLabel="Open menu" onPress={() => setSidebar(true)} style={[{ width: 44, height: 44, marginLeft: -10 }, { alignItems: 'center', justifyContent: 'center' }]}><Icon d={ICON.menu} /></Pressable>;
export type MgrTab = 'dash' | 'tables' | 'team' | 'alerts' | 'profile';
const MGR_TABS: [MgrTab, string, string, string][] = [['dash', 'Dashboard', '/manager', ICON.manager], ['tables', 'Tables', '/manager/tables', ICON.tables], ['team', 'Team', '/manager/team', ICON.staff], ['alerts', 'Alerts', '/manager/notifications', ICON.bell]];
const centre = { alignItems: 'center', justifyContent: 'center' } as const;

/** Bottom nav pill: Dashboard · Tables · Team · Alerts · Profile (avatar). */
export function MgrNav({ active }: { active: MgrTab | null }) {
  const me = auth.get()?.staff;
  const go = (href: string) => router.replace(href as any);
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, backgroundColor: C.bg }}>
      <View style={{ height: 58, borderRadius: 29, backgroundColor: C.chip, padding: 5, flexDirection: 'row', gap: 4 }}>
        {MGR_TABS.map(([k, label, href, d]) => { const on = active === k; return (
          <Pressable key={k} accessibilityLabel={label} onPress={() => go(href)} style={[{ flex: 1, height: 48, borderRadius: 24, backgroundColor: on ? '#2c2c31' : 'transparent' }, centre]}><Icon d={d} color={on ? C.text : C.muted} /></Pressable>
        ); })}
        <Pressable accessibilityLabel="Profile" onPress={() => go('/manager/profile')} style={[{ flex: 1, height: 48, borderRadius: 24, backgroundColor: active === 'profile' ? '#2c2c31' : 'transparent' }, centre]}>
          <View style={[{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.chip2 }, centre]}><T w="600" size={12}>{me?.name[0] ?? '?'}</T></View>
        </Pressable>
      </View>
    </View>
  );
}


/** Sidebar (same sections as the web sidebar). Slides in from the left; the menu icon opens it. */
let sideOpen = false; const sideSubs = new Set<() => void>();
export const setSidebar = (v: boolean) => { sideOpen = v; sideSubs.forEach((f) => f()); };
const useSidebarOpen = () => useSyncExternalStore((cb) => { sideSubs.add(cb); return () => { sideSubs.delete(cb); }; }, () => sideOpen);
const SIDE: ({ section: string } | { label: string; href: string; icon: string; money?: boolean; section?: undefined; key?: string })[] = [
  { section: 'Overview' }, { label: 'Dashboard', href: '/manager', icon: ICON.manager },
  { section: 'Service' }, { label: 'Orders', href: '/manager/orders', icon: ICON.orders }, { label: 'Kitchen Display', href: '/manager/kitchen', icon: ICON.kitchen },
{ label: 'Tables', href: '/manager/tables', icon: ICON.tables }, { label: 'Billing', href: '/manager/billing', icon: ICON.billing, money: true },
  { section: 'Manage' }, { label: 'Menu & Dishes', href: '/manager/menu', icon: ICON.menuBook }, { label: 'Staff & Chefs', href: '/manager/team', icon: ICON.staff },
  { label: 'Shifts & Sections', href: '/manager/shifts', icon: ICON.shifts }, { label: 'Analytics', href: '/manager/analytics', icon: ICON.analytics, money: true }, { label: 'Settings', href: '/manager/settings', icon: ICON.settings },
];
export function MgrSidebar({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const reduce = useReducedMotion();
  const path = usePathname();
  const { section } = useGlobalSearchParams<{ section?: string }>();
  const me = auth.get()?.staff;
  const [mounted, setMounted] = useState(visible);
  const p = useSharedValue(0);
  const W = 280;
  useEffect(() => {
    if (visible) { setMounted(true); p.value = reduce ? 1 : withSpring(1, { ...springs.gentle, overshootClamping: true }); return; }
    p.value = reduce ? 0 : withTiming(0, { duration: duration.base, easing: easing.exit });
    const t = setTimeout(() => setMounted(false), reduce ? 0 : duration.base);
    return () => clearTimeout(t);
  }, [visible]);
  const back = useAnimatedStyle(() => ({ opacity: p.value }));
  const panel = useAnimatedStyle(() => ({ transform: [{ translateX: (p.value - 1) * W }] }));
  const go = (href: string) => { onClose(); router.replace(href as any); };
  const logout = async () => { onClose(); await api('/auth/logout', { body: {} }).catch(() => {}); await auth.clear(); router.replace('/welcome'); };
  const items = SIDE.filter((x) => !('money' in x) || !x.money || me?.role !== 'admin');
  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,.6)' }, back]}><Pressable style={{ flex: 1 }} onPress={onClose} /></Animated.View>
        <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: W, backgroundColor: C.bg, borderRightWidth: 1, borderRightColor: C.line }, panel]}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            <View style={{ height: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <T brand size={22}>DineOS</T><T w="600" size={15} color={C.muted}>{me ? me.role[0].toUpperCase() + me.role.slice(1) : ''}</T>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}>
              {items.map((x, i) => {
                if ('section' in x && x.section) return <T key={i} brand size={12} color={C.dim} style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 }}>{x.section}</T>;
                const it = x as { label: string; href: string; icon: string; key?: string };
                const base = it.href.split('?')[0];
                const on = it.key === 'queues' ? path === '/manager' && section === 'queues' : base === '/manager' ? path === '/manager' && section !== 'queues' : path === base || path.startsWith(base + '/');
                return (
                  <Pressable key={i} onPress={() => go(it.href)} style={{ height: 44, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: on ? C.chip : 'transparent' }}>
                    <Icon d={it.icon} size={20} color={on ? C.blue : C.muted} />
                    <T w={on ? '600' : '500'} size={14.5} color={on ? C.blue : C.muted}>{it.label}</T>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={logout} style={{ height: 48, marginHorizontal: 12, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}><Icon d={ICON.logout} size={20} color={C.red} /><T w="600" size={14.5} color={C.red}>Sign out</T></Pressable>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}


/** Puts the ← button on the same line as the page heading (the first child). */
function BackFirst({ children }: { children: ReactNode }) {
  const [first, ...rest] = Children.toArray(children);
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
        <Pressable accessibilityLabel="Back" onPress={() => router.replace('/manager')} style={[{ width: 44, height: 44, marginLeft: -12 }, centre]}><Icon d={ICON.back} /></Pressable>
        <View style={{ flex: 1, minWidth: 0, paddingTop: 5 }}>{first}</View>
      </View>
      {rest}
    </>
  );
}

/** Manager tab screen: menu (opens Profile) · DineOS · bell, scrolling body, bottom nav. */
export function MgrScreen({ active, children, gap = 24, nav, base = '/manager', header = true, back = false }: { active?: MgrTab; children: ReactNode; gap?: number; nav?: ReactNode; base?: '/manager' | '/waiter' | '/chef'; header?: boolean; back?: boolean }) {
  useLive();
  const { unread } = useNotifications();
  const side = useSidebarOpen();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      {header && (
      <View style={{ height: 56, paddingLeft: 4, paddingRight: 8, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable accessibilityLabel="Open menu" onPress={() => (base === '/manager' ? setSidebar(true) : router.replace(`${base}/profile` as any))} style={[{ width: 44, height: 44 }, centre]}><Icon d={ICON.menu} /></Pressable>
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
          <Pressable onPress={() => router.replace(base)} hitSlop={8}><T brand size={20}>DineOS</T></Pressable>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable accessibilityLabel="Notifications" onPress={() => router.replace(`${base}/notifications` as any)} style={[{ width: 44, height: 44 }, centre]}>
          <Icon d={ICON.bell} />
          {unread > 0 && <View style={{ position: 'absolute', top: 11, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue2 }} />}
        </Pressable>
      </View>
      )}
      {base === '/manager' && <MgrSidebar visible={side} onClose={() => setSidebar(false)} />}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: header ? 4 : 12, paddingHorizontal: 16, paddingBottom: 16, gap }}>{back ? <BackFirst>{children}</BackFirst> : children}</ScrollView>
      {nav ?? <MgrNav active={active ?? null} />}
    </SafeAreaView>
  );
}

/** Manager detail screen: back arrow, title + subtitle, optional right text, optional footer / bottom nav. */
export function MgrDetail({ title, sub, right, children, footer, nav, back, bottom, gap = 16, pad = 16 }: { title: string; sub?: string; right?: ReactNode; children: ReactNode; footer?: ReactNode; nav?: MgrTab; bottom?: ReactNode; back?: string; gap?: number; pad?: number }) {
  useLive();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <View style={{ height: 56, paddingLeft: 4, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Pressable accessibilityLabel="Back" onPress={() => (back ? router.replace(back as any) : router.canGoBack() ? router.back() : router.replace('/manager'))} style={[{ width: 44, height: 44 }, centre]}><Icon d={ICON.back} /></Pressable>
        <View style={{ flex: 1, minWidth: 0 }}><T w="700" size={16} numberOfLines={1}>{title}</T>{sub ? <T size={12} color={C.muted} numberOfLines={1}>{sub}</T> : null}</View>
        {right}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 4, paddingHorizontal: pad, paddingBottom: 16, gap }}>{children}</ScrollView>
      {footer}
      {bottom ?? (nav ? <MgrNav active={nav} /> : null)}
    </SafeAreaView>
  );
}

/** Section title (Comfortaa) with an optional blue link on the right. */
export function MSec({ title, right, children }: { title: string; right?: ReactNode; children?: ReactNode }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}><T brand size={15} color={C.muted}>{title}</T>{right}</View>
      {children}
    </View>
  );
}

/** Underlined tab strip (zones, roles, sections). */
export function UnderTabs<K extends string>({ items, value, onChange, gap = 20, h = 40, size = 14 }: { items: [K, string, (string | number)?][]; value: K; onChange: (k: K) => void; gap?: number; h?: number; size?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: C.line }} contentContainerStyle={{ gap }}>
      {items.map(([k, l, n]) => { const on = k === value; return (
        <Pressable key={k} onPress={() => onChange(k)} style={{ height: h, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: on ? C.blue : 'transparent' }}>
          <T w={on ? '700' : '500'} size={size} color={on ? C.text : C.muted}>{l}{n !== undefined ? <T size={size} color={C.dim}> {n}</T> : null}</T>
        </Pressable>
      ); })}
    </ScrollView>
  );
}

/** Filled pill used as a filter / choice (selected = light fill). */
export function Chip({ label, on, onPress, h = 36, px = 14, size = 13 }: { label: string; on: boolean; onPress: () => void; h?: number; px?: number; size?: number }) {
  return <Pressable onPress={onPress} style={{ height: h, paddingHorizontal: px, borderRadius: h / 2, backgroundColor: on ? C.text : C.chip, justifyContent: 'center' }}><T w="600" size={size} color={on ? C.bg : C.muted}>{label}</T></Pressable>;
}

/** Table state colours: [label, text, dot] */
export const TSTATE: Record<string, [string, string, string]> = {
  free: ['Free', '#a1a1a8', '#3a3a40'], seated: ['Ordering', '#f5c27a', '#f5b454'], eating: ['Dining', '#9cc3fa', '#7db0f9'], served: ['Dining', '#9cc3fa', '#7db0f9'],
  ready: ['Food ready', '#7fcfa3', '#5eb88a'], billing: ['Bill asked', '#d6c3ae', '#c9b29b'],
};

export const s = StyleSheet.create({
  input: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.chip, color: C.text, paddingHorizontal: 14, fontSize: 16, fontFamily: FONT['400'] },
  rowOuter: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2a2a2f' },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: C.border, borderRadius: 16, padding: 20, alignItems: 'center' },
  pill: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
  step: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  sheet: { maxHeight: '88%', backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, gap: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.chip2, alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', gap: 4, margin: 12, marginTop: 4, padding: 5, borderRadius: 29, backgroundColor: C.chip },
  navItem: { flex: 1, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  tile: { width: '31%', minHeight: 64, borderRadius: 14, backgroundColor: C.card, padding: 10, justifyContent: 'space-between' },
});
