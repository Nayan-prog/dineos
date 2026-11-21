import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Pressable } from '../../lib/motion';
import { C, Loading, MgrDetail, MSec, Row, T, UnderTabs } from '../../lib/ui';

/** "T1 to T7" for a run of codes, otherwise a comma list */
function range(codes: string[]) {
  if (!codes.length) return 'No tables';
  const m = codes.map((c) => c.match(/^([A-Za-z]*)(\d+)$/));
  if (codes.length > 1 && m.every(Boolean) && m.every((x) => x![1] === m[0]![1])) {
    const n = m.map((x) => Number(x![2])).sort((a, b) => a - b);
    if (n.every((v, i) => i === 0 || v === n[i - 1] + 1)) return `${m[0]![1]}${n[0]} to ${m[0]![1]}${n[n.length - 1]}`;
  }
  return codes.join(', ');
}

/** Shifts & Sections (App-Shifts): chefs' parallel limit and breaks per station, waiters' sections, alert rules. */
export default function Shifts() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'kitchen' | 'floor'>('kitchen');
  const staff = useQuery({ queryKey: ['staff'], queryFn: () => api('/team/staff') });
  const dash = useQuery({ queryKey: ['dashboard', 1], queryFn: () => api('/manage/dashboard?days=1') });
  const patch = useMutation({
    mutationFn: ([id, body]: [number, object]) => api(`/team/staff/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries(), onError: (e) => Alert.alert((e as Error).message),
  });
  const rule = useMutation({
    mutationFn: (body: object) => api('/team/restaurant', { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries(), onError: (e) => Alert.alert((e as Error).message),
  });
  const head = { title: 'Shifts & Sections', sub: 'Tonight · 6:00 PM to 11:30 PM', nav: 'team' as const, back: '/manager/team', pad: 20, gap: 8 };
  if (!staff.data) return <MgrDetail {...head}><Loading /></MgrDetail>;
  const all: any[] = staff.data.staff;
  const chefs = all.filter((p) => p.role === 'chef');
  const waiters = all.filter((p) => p.role === 'waiter');
  const rules = staff.data.rules;
  const step = (label: string, onMinus: () => void, onPlus: () => void, value: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {[['−', onMinus, 'Less'], [null, null, ''], ['+', onPlus, 'More']].map(([sym, f, a], i) => sym === null
        ? <T key={i} w="700" style={{ minWidth: 44, textAlign: 'center' }}>{value}</T>
        : <Pressable key={i} accessibilityLabel={`${a} ${label}`} onPress={f as () => void} style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}><T size={16}>{sym as string}</T></Pressable>)}
    </View>
  );
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const setRule = (key: 'alertAreaSecs' | 'alertManagerSecs', v: number) => rule.mutate({ alertAreaSecs: key === 'alertAreaSecs' ? clamp(v, 30, 300) : rules.areaSecs, alertManagerSecs: key === 'alertManagerSecs' ? clamp(v, 30, 300) : rules.managerSecs });
  return (
    <MgrDetail {...head}>
      <UnderTabs h={44} gap={22} size={14.5} items={[['kitchen', 'Kitchen', `${chefs.length} chefs`], ['floor', 'Floor', `${waiters.length} waiters`]]} value={tab} onChange={setTab} />
      {tab === 'kitchen' && staff.data.stations.map((st: any, si: number) => {
        const here = chefs.filter((c) => c.stationId === st.id);
        const waiting = dash.data?.stations?.find((x: any) => x.id === st.id)?.waiting ?? 0;
        return (
          <View key={st.id} style={{ paddingTop: si ? 14 : 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingTop: 10, paddingBottom: 2 }}><T w="700">{st.name}</T><T size={12.5} color={C.dim}>{waiting} waiting</T></View>
            {here.length === 0 && <T size={12.5} color={C.dim} style={{ paddingVertical: 10 }}>No chefs on this station</T>}
            {here.map((c, i) => (
              <Row key={c.id} i={i} style={{ paddingVertical: 0 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T w="600">{c.name}</T>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <T size={12} color={c.onBreak || c.cooking >= c.maxParallel ? C.amber : C.muted}>{c.onBreak ? 'On break' : `${c.cooking} of ${c.maxParallel} cooking`}</T>
                    <Pressable onPress={() => patch.mutate([c.id, { onBreak: !c.onBreak }])} hitSlop={8}><T w="600" size={12} color={C.blue}>{c.onBreak ? 'Back on duty' : 'Send on break'}</T></Pressable>
                  </View>
                </View>
                {step('limit', () => patch.mutate([c.id, { maxParallel: clamp(c.maxParallel - 1, 1, 8) }]), () => patch.mutate([c.id, { maxParallel: clamp(c.maxParallel + 1, 1, 8) }]), String(c.maxParallel))}
              </Row>
            ))}
          </View>
        );
      })}
      {tab === 'floor' && (
        <>
          <View>
            {waiters.map((w, i) => (
              <Row key={w.id} i={i} style={{ paddingVertical: 0 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T w="600">{w.name} <T w="500" color={C.dim}>· {staff.data.areas.find((a: any) => a.id === w.areaId)?.name ?? 'No area'}</T></T>
                  <T size={12} color={w.onBreak ? C.amber : C.green}>{w.onBreak ? 'On break' : w.onDuty ? 'On duty' : 'Off'}</T>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T w="600">{range(w.tables.map((x: any) => x.code))}</T>
                  <Pressable onPress={() => patch.mutate([w.id, { onBreak: !w.onBreak }])} hitSlop={8}><T w="600" size={12} color={C.blue}>{w.onBreak ? 'Back on duty' : 'Send on break'}</T></Pressable>
                </View>
              </Row>
            ))}
          </View>
          <MSec title="Alert rules">
            {[['Pass to free waiters in the area after', 'alertAreaSecs', rules.areaSecs], ['Pass to the manager after', 'alertManagerSecs', rules.managerSecs]].map(([label, key, val]) => (
              <Row key={key as string} style={{ paddingVertical: 0, minHeight: 52, justifyContent: 'space-between' }}>
                <T size={13} color={C.muted} style={{ flex: 1 }}>{label as string}</T>
                {step(label as string, () => setRule(key as any, (val as number) - 15), () => setRule(key as any, (val as number) + 15), `${val} s`)}
              </Row>
            ))}
          </MSec>
        </>
      )}
    </MgrDetail>
  );
}
