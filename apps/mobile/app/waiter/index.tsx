import { useState } from 'react';
import { Alert, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TASK_LABEL, type TaskKind } from '@dineos/shared';
import { api } from '../../lib/api';
import { optimistic } from '../../lib/optimistic';
import { ICON, Icon } from '../../lib/icons';
import { Pressable, rise } from '../../lib/motion';
import { C, Loading, T } from '../../lib/ui';
import { WaiterScreen } from '../../lib/waiter-ui';

type Tab = 'serve' | 'calls' | 'bills' | 'done';
const TABS: [Tab, string, string][] = [['serve', 'To serve', '#5eb88a'], ['calls', 'Calls', C.blue], ['bills', 'Bills', C.taupe], ['done', 'Done', C.blue2]];
const TAB_OF: Record<TaskKind, Tab> = { food_ready: 'serve', call: 'calls', bill: 'bills' };
const KIND: Record<TaskKind, [string, string]> = { food_ready: ['Food ready', '#7fcfa3'], call: ['Guest called', '#9cc3fa'], bill: ['Bill asked', '#d6c3ae'] };
const NOTE: Record<Tab, string> = { serve: 'Pick up from the kitchen pass', calls: 'Guests asking for you', bills: 'Tables ready to pay', done: 'Finished recently' };
const LATE_MIN = 5;
const mins = (d: string) => Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));

/** Waiter home (App-Waiter-Home): what needs me, grouped as To serve / Calls / Bills / Done. On it → Mark served / Done keeps the hand-off. */
export default function WaiterHome() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('serve');
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api('/team/tasks'), refetchInterval: 10000 });
  const act = useMutation({ mutationFn: ([id, what]: [number, string]) => api(`/team/tasks/${id}/${what}`, { body: {} }), ...optimistic<[number, string]>(qc, ['tasks'], (old, [id, what]) => ({ ...old, tasks: old.tasks.map((t: any) => (t.id === id ? (what === 'take' ? { ...t, status: 'taken', mine: true } : { ...t, status: 'done' }) : t)) }), (e) => Alert.alert(e.message)) });
  const all: any[] = tasks.data?.tasks ?? [];
  const mine = all.filter((t) => t.status === 'open' || (t.status === 'taken' && t.mine));
  const done = all.filter((t) => t.status === 'done');
  const count = (k: Tab) => (k === 'done' ? done.length : mine.filter((t) => TAB_OF[t.kind as TaskKind] === k).length);
  const list = tab === 'done' ? [] : mine.filter((t) => TAB_OF[t.kind as TaskKind] === tab);
  const open = all.filter((t) => t.status === 'open').length;
  const button = (t: any): [string, string, string, () => void] => {
    if (t.status === 'open') return ['On it', t.kind === 'food_ready' ? C.blue2 : C.text, t.kind === 'food_ready' ? '#fff' : C.bg, () => act.mutate([t.id, 'take'])];
    if (t.kind === 'bill') return ['Open bill', C.text, C.bg, () => router.push({ pathname: '/waiter/bill', params: { table: String(t.tableId) } })];
    if (t.kind === 'food_ready') return ['Mark served', C.blue2, '#fff', () => act.mutate([t.id, 'done'])];
    return ['Done', C.text, C.bg, () => act.mutate([t.id, 'done'])];
  };
  return (
    <WaiterScreen active="home">
      <Pressable onPress={() => router.push('/waiter/alerts')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <T size={13} color={C.muted} style={{ flex: 1 }}>{open === 0 ? 'No alerts waiting' : `${open} alert${open > 1 ? 's' : ''} need someone`}</T>
        <T w="600" size={13} color={C.blue}>Open alerts</T><Icon d={ICON.chev} size={14} color={C.blue} />
      </Pressable>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line }}>
        {TABS.map(([k, label, dot]) => { const on = k === tab; return (
          <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, height: 64, borderBottomWidth: 2, borderBottomColor: on ? C.blue : 'transparent' }}>
            <T w="700" size={22} color={on ? C.text : C.muted}>{count(k)}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} /><T w={on ? '700' : '500'} size={12.5} color={on ? C.text : C.dim}>{label}</T></View>
          </Pressable>
        ); })}
      </View>
      <T size={12.5} color={C.dim}>{NOTE[tab]}</T>
      {!tasks.data ? <Loading /> : tab === 'done' ? (
        <View>
          {done.length === 0 && <T color={C.dim} style={{ paddingVertical: 24, textAlign: 'center' }}>Nothing finished yet.</T>}
          {done.map((t, i) => (
            <Animated.View key={t.id} entering={rise(i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <T size={12.5} color={C.dim} style={{ width: 52 }}>{new Date(t.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: false })}</T>
              <View style={{ flex: 1 }}><T w="600">{TASK_LABEL[t.kind as TaskKind]}</T><T size={12} color={C.dim}>{t.table}</T></View>
            </Animated.View>
          ))}
        </View>
      ) : list.length === 0 ? <T color={C.dim} style={{ paddingVertical: 24, textAlign: 'center' }}>All caught up.</T> : (
        <View style={{ gap: 10 }}>
          {list.map((t, i) => {
            const m = mins(t.createdAt); const late = m >= LATE_MIN; const [kind, kindFg] = KIND[t.kind as TaskKind]; const [label, bg, fg, press] = button(t);
            const origin = t.level === 0 ? '' : t.ownTable ? 'Your table' : `Passed on from ${t.assignedName?.split(' ')[0] ?? 'nobody'}`;
            return (
              <Animated.View key={t.id} entering={rise(i)} style={{ backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: late ? 'rgba(245,180,84,0.45)' : 'transparent' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <T w="700" size={20}>{t.table}</T>
                  <T w="600" size={12.5} color={kindFg}>{kind}</T>
                  <View style={{ flex: 1 }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon d={ICON.clock} size={14} color={late ? C.amber : C.dim} /><T w="700" size={13} color={late ? C.amber : C.dim}>{m < 1 ? 'Now' : `${m} min`}</T></View>
                </View>
                <View style={{ gap: 6, marginTop: 10, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 10 }}><T w="600" size={15} style={{ flex: 1 }}>{t.detail || TASK_LABEL[t.kind as TaskKind]}</T>{origin ? <T size={12} color={C.dim}>{origin}</T> : null}</View>
                </View>
                <Pressable onPress={press} haptic style={{ height: 46, borderRadius: 23, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><T w="600" size={15} color={fg}>{label}</T></Pressable>
              </Animated.View>
            );
          })}
        </View>
      )}
    </WaiterScreen>
  );
}
