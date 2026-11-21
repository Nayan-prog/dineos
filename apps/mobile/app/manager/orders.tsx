import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ITEM_LABEL, rupees, type ItemStatus } from '@dineos/shared';
import { api } from '../../lib/api';
import { Pressable } from '../../lib/motion';
import { since } from '../../lib/notify';
import { C, Chip, Dot, Input, Loading, MgrScreen, Row, STATUS, T } from '../../lib/ui';
import { router } from 'expo-router';

type Tab = 'all' | ItemStatus;
const TABS: [Tab, string][] = [['all', 'All'], ['waiting', 'Placed'], ['cooking', 'Cooking'], ['ready', 'Ready'], ['served', 'Served'], ['cancelled', 'Cancelled']];

/** Orders (web "Orders"): every dish on the floor, filter by status, search, cancel a dish in progress. */
export default function Orders() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const { data } = useQuery({ queryKey: ['orders'], queryFn: () => api('/floor/orders') });
  const cancel = useMutation({ mutationFn: (id: number) => api(`/floor/items/${id}/cancel`, { body: { reason: 'Voided by manager' } }), onSuccess: () => qc.invalidateQueries(), onError: (e) => Alert.alert((e as Error).message) });
  const head = (n: string) => <View><T w="700" size={26} style={{ letterSpacing: -0.3 }}>Orders</T><T size={13} color={C.muted} style={{ marginTop: 2 }}>{n}</T></View>;
  if (!data) return <MgrScreen header={false} back gap={14}>{head(' ')}<Loading /></MgrScreen>;
  const all: any[] = data;
  const list = all.filter((x) => (tab === 'all' || x.status === tab) && (!q || `${x.table} ${x.name} ${x.station}`.toLowerCase().includes(q.toLowerCase())));
  const count = (k: Tab) => (k === 'all' ? all.length : all.filter((x) => x.status === k).length);
  return (
    <MgrScreen header={false} back gap={14}>
      {head(`${all.filter((x) => x.status === 'waiting' || x.status === 'cooking').length} dishes in progress`)}
      <Input value={q} onChangeText={setQ} placeholder="Search table or dish" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        {TABS.map(([k, l]) => <Chip key={k} label={`${l} ${count(k)}`} on={tab === k} onPress={() => setTab(k)} />)}
      </ScrollView>
      <View>
        {list.length === 0 && <T color={C.dim}>Nothing here</T>}
        {list.map((x, i) => (
          <Row key={x.id} i={i}>
            <Pressable onPress={() => router.push(`/manager/table/${x.tableId}`)} style={{ width: 44 }}><T w="700" size={16}>{x.table}</T></Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T w="600">{x.qty} × {x.name}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Dot color={STATUS[x.status]} /><T size={12} color={STATUS[x.status]}>{ITEM_LABEL[x.status as ItemStatus]}</T><T size={12} color={C.dim}>· {x.station}{x.chef ? ' · ' + x.chef.split(' ')[0] : ''} · {since(new Date(x.createdAt).getTime())}</T></View>
              {(x.note || x.spice) && <T size={12} color={C.taupe}>{[x.spice, x.note].filter(Boolean).join(' · ')}</T>}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {'unitPrice' in x && <T w="600" size={13}>{rupees(x.unitPrice * x.qty)}</T>}
              {(x.status === 'waiting' || x.status === 'cooking') && <Pressable onPress={() => Alert.alert(`Cancel ${x.qty} × ${x.name} for ${x.table}?`, '', [{ text: 'Keep' }, { text: 'Cancel dish', style: 'destructive', onPress: () => cancel.mutate(x.id) }])} hitSlop={8}><T w="600" size={12.5} color={C.red}>Cancel</T></Pressable>}
            </View>
          </Row>
        ))}
      </View>
    </MgrScreen>
  );
}
