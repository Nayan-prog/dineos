import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { ICON, Icon } from '../../lib/icons';
import { ColorRing, CountUp, Pressable, rise } from '../../lib/motion';
import { C, FONT, Loading, MgrScreen, T, TSTATE, UnderTabs } from '../../lib/ui';

const LEGEND: [string, string][] = [['Order', C.amber], ['Dining', C.blue], ['Ready', C.green], ['Bill', C.taupe]];
const big = { color: C.text, fontSize: 20, fontFamily: FONT['700'] } as const;

/** Tables (App-Tables): live state of every table by zone, "Add table" opens the add screen. */
export default function Tables() {
  const t = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables') });
  const areas = useQuery({ queryKey: ['areas'], queryFn: () => api('/floor/areas') });
  const [zone, setZone] = useState<number | null>(null);
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - 32 - 24) / 4);
  const head = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View>
        <T w="700" size={26} style={{ letterSpacing: -0.3 }}>Tables</T>
        <T size={13} color={C.muted} style={{ marginTop: 2 }}>{t.data ? `${t.data.summary.tables} tables · ${t.data.summary.seats} seats` : ' '}</T>
        </View>
      </View>
      <Pressable onPress={() => router.push('/manager/table-new')} hitSlop={8} style={{ height: 40, flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon d={ICON.plus} size={16} color={C.blue} sw={2} /><T w="600" color={C.blue}>Add table</T></Pressable>
    </View>
  );
  if (!t.data || !areas.data) return <MgrScreen active="tables" gap={16} header={false} back>{head}<Loading /></MgrScreen>;
  const sum = t.data.summary;
  const zones: { id: number; name: string }[] = areas.data;
  const current = zone ?? zones[0]?.id;
  const list: any[] = t.data.tables.filter((x: any) => x.areaId === current);
  const zBusy = list.filter((x) => x.state !== 'free').length;
  const zGuests = list.reduce((a, x) => a + x.guests, 0);
  const zSeats = list.reduce((a, x) => a + x.seats, 0);
  const bar = (pct: number) => <View style={{ height: 3, borderRadius: 2, backgroundColor: C.chip2, marginTop: 6 }}><View style={{ height: 3, borderRadius: 2, backgroundColor: C.blue2, width: `${Math.min(100, pct)}%` }} /></View>;
  return (
    <MgrScreen active="tables" gap={16} header={false} back>
      {head}
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <View style={{ flex: 1 }}>
          <T size={12.5} color={C.muted}>Tables in use</T>
          <T style={{ marginTop: 2 }}><CountUp value={sum.occupied} style={big} /><T w="500" size={13} color={C.dim}> / {sum.tables}</T></T>
          {bar(sum.tables ? (sum.occupied / sum.tables) * 100 : 0)}
        </View>
        <View style={{ flex: 1 }}>
          <T size={12.5} color={C.muted}>Seats occupied</T>
          <T style={{ marginTop: 2 }}><CountUp value={sum.guests} style={big} /><T w="500" size={13} color={C.dim}> / {sum.seats}</T></T>
          {bar(sum.seats ? (sum.guests / sum.seats) * 100 : 0)}
        </View>
      </View>
      <View>
        <UnderTabs items={zones.map((z) => [String(z.id), z.name] as [string, string])} value={String(current)} onChange={(k) => setZone(Number(k))} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <T size={12} color={C.dim}>{zBusy} of {list.length} busy · {zGuests}/{zSeats} seats</T>
          <View style={{ flexDirection: 'row', gap: 10 }}>{LEGEND.map(([l, c]) => <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} /><T size={12} color={C.dim}>{l}</T></View>)}</View>
        </View>
      </View>
      {list.length === 0 && <T color={C.dim}>No tables in this area yet</T>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {list.map((x, i) => {
          const [label, , dot] = TSTATE[x.state] ?? TSTATE.free;
          const free = x.state === 'free';
          return (
            <Animated.View key={x.id} entering={rise(i)}>
              <Pressable accessibilityLabel={`Table ${x.code}, ${label}, ${x.guests} of ${x.seats} seats`} onPress={() => router.push(`/manager/table/${x.id}`)} style={{ width: tile, height: 68, padding: 9, paddingHorizontal: 10, borderRadius: 14, backgroundColor: C.card, justifyContent: 'space-between' }}>
                <ColorRing color="rgba(94,184,138,0.6)" off={x.state !== 'ready'} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <T w="700" size={15} color={free ? C.dim : C.text}>{x.code}</T>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: free ? 'transparent' : dot }} />
                </View>
                <T size={11.5} color={free ? '#6f6f78' : C.muted}>{free ? `${x.seats} seats` : `${x.guests}/${x.seats} seats`}</T>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </MgrScreen>
  );
}
