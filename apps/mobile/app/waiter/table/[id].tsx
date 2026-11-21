import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rupees } from '@dineos/shared';
import { api } from '../../../lib/api';
import { optimistic } from '../../../lib/optimistic';
import { Pressable } from '../../../lib/motion';
import { C, Loading, MgrDetail, Row, T, TSTATE } from '../../../lib/ui';

const L: Record<string, [string, string]> = {
  served: ['Served', '#7fcfa3'], ready: ['Ready at the pass', '#9cc3fa'], cooking: ['Cooking', '#f5c27a'],
  waiting: ['Waiting · kitchen has not started', C.muted], cancelled: ['Cancelled', C.dim],
};

/** Table (App-OrderDetail): dishes by guest with live status, Mark served, Cancel while still Placed, running total, Add items / Bill. */
export default function TableScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ['table', id], queryFn: () => api(`/floor/tables/${id}`) });
  const act = useMutation({ mutationFn: (fn: () => Promise<any>) => fn(), onSuccess: () => qc.invalidateQueries(), onError: (e) => Alert.alert((e as Error).message) });
  const serve = useMutation({ mutationFn: (itemId: number) => api(`/floor/items/${itemId}/served`, { body: {} }), ...optimistic<number>(qc, ['table', id], (old, itemId) => ({ ...old, items: old.items.map((i: any) => (i.id === itemId ? { ...i, status: 'served' } : i)) }), (e) => Alert.alert(e.message)) });
  if (error) return <MgrDetail title="Table" back="/waiter/tables"><T color={C.red}>{(error as Error).message}</T></MgrDetail>;
  if (!data) return <MgrDetail title="Table" back="/waiter/tables"><Loading /></MgrDetail>;
  const { table, session, items, totals } = data;
  const live = items.filter((i: any) => i.status !== 'cancelled');
  const served = live.filter((i: any) => i.status === 'served').length;
  const pct = live.length ? Math.round((served / live.length) * 100) : 0;
  const state = !session ? 'free' : session.status === 'billing' ? 'billing' : !live.length ? 'seated' : live.some((i: any) => i.status === 'ready') ? 'ready' : live.some((i: any) => i.status === 'waiting' || i.status === 'cooking') ? 'eating' : 'served';
  const [label, textColor] = TSTATE[state];
  const seated = session ? Math.max(0, Math.round((Date.now() - new Date(session.openedAt).getTime()) / 60000)) : 0;
  const detail = (i: any) => i.status === 'cooking' ? `Cooking${i.chef ? ' · ' + i.chef.split(' ')[0] : ''}` : L[i.status][0];
  const addItems = () => router.push({ pathname: '/waiter/take-order', params: { table: String(table.id) } });
  const footer = (
    <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, flexDirection: 'row', gap: 10 }}>
      <Pressable onPress={addItems} haptic style={{ flex: 1, height: 50, borderRadius: 25, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' }}><T w="600">{session ? 'Add items' : 'Take order'}</T></Pressable>
      {session && <Pressable onPress={() => router.push({ pathname: '/waiter/bill', params: { table: String(table.id) } })} haptic style={{ flex: 1, height: 50, borderRadius: 25, backgroundColor: C.text, alignItems: 'center', justifyContent: 'center' }}><T w="600" color={C.bg}>Bill</T></Pressable>}
    </View>
  );
  return (
    <MgrDetail title={`Table ${table.code}`} sub={session ? `${session.guestCount} guests · ${table.seats} seats · seated ${seated} min` : `${table.area} · ${table.seats} seats`} back="/waiter/tables" footer={footer}
      right={<T w="600" size={12} color={textColor} style={{ marginRight: 4 }}>{label}</T>}>
      {session && (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}><T w="600" size={15}>{served} of {live.length} dishes served</T><T w="700" size={18} color={C.blue}>{pct}%</T></View>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: C.chip2, marginTop: 8 }}><View style={{ height: 5, borderRadius: 3, backgroundColor: C.blue2, width: `${pct}%` }} /></View>
        </View>
      )}
      {!session && <T color={C.dim}>Free table. Take an order to seat guests.</T>}
      <View>
        {items.map((it: any, n: number) => {
          const [, color] = L[it.status];
          return (
            <Row key={it.id} i={n} style={{ minHeight: 58, opacity: it.status === 'cancelled' ? 0.7 : 1 }}>
              <T w="600" size={11} color={C.muted} style={{ minWidth: 48, textAlign: 'center' }}>{it.guestNo ? 'G' + it.guestNo : 'Shared'}</T>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T w="600" size={14} color={it.status === 'cancelled' ? C.dim : C.text} style={{ textDecorationLine: it.status === 'cancelled' ? 'line-through' : 'none' }}>{it.qty} × {it.name}</T>
                <T size={12} color={color}>{detail(it)}</T>
                {[it.spice, ...(it.options ?? []), it.note].filter(Boolean).length > 0 && <T size={12} color={C.taupe}>{[it.spice, ...(it.options ?? []), it.note].filter(Boolean).join(' · ')}</T>}
              </View>
              {it.status === 'ready' && <Pressable haptic onPress={() => serve.mutate(it.id)} style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: C.blue2, justifyContent: 'center' }}><T w="600" size={12.5} color="#fff">Mark served</T></Pressable>}
              {it.status === 'waiting' && <Pressable onPress={() => Alert.alert(`Cancel ${it.name}?`, '', [{ text: 'Keep' }, { text: 'Cancel dish', style: 'destructive', onPress: () => act.mutate(() => api(`/floor/items/${it.id}/cancel`, { body: {} })) }])} style={{ height: 34, paddingHorizontal: 10, justifyContent: 'center' }}><T w="600" size={12.5} color={C.red}>Cancel</T></Pressable>}
            </Row>
          );
        })}
        {session && items.length === 0 && <T color={C.dim}>Nothing ordered yet</T>}
      </View>
      {session && totals && 'total' in totals && <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T size={13.5} color={C.muted}>Running total incl. GST</T><T w="700">{rupees(totals.total)}</T></View>}
    </MgrDetail>
  );
}
