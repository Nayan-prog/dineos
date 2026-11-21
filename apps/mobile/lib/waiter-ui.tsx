import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, auth, useLive } from './api';
import { ICON, Icon } from './icons';
import { AnimDot, Pressable } from './motion';
import { C, T } from './ui';

const HOME = 'M3 11.5L12 4l9 7.5M5.5 10v9.5a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V10';
const RECEIPT = 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6';
export type WTab = 'home' | 'tables' | 'orders' | 'profile';
const centre = { alignItems: 'center', justifyContent: 'center' } as const;

/** "T1 to T7" for a run of codes, otherwise a comma list */
export function tableRange(codes: string[]) {
  if (!codes.length) return 'No tables';
  const m = codes.map((c) => c.match(/^([A-Za-z]*)(\d+)$/));
  if (codes.length > 1 && m.every(Boolean) && m.every((x) => x![1] === m[0]![1])) {
    const n = m.map((x) => Number(x![2])).sort((a, b) => a - b);
    if (n.every((v, i) => i === 0 || v === n[i - 1] + 1)) return `${m[0]![1]}${n[0]} to ${m[0]![1]}${n[n.length - 1]}`;
  }
  return codes.join(', ');
}

/** Waiter bottom nav (App-Waiter-Home): Home · My tables · Order (the prominent blue action) · Orders · Profile. */
export function WaiterNav({ active }: { active: WTab | null }) {
  const me = auth.get()?.staff;
  const go = (href: string) => router.replace(href as any);
  const item = (k: WTab, label: string, href: string, d: string) => (
    <Pressable key={k} accessibilityLabel={label} onPress={() => go(href)} style={[{ flex: 1, height: 48, borderRadius: 24, backgroundColor: active === k ? '#2c2c31' : 'transparent' }, centre]}><Icon d={d} color={active === k ? C.text : C.muted} /></Pressable>
  );
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, backgroundColor: C.bg }}>
      <View style={{ height: 58, borderRadius: 29, backgroundColor: C.chip, padding: 5, flexDirection: 'row', gap: 4 }}>
        {item('home', 'Home', '/waiter', HOME)}
        {item('tables', 'My tables', '/waiter/tables', ICON.tables)}
        <Pressable accessibilityLabel="Take order" haptic onPress={() => router.push('/waiter/take-order')} style={[{ flex: 1.3, height: 48, borderRadius: 24, backgroundColor: C.blue2, flexDirection: 'row', gap: 4 }, centre]}>
          <Icon d={ICON.plus} size={20} color="#fff" sw={2.4} /><T w="700" size={13} color="#fff">Order</T>
        </Pressable>
        {item('orders', 'Orders', '/waiter/orders', RECEIPT)}
        <Pressable accessibilityLabel="Profile" onPress={() => go('/waiter/profile')} style={[{ flex: 1, height: 48, borderRadius: 24, backgroundColor: active === 'profile' ? '#2c2c31' : 'transparent' }, centre]}>
          <View style={[{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.chip2 }, centre]}><T w="600" size={12}>{me?.name[0] ?? '?'}</T></View>
        </Pressable>
      </View>
    </View>
  );
}

/** My tables, area and break state, shared by the waiter screens. */
export function useWaiter() {
  const me = auth.get()!.staff;
  const qc = useQueryClient();
  const tables = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables') });
  const meQ = useQuery({ queryKey: ['me'], queryFn: () => api('/auth/me') });
  const brk = useMutation({ mutationFn: (onBreak: boolean) => api(`/team/staff/${me.id}`, { method: 'PATCH', body: { onBreak } }), onSuccess: () => qc.invalidateQueries() });
  const list: any[] = tables.data?.tables ?? [];
  const onBreak = meQ.data?.staff.onBreak ?? false;
  return { me, tables, list, onBreak, toggleBreak: () => brk.mutate(!onBreak), sub: list.length ? `Tables ${tableRange(list.map((t) => t.code))} · ${list[0].area}` : 'No tables assigned' };
}

/** Waiter tab screen: avatar (opens Profile), name, tables, duty switch; scrolling body; bottom nav. */
export function WaiterScreen({ active, children, sub, gap = 14 }: { active: WTab; children: ReactNode; sub?: string; gap?: number }) {
  useLive();
  const w = useWaiter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <View style={{ height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable accessibilityLabel="Profile" onPress={() => router.replace('/waiter/profile')} style={[{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.chip2 }, centre]}><T w="700">{w.me.name[0]}</T></Pressable>
        <View style={{ flex: 1, minWidth: 0 }}><T w="700" size={16} numberOfLines={1}>{w.me.name}</T><T size={12.5} color={C.muted} numberOfLines={1}>{sub ?? w.sub}</T></View>
        <Pressable onPress={w.toggleBreak} hitSlop={8} style={{ height: 34, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AnimDot color={w.onBreak ? C.amber : C.green} />
          <T w="600" size={12.5} color={w.onBreak ? '#f5c27a' : '#7fcfa3'}>{w.onBreak ? 'On break' : 'On duty'}</T>
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap }}>{children}</ScrollView>
      <WaiterNav active={active} />
    </SafeAreaView>
  );
}
