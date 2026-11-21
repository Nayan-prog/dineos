import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useChef, useQueueActions } from '../../lib/chef-ui';
import { Pressable } from '../../lib/motion';
import { C, FONT, Loading, MgrDetail, MSec, T } from '../../lib/ui';

const pad = (n: number) => String(n).padStart(2, '0');

/** Ticket (App-Chef-Ticket): one table's dishes for my station with a running timer; Start / Mark ready each, or all at once. */
export default function Ticket() {
  const { table } = useLocalSearchParams<{ table: string }>();
  const qc = useQueryClient();
  const c = useChef();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const act = useMutation({ mutationFn: (fn: () => Promise<any>) => fn(), onSettled: () => qc.invalidateQueries(), onError: (e) => Alert.alert((e as Error).message) });
  const qa = useQueueActions();
  const d = c.d;
  if (!d) return <MgrDetail title="Ticket" back="/chef"><Loading /></MgrDetail>;
  const all: any[] = [...d.waiting, ...d.cooking, ...d.ready].filter((i) => i.tableId === Number(table));
  if (all.length === 0) return <MgrDetail title="Ticket" back="/chef"><T color={C.dim}>Nothing left on this ticket.</T></MgrDetail>;
  const first = all[0];
  const active = all.filter((i) => i.status !== 'ready');
  const target = Math.max(...all.map((i) => i.prepMinutes));
  const placed = new Date(Math.min(...all.map((i) => new Date(i.createdAt).getTime())));
  const secs = Math.max(0, Math.round((Date.now() - placed.getTime()) / 1000));
  const late = Math.floor(secs / 60) - target;
  const over = active.length > 0 && late > 0;
  const color = over ? '#f5c27a' : C.text;
  const others: any[] = (d.others ?? []).filter((o: any) => o.tableId === Number(table));
  const readyNow = (i: any) => qa.ready([i.id]);
  const startNow = (i: any) => qa.claim([i.id]);
  const mineActive = active.filter((i) => i.status === 'cooking' && i.claimedBy === c.me.id);
  const look = (i: any): [string, string, string, () => void] | null => {
    if (i.status === 'ready') return ['✓ Ready', 'rgba(94,184,138,0.14)', '#7fcfa3', () => {}];
    if (i.status === 'waiting') return ['Start', C.text, C.bg, () => startNow(i)];
    return i.claimedBy === c.me.id ? ['Mark ready', C.blue2, '#fff', () => readyNow(i)] : null;
  };
  return (
    <MgrDetail title={`Table ${first.table} · #${first.orderId}`} sub={`${first.area} · ${first.guests} guests${first.waiter ? ' · Waiter ' + first.waiter.split(' ')[0] : ''}`} back="/chef" gap={20}
      footer={<View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 10 }}>
        <Pressable haptic disabled={mineActive.length === 0} onPress={() => qa.ready(mineActive.map((i) => i.id))} style={{ height: 54, borderRadius: 27, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center', opacity: mineActive.length ? 1 : 0.6 }}>
          <T w="600" size={15} color="#fff">{active.length ? `Mark all ready (${mineActive.length} left)` : `All ready${first.waiter ? ' · ' + first.waiter.split(' ')[0] + ' notified' : ''}`}</T>
        </Pressable>
        <Pressable onPress={() => router.replace('/chef/stock')} style={{ height: 44, borderRadius: 22, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' }}><T w="600" size={13.5} color="#f09a88">Can't make a dish</T></Pressable>
      </View>}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View><T size={13} color={C.muted}>Time since order</T><T style={{ fontSize: 40, letterSpacing: -0.5, color, fontFamily: FONT['700'] }}>{pad(Math.floor(secs / 60))}:{pad(secs % 60)}</T></View>
        <View style={{ alignItems: 'flex-end' }}>
          <T w="600" size={13} color={over ? '#f5c27a' : C.muted}>{over ? `Late by ${late} min` : 'On time'}</T>
          <T size={12.5} color={C.dim}>Target {target} min · placed {placed.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</T>
        </View>
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: C.chip2 }}><View style={{ height: 4, borderRadius: 2, backgroundColor: over ? C.amber : C.blue2, width: `${Math.min(100, (secs / 60 / target) * 100)}%` }} /></View>

      <MSec title="Dishes for your station">
        {all.map((i) => { const l = look(i); const done = i.status === 'ready'; const note = [i.spice, ...(i.options ?? []), i.note].filter(Boolean).join(' · '); return (
          <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <T w="700" size={18} color={C.blue} style={{ minWidth: 30 }}>{i.qty}×</T>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T w="600" size={16} color={done ? C.dim : C.text} style={{ textDecorationLine: done ? 'line-through' : 'none' }}>{i.name}</T>
              {note ? <T size={13} color="#f5c27a">{note}</T> : null}
              <T size={12} color={C.dim}>{i.guestNo ? 'Guest ' + i.guestNo : 'Shared'}{i.status === 'cooking' && i.chef ? ' · ' + (i.claimedBy === c.me.id ? 'You' : i.chef.split(' ')[0]) : ''}</T>
            </View>
            {l && <Pressable haptic={!done} disabled={done} onPress={l[3]} style={{ height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: l[1], justifyContent: 'center' }}><T w="600" size={13} color={l[2]}>{l[0]}</T></Pressable>}
          </View>
        ); })}
      </MSec>
      {others.length > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <T size={13} color={C.muted}>Other stations on this order</T>
          <T size={13} style={{ flex: 1, textAlign: 'right' }}>{others.map((o) => `${o.station} · ${o.n} dish${o.n > 1 ? 'es' : ''} ${o.status === 'cooking' ? 'cooking' : 'waiting'}`).join(', ')}</T>
        </View>
      )}
    </MgrDetail>
  );
}
