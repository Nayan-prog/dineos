import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { rupees } from '@dineos/shared';
import { ColorRing, CountUp, Pressable, rise } from '../../lib/motion';
import { C, FONT, Loading, T, TSTATE } from '../../lib/ui';
import { WaiterScreen, useWaiter } from '../../lib/waiter-ui';

const HINT: Record<string, string> = { seated: 'Choosing dishes', eating: 'Food on the way', ready: 'Food ready', served: 'Eating', billing: 'Waiting to pay' };
const big = { color: C.text, fontSize: 22, fontFamily: FONT['700'] } as const;
const mins = (d: string | null) => (d ? Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000)) : 0);

/** My tables (App-Waiter-Tables): live state of each table I own. Free tables go straight to Take order. */
export default function WaiterTables() {
  const { tables, list } = useWaiter();
  const busy = list.filter((t) => t.state !== 'free').length;
  const guests = list.reduce((a, t) => a + t.guests, 0);
  const seats = list.reduce((a, t) => a + t.seats, 0);
  return (
    <WaiterScreen active="tables">
      <View style={{ flexDirection: 'row', gap: 24, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <View><T><CountUp value={busy} style={big} /><T w="500" size={14} color={C.dim}> / {list.length}</T></T><T size={12} color={C.dim}>Tables busy</T></View>
        <View><T><CountUp value={guests} style={big} /><T w="500" size={14} color={C.dim}> / {seats}</T></T><T size={12} color={C.dim}>Guests seated</T></View>
      </View>
      {!tables.data ? <Loading /> : list.length === 0 ? <T color={C.dim}>No tables assigned to you yet. Ask the manager.</T> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {list.map((t, i) => {
            const [label, fg, dot] = TSTATE[t.state] ?? TSTATE.free; const free = t.state === 'free';
            return (
              <Animated.View key={t.id} entering={rise(i)} style={{ width: '47%' }}>
                <Pressable accessibilityLabel={`Table ${t.code}, ${label}`} onPress={() => (free ? router.push({ pathname: '/waiter/take-order', params: { table: String(t.id) } }) : router.push(`/waiter/table/${t.id}`))} style={{ minHeight: 104, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: C.card, gap: 4 }}>
                  <ColorRing color="rgba(94,184,138,0.6)" off={t.state !== 'ready'} radius={16} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <T w="700" size={20} color={free ? C.muted : C.text}>{t.code}</T>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: free ? 'transparent' : dot }} /><T w="600" size={12} color={free ? C.dim : fg}>{label}</T></View>
                  </View>
                  <T size={12.5} color={C.muted}>{free ? `${t.seats} seats · tap to seat guests` : `${t.guests} of ${t.seats} seats · ${HINT[t.state] ?? ''}`}</T>
                  {!free && <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto' }}><T w="600" size={13}>{'amount' in t ? rupees(t.amount) : ''}</T><T size={13} color={C.dim}>{mins(t.openedAt)}m</T></View>}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      )}
    </WaiterScreen>
  );
}
