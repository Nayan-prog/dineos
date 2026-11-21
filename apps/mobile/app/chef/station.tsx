import { Alert, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ChefNav, minsSince, useChef, useQueueActions } from '../../lib/chef-ui';
import { Pressable } from '../../lib/motion';
import { C, Loading, MgrDetail, MSec, Row, T } from '../../lib/ui';

/** Station queue (App-Station-Queue): everyone's capacity, what is cooking, what is waiting. Start / Start all / Ready. */
export default function StationQueue() {
  const qc = useQueryClient();
  const c = useChef();
  const act = useMutation({ mutationFn: (fn: () => Promise<any>) => fn(), onSettled: () => qc.invalidateQueries(), onError: (e) => Alert.alert((e as Error).message) });
  const qa = useQueueActions();
  const d = c.d;
  if (!d) return <MgrDetail title="Station queue" back="/chef" bottom={<ChefNav active="queue" />}><Loading /></MgrDetail>;
  const start = (ids: number[]) => qa.claim(ids);
  const ready = (id: number) => qa.ready([id]);
  const waiting: any[] = d.waiting;
  const flag = (i: any): [string, string] => i.remake ? ['Remake', C.red] : minsSince(i.createdAt) > i.prepMinutes * 0.7 ? ['Late soon', C.amber] : ['', C.dim];
  // the same dish waiting at two or more tables can be started together
  const by = new Map<string, any[]>();
  for (const i of waiting) by.set(i.name, [...(by.get(i.name) ?? []), i]);
  const batches = [...by.entries()].filter(([, l]) => new Set(l.map((x) => x.tableId)).size > 1);
  return (
    <MgrDetail title={`${d.station.name} station`} sub={`Shared queue · ${d.chefs.length} chef${d.chefs.length === 1 ? '' : 's'}`} back="/chef" pad={20} gap={18} bottom={<ChefNav active="queue" />}>
      <View style={{ flexDirection: 'row' }}>
        {d.chefs.map((x: any, i: number) => (
          <View key={x.id} style={{ flex: 1, minWidth: 0, paddingLeft: i ? 28 : 0, borderLeftWidth: i ? 1 : 0, borderLeftColor: C.chip2 }}>
            <T w="600" size={13} numberOfLines={1}>{x.id === c.me.id ? 'You' : x.name.split(' ')[0]}</T>
            <View style={{ flexDirection: 'row', gap: 3, marginTop: 6 }}>{Array.from({ length: x.maxParallel }, (_, k) => <View key={k} style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: k < x.cooking ? C.amber : C.border }} />)}</View>
            {x.onBreak && <T size={11.5} color={C.amber}>On break</T>}
          </View>
        ))}
      </View>
      {c.full && <T size={12.5} color="#f5c27a">You are cooking {c.limit} dishes. Finish one to take the next.</T>}

      <MSec title="Cooking" right={<T w="600" color={C.muted}>{d.cooking.length}</T>}>
        {d.cooking.length === 0 && <T color={C.dim}>Nothing on the fire</T>}
        {d.cooking.map((i: any, n: number) => { const mine = i.claimedBy === c.me.id; const m = minsSince(i.claimedAt ?? i.createdAt); const late = m > i.prepMinutes; return (
          <Row key={i.id} i={n}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T w="600"><T w="700">{i.table}</T> · {i.qty} × {i.name}</T>
              <View style={{ flexDirection: 'row', gap: 8 }}><T w="600" size={12} color={mine ? C.blue : C.muted}>{mine ? 'You' : i.chef?.split(' ')[0]}</T><T size={12} color={late ? C.amber : C.dim}>{m} / {i.prepMinutes} min</T></View>
            </View>
            {mine && <Pressable haptic onPress={() => ready(i.id)} style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: C.blue2, justifyContent: 'center' }}><T w="600" size={13} color="#fff">Ready</T></Pressable>}
          </Row>
        ); })}
      </MSec>

      {batches.length > 0 && (
        <MSec title="Start together">
          {batches.map(([name, l]) => { const fits = !c.onBreak && c.mine + l.length <= c.limit; return (
            <Row key={name}>
              <View style={{ flex: 1, minWidth: 0 }}><T w="600">{l.reduce((a, x) => a + x.qty, 0)} × {name}</T><T size={12} color={C.dim}>{l.map((x) => x.table).join(', ')}</T></View>
              {fits ? <Pressable haptic onPress={() => start(l.map((x) => x.id))} style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: C.text, justifyContent: 'center' }}><T w="600" size={13} color={C.bg}>Start all</T></Pressable> : <T size={12} color={C.dim}>At limit</T>}
            </Row>
          ); })}
        </MSec>
      )}

      <MSec title="Waiting" right={<T w="600" color={C.muted}>{waiting.length}</T>}>
        {waiting.length === 0 && <T color={C.dim}>Queue is clear</T>}
        {waiting.map((i, n) => { const [f, fc] = flag(i); const age = minsSince(i.createdAt); const note = [i.spice, ...(i.options ?? []), i.note].filter(Boolean).join(' · '); const blocked = c.onBreak || c.full; return (
          <Row key={i.id} i={n}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T w="600"><T w="700">{i.table}</T> · {i.qty} × {i.name}</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <T size={12} color={f ? fc : C.dim}>{age} min</T>
                {f ? <T w="700" size={12} color={fc}>{f}</T> : null}
                {note ? <T size={12} color={C.taupe} numberOfLines={1} style={{ flex: 1 }}>{note}</T> : null}
              </View>
            </View>
            {blocked ? <T size={12} color={C.dim}>{c.onBreak ? 'On break' : 'At limit'}</T> : <Pressable haptic onPress={() => start([i.id])} style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: C.text, justifyContent: 'center' }}><T w="600" size={13} color={C.bg}>Start</T></Pressable>}
          </Row>
        ); })}
      </MSec>
    </MgrDetail>
  );
}
