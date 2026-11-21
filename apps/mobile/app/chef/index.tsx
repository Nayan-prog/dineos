import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated from 'react-native-reanimated';
import { api } from '../../lib/api';
import { ChefScreen, doneStats, minsSince, tickets, useChef, useQueueActions } from '../../lib/chef-ui';
import { ICON, Icon } from '../../lib/icons';
import { Pressable, rise } from '../../lib/motion';
import { C, Loading, T } from '../../lib/ui';

type Tab = 'queue' | 'cooking' | 'ready' | 'done';
const TABS: [Tab, string, string][] = [['queue', 'Queue', C.muted], ['cooking', 'Cooking', C.amber], ['ready', 'Ready', '#5eb88a'], ['done', 'Done', C.blue2]];
const NOTE: Record<Tab, string> = { queue: 'Waiting to start', cooking: 'On the fire now', ready: 'Waiting for the waiter to pick up', done: 'Finished today' };
let ackedStop = 0; // the cancel notice the chef already dismissed

/** Chef home (App-Chef): my tickets as Queue / Cooking / Ready / Done. Start claims a ticket's dishes, Mark ready alerts the waiter. */
export default function ChefHome() {
  const qc = useQueryClient();
  const c = useChef();
  const [tab, setTab] = useState<Tab>('queue');
  const [, rerender] = useState(0);
  const done = useQuery({ queryKey: ['done'], queryFn: () => api('/kitchen/done') });
  const activity = useQuery({ queryKey: ['activity'], queryFn: () => api('/team/activity') });
  const act = useMutation({ mutationFn: (fn: () => Promise<any>) => fn(), onSettled: () => qc.invalidateQueries(), onError: (e) => Alert.alert((e as Error).message) });
  const qa = useQueueActions();
  const d = c.d;
  if (!d) return <ChefScreen active="queue"><Loading /></ChefScreen>;
  const mineCooking = d.cooking.filter((i: any) => i.claimedBy === c.me.id);
  const list = { queue: tickets(d.waiting), cooking: tickets(mineCooking), ready: tickets(d.ready), done: [] }[tab];
  const doneRows: any[] = done.data ?? [];
  const st = doneStats(doneRows);
  const counts: Record<Tab, number> = { queue: tickets(d.waiting).length, cooking: tickets(mineCooking).length, ready: tickets(d.ready).length, done: st.made };
  const mates = d.chefs.filter((x: any) => x.id !== c.me.id).map((x: any) => x.name.split(' ')[0]);
  const stop = (activity.data ?? []).find((a: any) => a.kind === 'void' && a.id > ackedStop && Date.now() - new Date(a.createdAt).getTime() < 10 * 60000);
  const startAll = (items: any[]) => qa.claim(items.map((i) => i.id));
  const readyAll = (items: any[]) => qa.ready(items.map((i) => i.id));
  return (
    <ChefScreen active="queue">
      <Pressable onPress={() => router.push('/chef/station')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <T size={13} color={C.muted} style={{ flex: 1 }}>{mates.length ? `Shared with ${mates.join(' and ')} · ` : ''}{d.waiting.length} waiting</T>
        <T w="600" size={13} color={C.blue}>Station queue</T><Icon d={ICON.chev} size={14} color={C.blue} />
      </Pressable>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line }}>
        {TABS.map(([k, label, dot]) => { const on = k === tab; return (
          <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, height: 64, borderBottomWidth: 2, borderBottomColor: on ? C.blue : 'transparent' }}>
            <T w="700" size={22} color={on ? C.text : C.muted}>{counts[k]}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} /><T w={on ? '700' : '500'} size={12.5} color={on ? C.text : C.dim}>{label}</T></View>
          </Pressable>
        ); })}
      </View>

      {stop && (
        <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(224,112,92,0.12)' }}>
          <View style={{ flex: 1, minWidth: 0 }}><T w="600" color="#f09a88">Stop: a dish was cancelled</T><T size={12.5} color={C.muted}>{stop.text}</T></View>
          <Pressable onPress={() => { ackedStop = stop.id; rerender((n) => n + 1); }} style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: C.text, justifyContent: 'center' }}><T w="600" size={13} color={C.bg}>Got it</T></Pressable>
        </View>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T size={12.5} color={C.dim}>{NOTE[tab]}</T><T size={12.5} color={C.dim}>Oldest first</T></View>

      {tab === 'done' && (
        <Pressable onPress={() => router.replace('/chef/done')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 16, backgroundColor: C.card }}>
          <View><T w="600">{st.made} dishes made today</T><T size={12.5} color={C.dim}>Avg {st.avg} min · {st.onTime}% on time</T></View>
          <T w="600" color={C.blue}>See all</T>
        </Pressable>
      )}
      {tab !== 'done' && list.length === 0 && <T color={C.dim} style={{ paddingVertical: 24, textAlign: 'center' }}>Nothing here right now.</T>}
      <View style={{ gap: 10 }}>
        {list.map((k, n) => {
          const age = minsSince(k.oldest); const late = tab !== 'ready' && age > k.target;
          const time = tab === 'ready' ? `Ready ${minsSince(k.items[0].readyAt)}m ago` : age === 0 ? 'Just now' : `${age} min${late ? ' · late' : ''}`;
          const blocked = c.onBreak || c.mine + k.items.length > c.limit;
          return (
            <Animated.View key={`${tab}-${k.tableId}`} entering={rise(n)} style={{ backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: late ? 'rgba(245,180,84,0.45)' : 'transparent' }}>
              <Pressable onPress={() => router.push({ pathname: '/chef/ticket', params: { table: String(k.tableId) } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <T w="700" size={20}>{k.table}</T>
                <T size={12.5} color={C.dim}>#{k.orderId}{k.waiter ? ` · ${k.waiter.split(' ')[0]}` : ''}</T>
                <View style={{ flex: 1 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon d={ICON.clock} size={14} color={late ? C.amber : C.dim} /><T w="700" size={13} color={late ? C.amber : C.dim}>{time}</T></View>
              </Pressable>
              <View style={{ gap: 8, marginVertical: 12 }}>
                {k.items.map((i) => (
                  <View key={i.id} style={{ flexDirection: 'row', gap: 10 }}>
                    <T w="700" size={16} color={C.blue} style={{ minWidth: 26 }}>{i.qty}×</T>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T w="600" size={15}>{i.name}</T>
                      {[i.spice, ...(i.options ?? []), i.note].filter(Boolean).length > 0 && <T size={12.5} color="#f5c27a">{[i.spice, ...(i.options ?? []), i.note].filter(Boolean).join(' · ')}</T>}
                      {i.remake && <T w="700" size={12} color={C.red}>Remake</T>}
                    </View>
                    <T w="600" size={11} color={C.muted} style={{ alignSelf: 'flex-start' }}>{i.guestNo ? 'G' + i.guestNo : 'Shared'}</T>
                  </View>
                ))}
              </View>
              {tab === 'queue' && <Pressable haptic disabled={blocked} onPress={() => startAll(k.items)} style={{ height: 46, borderRadius: 23, backgroundColor: C.text, alignItems: 'center', justifyContent: 'center', opacity: blocked ? 0.45 : 1 }}><T w="600" size={15} color={C.bg}>{c.onBreak ? 'On break' : blocked ? 'At limit' : 'Start cooking'}</T></Pressable>}
              {tab === 'cooking' && <Pressable haptic onPress={() => readyAll(k.items)} style={{ height: 46, borderRadius: 23, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center' }}><T w="600" size={15} color="#fff">Mark ready</T></Pressable>}
              {tab === 'ready' && <View style={{ height: 46, borderRadius: 23, backgroundColor: 'rgba(94,184,138,0.12)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.green }} /><T w="600" color="#7fcfa3">At the pass{k.waiter ? ` · ${k.waiter.split(' ')[0]} notified` : ''}</T></View>}
            </Animated.View>
          );
        })}
      </View>
    </ChefScreen>
  );
}
