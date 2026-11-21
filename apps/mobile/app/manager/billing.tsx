import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { rupees } from '@dineos/shared';
import { api } from '../../lib/api';
import { CountUp, Pressable } from '../../lib/motion';
import { since } from '../../lib/notify';
import { C, FONT, Loading, MgrScreen, MSec, Row, T } from '../../lib/ui';

const kv = { color: C.text, fontSize: 22, fontFamily: FONT['700'], marginTop: 4 } as const;

/** Billing (web "Billing"): collected today by method, open tables, paid bills. Owner and manager only. */
export default function Billing() {
  const tables = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables') });
  const bills = useQuery({ queryKey: ['bills'], queryFn: () => api('/floor/bills') });
  const head = (sub: string) => <View><T w="700" size={26} style={{ letterSpacing: -0.3 }}>Billing</T><T size={13} color={C.muted} style={{ marginTop: 2 }}>{sub}</T></View>;
  if (!tables.data || !bills.data) return <MgrScreen header={false} back gap={20}>{head(' ')}<Loading /></MgrScreen>;
  const open: any[] = tables.data.tables.filter((t: any) => t.state !== 'free');
  const today: any[] = bills.data.filter((b: any) => new Date(b.paidAt).toDateString() === new Date().toDateString());
  const sum = (m?: string) => today.filter((b) => !m || b.method === m).reduce((a, b) => a + b.total, 0);
  const kpis: [string, number][] = [['Collected today', sum()], ['UPI', sum('upi')], ['Card', sum('card')], ['Cash', sum('cash')]];
  return (
    <MgrScreen header={false} back gap={22}>
      {head(`${today.length} bills today`)}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 18, columnGap: 16 }}>
        {kpis.map(([l, v]) => <View key={l} style={{ width: '47%' }}><T size={12.5} color={C.muted}>{l}</T><CountUp value={v} format={rupees} style={kv} /></View>)}
      </View>
      <MSec title="Open tables" right={<T w="600" color={C.muted}>{open.length}</T>}>
        {open.length === 0 && <T color={C.dim}>No open tables</T>}
        {open.map((t, i) => (
          <Row key={t.id} i={i}>
            <Pressable onPress={() => router.push(`/manager/table/${t.id}`)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <T w="700" size={16} style={{ width: 44 }}>{t.code}</T>
              <T size={13} color={C.muted} style={{ flex: 1 }}>{t.guests} guests · {t.items} dishes · {since(new Date(t.openedAt).getTime())}</T>
              {t.state === 'billing' && <T w="600" size={12} color={C.red}>Bill asked</T>}
              <T w="600">{rupees(t.amount)}</T>
            </Pressable>
          </Row>
        ))}
      </MSec>
      <MSec title="Paid">
        {bills.data.length === 0 && <T color={C.dim}>No bills yet</T>}
        {bills.data.slice(0, 20).map((b: any, i: number) => (
          <Row key={b.id} i={i}>
            <T w="700" size={16} style={{ width: 44 }}>{b.table}</T>
            <T size={13} color={C.muted} style={{ flex: 1 }}>{b.method.toUpperCase()} · {since(new Date(b.paidAt).getTime())} ago</T>
            {b.discount > 0 && <T size={12} color={C.amber}>−{rupees(b.discount)}</T>}
            <T w="600">{rupees(b.total)}</T>
          </Row>
        ))}
      </MSec>
    </MgrScreen>
  );
}
