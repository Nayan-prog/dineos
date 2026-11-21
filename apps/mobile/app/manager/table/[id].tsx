import { useRef, useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Print from 'expo-print';
import QRCode from 'react-native-qrcode-svg';
import { ITEM_LABEL, rupees, type ItemStatus } from '@dineos/shared';
import { api, auth } from '../../../lib/api';
import { Bill } from '../../../lib/bill';
import { Pressable } from '../../../lib/motion';
import { C, FONT, Loading, MgrDetail, MSec, Row, T, TSTATE } from '../../../lib/ui';

const ST: Record<string, string> = { served: C.green, ready: C.blue, cooking: C.amber, waiting: C.muted, cancelled: C.red };

/** Table detail (App-TableDetail): QR code, quick numbers, current order, Add items / Bill. */
export default function TableDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = auth.get()!.staff;
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ['table', id], queryFn: () => api(`/floor/tables/${id}`) });
  const [billOpen, setBillOpen] = useState(false);
  const qr = useRef<any>(null);
  if (error) return <MgrDetail title="Table"><T color={C.red}>{(error as Error).message}</T></MgrDetail>;
  if (!data) return <MgrDetail title="Table"><Loading /></MgrDetail>;
  const { table, session, items, totals } = data;
  const live = items.filter((i: any) => i.status !== 'cancelled');
  const served = live.filter((i: any) => i.status === 'served').length;
  const state = !session ? 'free' : session.status === 'billing' ? 'billing' : !live.length ? 'seated' : live.some((i: any) => i.status === 'ready') ? 'ready' : live.some((i: any) => i.status === 'waiting' || i.status === 'cooking') ? 'eating' : 'served';
  const [label, textColor] = TSTATE[state];
  const seated = session ? Math.max(0, Math.round((Date.now() - new Date(session.openedAt).getTime()) / 60000)) : 0;
  const canOrder = me.role !== 'admin';
  const money = totals && 'total' in totals;
  const turns = data.today;
  const kpis: [string, string, string][] = [
    ['Guests', String(session?.guestCount ?? 0), `/ ${table.seats} seats`],
    ['Seated for', String(seated), 'min'],
    ['Items served', String(served), `/ ${live.length}`],
    ['Turns today', String(turns?.turns ?? 0), turns && 'amount' in turns ? `· ${rupees(turns.amount)}` : ''],
  ];
  const share = () => Share.share({ message: `Table ${table.code} · ${table.qrUrl}` }).catch(() => {});
  const print = () => qr.current?.toDataURL(async (b64: string) => {
    try { await Print.printAsync({ html: `<div style="text-align:center;font-family:sans-serif;padding:40px"><h1>Table ${table.code}</h1><p>Scan to order</p><img width="320" height="320" src="data:image/png;base64,${b64}"/><p>${table.qrUrl}</p></div>` }); }
    catch (e) { Alert.alert((e as Error).message); }
  });
  const addItems = () => router.push({ pathname: '/waiter/take-order', params: { table: String(table.id) } });
  const footer = canOrder ? (
    <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: C.line }}>
      <Pressable onPress={addItems} haptic style={{ flex: 1, height: 50, borderRadius: 25, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' }}><T w="600">{session ? 'Add items' : 'Take order'}</T></Pressable>
      {session && money && <Pressable onPress={() => setBillOpen(true)} haptic style={{ flex: 1, height: 50, borderRadius: 25, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center' }}><T w="600" color="#fff">Bill · {rupees(totals.total)}</T></Pressable>}
    </View>
  ) : null;
  return (
    <MgrDetail title={`Table ${table.code}`} sub={`${table.area} · ${table.seats} seats${table.waiter ? ' · ' + table.waiter.split(' ')[0] : ''}`} right={<T w="600" size={12} color={textColor} style={{ marginRight: 4 }}>{label}</T>} footer={footer}>
      <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 14, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <View style={{ padding: 6, backgroundColor: '#fff', borderRadius: 12 }}>
          <QRCode value={table.qrUrl} size={112} backgroundColor="#ffffff" color="#0b0b0c" getRef={(c) => { qr.current = c; }} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <T w="700">Table QR code</T>
          <T size={12} color={C.dim}>Guests scan to order.</T>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
            {[['Share', share], ['Print', print]].map(([l, f]) => <Pressable key={l as string} onPress={f as () => void} style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: C.chip2, justifyContent: 'center' }}><T w="600" size={12.5}>{l as string}</T></Pressable>)}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {kpis.map(([l, v, of]) => (
          <View key={l} style={{ width: '47%', backgroundColor: C.card, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14 }}>
            <T size={12} color={C.muted}>{l}</T>
            <T style={{ marginTop: 0 }}><T w="700" size={19}>{v}</T>{of ? <T w="500" size={12} color={C.dim}> {of}</T> : null}</T>
          </View>
        ))}
      </View>

      <MSec title="Current order">
        {items.length === 0 && <T color={C.dim}>Nothing ordered yet</T>}
        {items.map((it: any, n: number) => (
          <Row key={it.id} i={n} style={{ minHeight: 50, opacity: it.status === 'cancelled' ? 0.45 : 1 }}>
            <T w="600" size={11} color={C.muted} style={{ minWidth: 44, textAlign: 'center' }}>{it.guestNo ? 'G' + it.guestNo : 'Shared'}</T>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T w="600" size={13.5}>{it.qty} × {it.name}</T>
              {[it.spice, ...(it.options ?? []), it.note].filter(Boolean).length > 0 && <T size={11.5} color="#f5c27a">{[it.spice, ...(it.options ?? []), it.note].filter(Boolean).join(' · ')}</T>}
            </View>
            <T w="600" size={12} color={ST[it.status]}>{ITEM_LABEL[it.status as ItemStatus]}</T>
          </Row>
        ))}
      </MSec>
      {billOpen && session && <Bill sessionId={session.id} onClose={() => setBillOpen(false)} onPaid={() => { setBillOpen(false); qc.invalidateQueries(); Alert.alert(`${table.code} paid · table is free`); router.back(); }} />}
    </MgrDetail>
  );
}
