import { Alert, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { TASK_LABEL, type TaskKind } from '@dineos/shared';
import { api } from '../../lib/api';
import { optimistic } from '../../lib/optimistic';
import { Btn, C, Dot, Loading, MgrDetail, Row, T, MSec } from '../../lib/ui';
import { tableRange, useWaiter } from '../../lib/waiter-ui';

const KIND: Record<TaskKind, string> = { food_ready: '#5eb88a', call: C.blue, bill: C.taupe };

/** Alerts (App-Waiter-Alerts): "On it" takes an alert, "Done" finishes it; unanswered alerts pass on to the area, then the manager. */
export default function WaiterAlerts() {
  const qc = useQueryClient();
  const { list } = useWaiter();
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api('/team/tasks'), refetchInterval: 10000 });
  const act = useMutation({ mutationFn: ([id, what]: [number, string]) => api(`/team/tasks/${id}/${what}`, { body: {} }), ...optimistic<[number, string]>(qc, ['tasks'], (old, [id, what]) => ({ ...old, tasks: old.tasks.map((t: any) => (t.id === id ? (what === 'take' ? { ...t, status: 'taken', mine: true } : { ...t, status: 'done' }) : t)) }), (e) => Alert.alert(e.message)) });
  const all: any[] = tasks.data?.tasks ?? [];
  const open = all.filter((t) => t.status === 'open');
  const mine = all.filter((t) => t.status === 'taken' && t.mine);
  const others = all.filter((t) => t.status === 'taken' && !t.mine);
  const rules = tasks.data?.rules;
  const origin = (t: any): [string, string] => t.level === 0 ? ['Your table', '#8b8b93'] : t.ownTable ? ['Your table · now with the whole area', C.amber] : [`Passed on from ${t.assignedName?.split(' ')[0] ?? 'nobody'}${t.level === 2 ? ' · manager alerted' : ' · no reply in time'}`, C.amber];
  return (
    <MgrDetail title="Alerts" sub={list.length ? `${tableRange(list.map((t) => t.code))} · ${list[0].area}` : undefined} back="/waiter" pad={20} gap={18}>
      {!tasks.data ? <Loading /> : <>
        <MSec title="Needs someone" right={<T w="600" color={C.muted}>{open.length}</T>}>
          {open.length === 0 && <T color={C.dim}>All clear</T>}
          {open.map((t, i) => { const [o, c] = origin(t); return (
            <Row key={t.id} i={i} style={{ paddingVertical: 0 }}>
              <Dot color={KIND[t.kind as TaskKind]} pulse />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T w="600"><T w="700">{t.table}</T> · {TASK_LABEL[t.kind as TaskKind]}</T>
                <T size={12} color={C.muted} numberOfLines={1}>{t.detail}</T>
                <T size={12} color={c}>{o}</T>
              </View>
              <Btn small label="On it" onPress={() => act.mutate([t.id, 'take'])} />
            </Row>
          ); })}
        </MSec>
        <MSec title="I'm handling" right={<T w="600" color={C.muted}>{mine.length}</T>}>
          {mine.map((t, i) => (
            <Row key={t.id} i={i} style={{ paddingVertical: 0 }}>
              <Dot color={KIND[t.kind as TaskKind]} />
              <T w="600" style={{ flex: 1 }}><T w="700">{t.table}</T> · {TASK_LABEL[t.kind as TaskKind]}</T>
              {t.kind === 'bill' ? <Btn small kind="ghost" label="Open bill" onPress={() => router.push({ pathname: '/waiter/bill', params: { table: String(t.tableId) } })} /> : <Btn small kind="ghost" haptic label="Done" onPress={() => act.mutate([t.id, 'done'])} />}
            </Row>
          ))}
          {others.map((t) => <T key={t.id} size={13} color={C.dim} style={{ paddingTop: 12, paddingLeft: 20 }}>{t.table} · {TASK_LABEL[t.kind as TaskKind]} · {t.takenName?.split(' ')[0]} is on it</T>)}
        </MSec>
        {rules && <T size={12} color={C.dim}>Not taken in {rules.areaSecs} s → all free waiters in the area. Not taken in {rules.managerSecs} s → manager.</T>}
      </>}
    </MgrDetail>
  );
}
