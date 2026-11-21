import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { api, auth, useLive } from './api';
import { optimistic } from './optimistic';
import { ICON, Icon } from './icons';
import { AnimDot, Pressable } from './motion';
import { C, T } from './ui';

const FLAME = 'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z';
const CHECK = 'M4 12l5 5L20 6';
const BOX = 'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10';
export type CTab = 'queue' | 'done' | 'stock' | 'alerts' | 'profile';
const centre = { alignItems: 'center', justifyContent: 'center' } as const;

/** Chef bottom nav (App-Chef): Queue · Done · Stock · Alerts · Profile (avatar). */
export function ChefNav({ active }: { active: CTab | null }) {
  const me = auth.get()?.staff;
  const tabs: [CTab, string, string, string][] = [['queue', 'Queue', '/chef', FLAME], ['done', 'Done', '/chef/done', CHECK], ['stock', 'Stock', '/chef/stock', BOX], ['alerts', 'Alerts', '/chef/notifications', ICON.bell]];
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, backgroundColor: C.bg }}>
      <View style={{ height: 58, borderRadius: 29, backgroundColor: C.chip, padding: 5, flexDirection: 'row', gap: 4 }}>
        {tabs.map(([k, label, href, d]) => (
          <Pressable key={k} accessibilityLabel={label} onPress={() => router.replace(href as any)} style={[{ flex: 1, height: 48, borderRadius: 24, backgroundColor: active === k ? '#2c2c31' : 'transparent' }, centre]}><Icon d={d} color={active === k ? C.text : C.muted} /></Pressable>
        ))}
        <Pressable accessibilityLabel="Profile" onPress={() => router.replace('/chef/profile')} style={[{ flex: 1, height: 48, borderRadius: 24, backgroundColor: active === 'profile' ? '#2c2c31' : 'transparent' }, centre]}>
          <View style={[{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.chip2 }, centre]}><T w="600" size={12}>{me?.name[0] ?? '?'}</T></View>
        </Pressable>
      </View>
    </View>
  );
}

/** The shared station queue plus my own state (capacity, break). */
export function useChef() {
  const me = auth.get()!.staff;
  const qc = useQueryClient();
  const queue = useQuery({ queryKey: ['queue'], queryFn: () => api('/kitchen/queue'), refetchInterval: 15000 });
  const brk = useMutation({ mutationFn: (onBreak: boolean) => api(`/team/staff/${me.id}`, { method: 'PATCH', body: { onBreak } }), onSuccess: () => qc.invalidateQueries() });
  const d = queue.data;
  const onBreak: boolean = d?.chefs.find((c: any) => c.id === me.id)?.onBreak ?? false;
  const limit: number = d?.me?.maxParallel ?? 4;
  const mine: number = d ? d.cooking.filter((i: any) => i.claimedBy === me.id).length : 0;
  return { me, queue, d, onBreak, limit, mine, full: mine >= limit, toggleBreak: () => brk.mutate(!onBreak), sub: d ? `${d.station.name} station` : ' ' };
}

/** A ticket = every dish of one table in the same state. */
export type Ticket = { tableId: number; table: string; orderId: number; waiter: string | null; area: string; guests: number; items: any[]; oldest: string; target: number };
export function tickets(items: any[]): Ticket[] {
  const by = new Map<number, Ticket>();
  for (const i of items) {
    const t = by.get(i.tableId);
    if (!t) by.set(i.tableId, { tableId: i.tableId, table: i.table, orderId: i.orderId, waiter: i.waiter, area: i.area, guests: i.guests, items: [i], oldest: i.createdAt, target: i.prepMinutes });
    else { t.items.push(i); if (new Date(i.createdAt) < new Date(t.oldest)) t.oldest = i.createdAt; t.target = Math.max(t.target, i.prepMinutes); }
  }
  return [...by.values()];
}
export const minsSince = (d: string | null) => (d ? Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000)) : 0);

/** Chef tab screen: avatar (opens Profile), name, station, duty switch; scrolling body; bottom nav. */
export function ChefScreen({ active, children, sub, gap = 14 }: { active: CTab; children: ReactNode; sub?: string; gap?: number }) {
  useLive();
  const c = useChef();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <View style={{ height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable accessibilityLabel="Profile" onPress={() => router.replace('/chef/profile')} style={[{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.chip2 }, centre]}><T w="700">{c.me.name[0]}</T></Pressable>
        <View style={{ flex: 1, minWidth: 0 }}><T w="700" size={16} numberOfLines={1}>{c.me.name}</T><T size={12.5} color={C.muted} numberOfLines={1}>{sub ?? c.sub}</T></View>
        <Pressable onPress={c.toggleBreak} hitSlop={8} style={{ height: 34, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AnimDot color={c.onBreak ? C.amber : C.green} />
          <T w="700" size={12.5} color={c.onBreak ? '#f5c27a' : '#7fcfa3'}>{c.onBreak ? 'On break' : 'On duty'}</T>
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap }}>{children}</ScrollView>
      <ChefNav active={active} />
    </SafeAreaView>
  );
}

/** Numbers for "done today": dishes made, average prep minutes, share made within the dish's target time. */
export function doneStats(rows: any[]) {
  const prep = (r: any) => (r.claimedAt && r.readyAt ? Math.max(0, Math.round((new Date(r.readyAt).getTime() - new Date(r.claimedAt).getTime()) / 60000)) : 0);
  const made = rows.reduce((a, r) => a + r.qty, 0);
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + prep(r), 0) / rows.length) : 0;
  const onTime = rows.length ? Math.round((rows.filter((r) => prep(r) <= r.prepMinutes).length / rows.length) * 100) : 0;
  return { made, avg, onTime, prep };
}

/** Start / Ready that update the queue on screen straight away (rolled back if the server refuses). */
export function useQueueActions() {
  const qc = useQueryClient();
  const me = auth.get()!.staff;
  const claim = useMutation({
    mutationFn: (ids: number[]) => api('/kitchen/claim', { body: { ids: ids.slice(0, 10) } }),
    ...optimistic<number[]>(qc, ['queue'], (old, ids) => {
      const moved = old.waiting.filter((i: any) => ids.includes(i.id)).map((i: any) => ({ ...i, status: 'cooking', claimedBy: me.id, claimedAt: new Date().toISOString(), chef: me.name }));
      return { ...old, waiting: old.waiting.filter((i: any) => !ids.includes(i.id)), cooking: [...old.cooking, ...moved] };
    }, (e) => Alert.alert(e.message)),
  });
  const ready = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => api(`/kitchen/items/${id}/ready`, { body: {} }))),
    ...optimistic<number[]>(qc, ['queue'], (old, ids) => {
      const moved = old.cooking.filter((i: any) => ids.includes(i.id)).map((i: any) => ({ ...i, status: 'ready', readyAt: new Date().toISOString() }));
      return { ...old, cooking: old.cooking.filter((i: any) => !ids.includes(i.id)), ready: [...old.ready, ...moved] };
    }, (e) => Alert.alert(e.message)),
  });
  return { claim: (ids: number[]) => claim.mutate(ids), ready: (ids: number[]) => ready.mutate(ids) };
}
