import { useState } from 'react';
import { Alert } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { rupees } from '@dineos/shared';
import { api } from './api';
import { Btn, Loading, Pills, Row, Sheet, T, C } from './ui';

/** Bill sheet: lines, tax, total, payment method, "Payment received" closes the table. */
export function Bill({ sessionId, onClose, onPaid }: { sessionId: number; onClose: () => void; onPaid: () => void }) {
  const { data } = useQuery({ queryKey: ['bill', sessionId], queryFn: () => api(`/floor/sessions/${sessionId}/bill`) });
  const [method, setMethod] = useState<'upi' | 'cash' | 'card'>('upi');
  const pay = useMutation({ mutationFn: () => api(`/floor/sessions/${sessionId}/pay`, { body: { method } }), onSuccess: onPaid, onError: (e) => Alert.alert((e as Error).message) });
  return (
    <Sheet visible title="Bill" onClose={onClose}>
      {!data ? <Loading /> : <>
        {data.lines.map((l: any) => <Row key={l.name + l.unitPrice}><T style={{ flex: 1 }}>{l.qty} × {l.name}</T><T>{rupees(l.qty * l.unitPrice)}</T></Row>)}
        <Row><T color={C.muted} style={{ flex: 1 }}>Tax {data.taxPercent}%</T><T>{rupees(data.tax)}</T></Row>
        <Row><T w="700" size={18} style={{ flex: 1 }}>Total</T><T w="700" size={22}>{rupees(data.total)}</T></Row>
        <Pills items={[['upi', 'UPI'], ['cash', 'Cash'], ['card', 'Card']]} value={method} onChange={setMethod} />
        <Btn label={pay.isPending ? 'Closing…' : 'Payment received · close table'} disabled={pay.isPending} onPress={() => pay.mutate()} />
      </>}
    </Sheet>
  );
}
