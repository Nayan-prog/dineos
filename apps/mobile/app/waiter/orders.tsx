import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { rupees } from '@dineos/shared';
import { api } from '../../lib/api';
import { Pressable, rise } from '../../lib/motion';
import { C, Loading, T } from '../../lib/ui';
import { WaiterScreen, useWaiter } from '../../lib/waiter-ui';

const LATE_MIN = 20;
const mins = (d: string) => Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));

/** My open orders (App-Waiter-Orders): one row per table with progress and the latest thing that happened. */
export default function WaiterOrders() {
  const { list: tables } = useWaiter();
  const q = useQuery({ queryKey: ['orders'], queryFn: () => api('/floor/orders') });
  const items: any[] = q.data ?? [];
  const rows = tables.filter((t) => t.sessionId).map((t) => {
    const mine = items.filter((i) => i.tableId === t.id && i.status !== 'cancelled');
    const served = mine.filter((i) => i.status === 'served').length;
    const ready = mine.find((i) => i.status === 'ready');
    const cooking = mine.filter((i) => i.status === 'cooking' || i.status === 'waiting');
    const oldest = [...cooking].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))[0];
    const late = oldest && mins(oldest.createdAt) >= LATE_MIN;
    const [state, fg]: [string, string] = t.state === 'billing' ? ['Bill asked', '#d6c3ae'] : ready ? ['Food ready', '#7fcfa3'] : late ? ['Late', '#f5c27a'] : oldest ? ['Cooking', '#f5c27a'] : mine.length ? ['All served', '#9cc3fa'] : ['Seated', '#9cc3fa'];
    const latest = t.state === 'billing' ? `${'amount' in t ? rupees(t.amount) + ' · ' : ''}open the bill` : ready ? `${ready.name} ready · ${mins(ready.createdAt)} min ago` : oldest ? `${oldest.name} ${oldest.status === 'cooking' ? 'cooking' : 'placed'} · ${mins(oldest.createdAt)} min` : mine.length ? 'Everything is served' : 'Nothing ordered yet';
    return { t, state, fg, latest, served, total: mine.length, orderId: mine[0]?.orderId };
  });
  return (
    <WaiterScreen active="orders" sub="My open orders" gap={4}>
      {!q.data ? <Loading /> : rows.length === 0 ? <T color={C.dim} style={{ paddingVertical: 24, textAlign: 'center' }}>No open orders right now.</T> : rows.map((r, i) => (
        <Animated.View key={r.t.id} entering={rise(i)}>
          <Pressable onPress={() => router.push(`/waiter/table/${r.t.id}`)} style={{ gap: 8, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <T w="700" size={18}>{r.t.code}</T>
              <T size={12.5} color={C.dim}>{r.orderId ? `#${r.orderId} · ` : ''}{r.t.guests} guests</T>
              <View style={{ flex: 1 }} />
              <T w="600" size={12.5} color={r.fg}>{r.state}</T>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: C.chip2 }}><View style={{ height: 4, borderRadius: 2, backgroundColor: C.blue2, width: `${r.total ? Math.round((r.served / r.total) * 100) : 0}%` }} /></View>
              <T size={12} color={C.muted}>{r.served}/{r.total} served</T>
            </View>
            <T size={12.5} color={C.dim}>{r.latest}</T>
          </Pressable>
        </Animated.View>
      ))}
    </WaiterScreen>
  );
}
