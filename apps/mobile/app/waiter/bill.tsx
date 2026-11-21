import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rupees } from '@dineos/shared';
import { api } from '../../lib/api';
import { Pressable } from '../../lib/motion';
import { C, Loading, MgrDetail, MSec, T } from '../../lib/ui';

const METHODS: ['cash' | 'upi' | 'card', string][] = [['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card']];
const SPLITS = [1, 2, 3, 6];

/** Bill (App-Bill): lines, GST, total, split guide, payment method, "Collect … by …" closes the table. */
export default function BillScreen() {
  const { table: tableId } = useLocalSearchParams<{ table: string }>();
  const qc = useQueryClient();
  const t = useQuery({ queryKey: ['table', tableId], queryFn: () => api(`/floor/tables/${tableId}`) });
  const sessionId: number | undefined = t.data?.session?.id;
  const bill = useQuery({ queryKey: ['bill', sessionId], queryFn: () => api(`/floor/sessions/${sessionId}/bill`), enabled: !!sessionId });
  const [method, setMethod] = useState<'cash' | 'upi' | 'card'>('upi');
  const [split, setSplit] = useState(1);
  const pay = useMutation({
    mutationFn: () => api(`/floor/sessions/${sessionId}/pay`, { body: { method } }),
    onSuccess: () => { qc.invalidateQueries(); Alert.alert(`${t.data.table.code} paid · table is free`); router.replace('/waiter/tables'); },
    onError: (e) => Alert.alert((e as Error).message),
  });
  if (!t.data || (sessionId && !bill.data)) return <MgrDetail title="Bill" back="/waiter/tables"><Loading /></MgrDetail>;
  if (!sessionId) return <MgrDetail title={`Bill · Table ${t.data.table.code}`} back="/waiter/tables"><T color={C.dim}>This table has no open order.</T></MgrDetail>;
  const b = bill.data;
  const each = Math.ceil(b.total / split);
  const choice = (on: boolean) => ({ flex: 1, height: 42, borderRadius: 12, backgroundColor: on ? C.text : C.chip, alignItems: 'center', justifyContent: 'center' } as const);
  const row = (l: string, v: string, big?: boolean) => <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: big ? 4 : 0 }}><T size={big ? 20 : 13.5} w={big ? '700' : '400'} color={big ? C.text : C.muted}>{l}</T><T size={big ? 20 : 13.5} w={big ? '700' : '400'} color={big ? C.text : C.muted}>{v}</T></View>;
  return (
    <MgrDetail title={`Bill · Table ${t.data.table.code}`} sub={`${t.data.session.guestCount} guests`} back={`/waiter/table/${tableId}`} gap={18}
      footer={<View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, borderTopWidth: 1, borderTopColor: C.line }}>
        <Pressable haptic disabled={pay.isPending} onPress={() => pay.mutate()} style={{ height: 52, borderRadius: 26, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center', opacity: pay.isPending ? 0.6 : 1 }}>
          <T w="600" size={15} color="#fff">{pay.isPending ? 'Closing…' : `Collect ${rupees(b.total)} by ${METHODS.find((m) => m[0] === method)![1]}`}</T>
        </Pressable>
      </View>}>
      <View style={{ backgroundColor: C.card, borderRadius: 18, paddingVertical: 6, paddingHorizontal: 16 }}>
        {b.lines.map((l: any, i: number) => (
          <View key={l.name + l.unitPrice} style={{ flexDirection: 'row', gap: 10, minHeight: 40, alignItems: 'center', borderBottomWidth: i === b.lines.length - 1 ? 0 : 1, borderBottomColor: C.line }}>
            <T color={C.muted} style={{ width: 26 }}>{l.qty}×</T><T style={{ flex: 1 }}>{l.name}</T><T>{rupees(l.qty * l.unitPrice)}</T>
          </View>
        ))}
      </View>
      <View style={{ gap: 6, paddingHorizontal: 4 }}>
        {row('Subtotal', rupees(b.subtotal))}
        {row(`GST ${b.taxPercent}% (CGST + SGST)`, rupees(b.tax))}
        {row('Total', rupees(b.total), true)}
      </View>
      <MSec title="Split">
        <View style={{ flexDirection: 'row', gap: 8 }}>{SPLITS.map((n) => <Pressable key={n} onPress={() => setSplit(n)} style={choice(split === n)}><T w="600" color={split === n ? C.bg : C.muted}>{n === 1 ? 'One bill' : `${n} ways`}</T></Pressable>)}</View>
        <T size={12.5} color={C.dim} style={{ marginTop: 8 }}>{split === 1 ? 'Whole table pays together' : `${split} guests pay ${rupees(each)} each`}</T>
      </MSec>
      <MSec title="Payment">
        <View style={{ flexDirection: 'row', gap: 8 }}>{METHODS.map(([k, l]) => <Pressable key={k} onPress={() => setMethod(k)} style={choice(method === k)}><T w="600" color={method === k ? C.bg : C.muted}>{l}</T></Pressable>)}</View>
      </MSec>
    </MgrDetail>
  );
}
