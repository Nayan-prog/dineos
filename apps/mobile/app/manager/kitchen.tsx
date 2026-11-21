import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Pressable } from '../../lib/motion';
import { C, Loading, MgrScreen, MSec, Row, T, UnderTabs } from '../../lib/ui';

const mins = (d: string | null) => (d ? Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000)) : 0);

/** Kitchen Display (web "Kitchen Display"): every station's shared queue, read only apart from releasing a stuck dish. */
export default function KitchenDisplay() {
  const qc = useQueryClient();
  const stations = useQuery({ queryKey: ['stations'], queryFn: () => api('/kitchen/stations') });
  const [sid, setSid] = useState<number | null>(null);
  const current: number | undefined = sid ?? stations.data?.[0]?.id;
  const q = useQuery({ queryKey: ['queue', current], queryFn: () => api(`/kitchen/queue?station=${current}`), enabled: !!current });
  const release = useMutation({ mutationFn: (id: number) => api(`/kitchen/items/${id}/release`, { body: {} }), onSuccess: () => qc.invalidateQueries(), onError: (e) => Alert.alert((e as Error).message) });
  const list = (items: any[], right?: (i: any) => React.ReactNode) => items.map((i, n) => {
    const late = i.status !== 'ready' && mins(i.createdAt) > i.prepMinutes;
    return (
      <Row key={i.id} i={n}>
        <View style={{ width: 52 }}><T w="700" size={16}>{i.table}</T><T size={12} color={late ? C.amber : C.dim}>{mins(i.status === 'cooking' ? i.claimedAt : i.status === 'ready' ? i.readyAt : i.createdAt)} min</T></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T w="600">{i.qty} × {i.name}</T>
          <T size={12} color={C.dim}>{i.guestNo ? 'G' + i.guestNo : 'Shared'}{i.chef && i.status !== 'waiting' ? ' · ' + i.chef.split(' ')[0] : ''}{i.waiter && i.status === 'ready' ? ' · ' + i.waiter.split(' ')[0] + ' alerted' : ''}</T>
          {[i.spice, ...(i.options ?? []), i.note].filter(Boolean).length > 0 && <T size={12} color={C.taupe}>{[i.spice, ...(i.options ?? []), i.note].filter(Boolean).join(' · ')}</T>}
          {i.remake && <T w="700" size={12} color={C.red}>Remake</T>}
        </View>
        {right?.(i)}
      </Row>
    );
  });
  return (
    <MgrScreen header={false} back gap={14}>
      <View><T w="700" size={26} style={{ letterSpacing: -0.3 }}>Kitchen Display</T><T size={13} color={C.muted} style={{ marginTop: 2 }}>Shared station queues · urgent and oldest first</T></View>
      {stations.data && <UnderTabs items={stations.data.map((x: any) => [String(x.id), x.name] as [string, string])} value={String(current)} onChange={(k) => setSid(Number(k))} />}
      {!q.data ? <Loading /> : <>
        <T size={12.5} color={C.dim}>{q.data.chefs.map((x: any) => `${x.name.split(' ')[0]} ${x.onBreak ? 'on break' : `${x.cooking}/${x.maxParallel} cooking`}`).join(' · ')}</T>
        <MSec title="Waiting" right={<T w="600" color={C.muted}>{q.data.waiting.length}</T>}>{list(q.data.waiting)}{q.data.waiting.length === 0 && <T color={C.dim}>Queue is clear</T>}</MSec>
        <MSec title="Cooking" right={<T w="600" color={C.muted}>{q.data.cooking.length}</T>}>{list(q.data.cooking, (i) => <Pressable onPress={() => release.mutate(i.id)} hitSlop={8}><T w="600" size={13} color={C.blue}>Release</T></Pressable>)}</MSec>
        <MSec title="At the pass" right={<T w="600" color={C.muted}>{q.data.ready.length}</T>}>{list(q.data.ready)}</MSec>
      </>}
    </MgrScreen>
  );
}
