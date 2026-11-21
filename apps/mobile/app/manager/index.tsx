import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Animated from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { rupees } from '@dineos/shared';
import { api, auth } from '../../lib/api';
import { ICON, Icon } from '../../lib/icons';
import { CountUp, Pressable, rise } from '../../lib/motion';
import { C, FONT, Loading, MgrScreen, MSec, T, UnderTabs } from '../../lib/ui';

const KIND_COLOR: Record<string, string> = { Delay: C.amber, Stock: C.red, Load: C.blue, Alert: C.red };
const STAGES: [string, string, string][] = [['waiting', 'Placed', '#8b8b93'], ['cooking', 'Cooking', C.amber], ['ready', 'Ready', C.blue], ['served', 'Served', C.green], ['billed', 'Billed', C.blue2]];
const kv = { color: C.text, fontSize: 22, fontFamily: FONT['700'], letterSpacing: -0.3, marginTop: 4 } as const;
const up = (n: number) => (n > 0 ? '+' : '') + n;

/** Owner / manager / admin dashboard (App-Dashboard, App-Admin-Dashboard). Admin never receives money fields. */
export default function Dashboard() {
  const me = auth.get()!.staff;
  const [days, setDays] = useState<1 | 7 | 28>(1);
  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState<'overview' | 'queues'>(params.section === 'queues' ? 'queues' : 'overview');
  useEffect(() => { setSection(params.section === 'queues' ? 'queues' : 'overview'); }, [params.section]);
  const [allChefs, setAllChefs] = useState(false);
  const d = useQuery({ queryKey: ['dashboard', days], queryFn: () => api(`/manage/dashboard?days=${days}`) });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api('/team/tasks') });
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const weekday = new Date().toLocaleDateString('en-IN', { weekday: 'short' });
  const head = (
    <View>
      <T size={13} color={C.muted}>{today}{me.role === 'admin' ? ' · Admin view' : ''}</T>
    </View>
  );
  const tabs = <UnderTabs items={[['overview', 'Overview'], ['queues', 'Station queues']]} value={section} onChange={setSection} />;
  if (!d.data) return <MgrScreen active="dash">{head}{tabs}<Loading /></MgrScreen>;

  const k = d.data.kpis;
  const money = 'revenue' in k;
  const prepDelta = k.avgPrepMinutes - k.targetPrepMinutes;
  const kpis: { label: string; value: React.ReactNode; delta?: string; deltaColor?: string; note: string }[] = [
    money
      ? { label: 'Revenue', value: <CountUp value={k.revenue} format={rupees} style={kv} />, delta: k.revenueChangePct == null ? undefined : `${up(k.revenueChangePct)}%`, deltaColor: (k.revenueChangePct ?? 0) >= 0 ? C.green : C.amber, note: days === 1 ? `vs last ${weekday}` : `vs prev ${days} days` }
      : { label: 'Guests now', value: <CountUp value={k.guests} style={kv} />, note: `of ${k.seats} seats` },
    { label: 'Orders', value: <CountUp value={k.orders} style={kv} />, delta: up(k.orders - k.prevOrders), deltaColor: k.orders - k.prevOrders >= 0 ? C.green : C.amber, note: `${k.openOrders} open` },
    { label: 'Avg prep', value: <CountUp value={k.avgPrepMinutes} format={(n) => n + ' min'} style={kv} />, delta: k.targetPrepMinutes ? up(prepDelta) + 'm' : undefined, deltaColor: prepDelta > 0 ? C.amber : C.green, note: `Target ${k.targetPrepMinutes}m` },
    { label: 'Occupancy', value: <CountUp value={k.tables ? Math.round((k.occupied / k.tables) * 100) : 0} format={(n) => n + '%'} style={kv} />, delta: `${k.occupied}/${k.tables}`, deltaColor: C.blue, note: 'tables' },
  ];
  const p = d.data.pipeline ?? {};
  const stages = STAGES.map(([key, label, color]) => ({ key, label, color, n: (p[key] ?? 0) as number }));
  const total = stages.reduce((a, x) => a + x.n, 0);
  const completed = p.billed ?? 0;
  const unanswered = (tasks.data?.tasks ?? []).filter((x: any) => x.status === 'open' && x.level >= 1).map((x: any) => ({ kind: 'Alert', text: `${x.table} · ${x.detail || 'nobody took this alert'}` }));
  const attention: { kind: string; text: string }[] = [...unanswered, ...(d.data.attention ?? [])];
  const chefs = allChefs ? d.data.chefs : d.data.chefs.slice(0, 5);
  const queue = (stationId: number) => d.data.queues.find((q: any) => q.stationId === stationId)?.n ?? 0;

  if (section === 'queues') return <MgrScreen active="dash">{head}{tabs}<StationQueues stations={d.data.stations ?? []} /></MgrScreen>;
  return (
    <MgrScreen active="dash">
      <View>
        {head}
        <View style={{ marginTop: 12 }}>{tabs}</View>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
          {([[1, 'Today'], [7, '7 days'], [28, '28 days']] as [1 | 7 | 28, string][]).map(([n, l]) => <Pressable key={n} onPress={() => setDays(n)} hitSlop={8}><T w={days === n ? '700' : '500'} size={14.5} color={days === n ? C.blue : C.muted}>{l}</T></Pressable>)}
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 20, columnGap: 16 }}>
        {kpis.map((x, i) => (
          <Animated.View key={x.label} entering={rise(i)} style={{ width: '47%' }}>
            <T size={12.5} color={C.muted}>{x.label}</T>
            {x.value}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              {x.delta ? <T w="600" size={11.5} color={x.deltaColor}>{x.delta}</T> : null}
              <T size={11.5} color={C.dim}>{x.note}</T>
            </View>
          </Animated.View>
        ))}
      </View>

      <MSec title="Order pipeline">
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <T w="600">{completed} of {total} completed</T>
            <T w="700" size={20} color={C.blue}>{total ? Math.round((completed / total) * 100) : 0}%</T>
          </View>
          <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, backgroundColor: C.chip2 }}>
            {stages.map((x) => x.n > 0 && <View key={x.key} style={{ flex: x.n, backgroundColor: x.color }} />)}
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {stages.map((x) => (
              <View key={x.key} style={{ flex: 1, alignItems: 'center' }}>
                <CountUp value={x.n} style={{ color: C.text, fontSize: 16, fontFamily: FONT['700'] }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: x.color }} /><T size={11} color={C.dim}>{x.label}</T></View>
              </View>
            ))}
          </View>
        </View>
      </MSec>

      <MSec title="Kitchen" right={<Pressable onPress={() => setSection('queues')} hitSlop={8}><T w="600" size={13} color={C.blue}>Queue</T></Pressable>}>
        <View>
          {chefs.map((c: any, i: number) => (
            <Animated.View key={c.id} entering={rise(i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: i === chefs.length - 1 ? 0 : 1, borderBottomColor: C.line }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.chip2, alignItems: 'center', justifyContent: 'center' }}><T w="600" size={13}>{c.name[0]}</T></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}><T w="600" size={13.5}>{c.name}</T><T size={12} color={C.dim}>{c.onBreak ? 'On break' : c.station}</T></View>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: C.chip2, marginTop: 6 }}><View style={{ height: 4, borderRadius: 2, width: `${Math.min(100, c.load)}%`, backgroundColor: c.load >= 85 ? C.amber : C.blue2 }} /></View>
              </View>
              <View style={{ width: 56, alignItems: 'flex-end' }}><T w="700">{c.done}</T><T size={11} color={C.dim}>{queue(c.stationId)} in queue</T></View>
            </Animated.View>
          ))}
          {d.data.chefs.length > 5 && <Pressable onPress={() => setAllChefs(!allChefs)} hitSlop={8} style={{ marginTop: 8 }}><T color={C.blue} w="600" size={13.5}>{allChefs ? 'Show less' : 'See all'}</T></Pressable>}
        </View>
      </MSec>

      <MSec title="Dish Progress">
        <View style={{ gap: 13 }}>
          {d.data.dishes.length === 0 && <T color={C.dim}>No dishes ordered yet</T>}
          {d.data.dishes.slice(0, 5).map((x: any, i: number) => (
            <Animated.View key={x.name} entering={rise(i)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 10, height: 10, borderWidth: 1.5, borderColor: x.veg ? C.green : C.red, borderRadius: 2 }} />
                <T w="600" size={13.5}>{x.name}</T>
                <View style={{ flex: 1 }} />
                <T w="600" size={13}>{x.done ?? 0}<T w="500" size={13} color={C.dim}> / {x.total}</T></T>
              </View>
              <View style={{ flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: C.chip2, marginTop: 7 }}>
                <View style={{ backgroundColor: C.blue2, width: `${((x.done ?? 0) / x.total) * 100}%` }} />
                <View style={{ backgroundColor: C.amber, width: `${(x.cooking / x.total) * 100}%` }} />
              </View>
            </Animated.View>
          ))}
        </View>
      </MSec>

      <MSec title="Needs attention">
        <View style={{ backgroundColor: C.card, borderRadius: 18, paddingVertical: 4, paddingHorizontal: 16 }}>
          {attention.length === 0 && <View style={{ minHeight: 48, justifyContent: 'center' }}><T size={13} color={C.dim}>All clear</T></View>}
          {attention.map((a, i) => (
            <Pressable key={i} onPress={() => router.replace('/manager/notifications')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderBottomWidth: i === attention.length - 1 ? 0 : 1, borderBottomColor: C.line }}>
              <T w="600" size={11.5} color={KIND_COLOR[a.kind] ?? C.muted}>{a.kind}</T>
              <T size={13} style={{ flex: 1 }} numberOfLines={1}>{a.text}</T>
              <Icon d={ICON.chev} size={16} color={C.dim} />
            </Pressable>
          ))}
        </View>
      </MSec>
    </MgrScreen>
  );
}

/** Station queues (kept from the earlier view): waiting / cooking / at the pass per station, oldest and late, next dishes. */
function StationQueues({ stations }: { stations: any[] }) {
  const n = { color: C.muted, fontSize: 13.5, fontFamily: FONT['400'] } as const;
  return (
    <View>
      {stations.map((st, idx) => (
        <Animated.View key={st.id} entering={rise(idx)} style={{ paddingVertical: 12, borderTopWidth: idx ? 1 : 0, borderTopColor: C.chip2 }}>
          <T w="700">{st.name}</T>
          <T size={13.5} color={C.muted} style={{ marginTop: 4 }}>Waiting <CountUp value={st.waiting} style={n} /> · Cooking <CountUp value={st.cooking} style={n} /> · Pass <CountUp value={st.ready} style={n} /></T>
          <T size={12.5} color={st.late > 0 ? C.amber : C.dim} style={{ marginTop: 2 }}>Oldest {st.oldestWaitMin} min · {st.late} late</T>
          <T size={12.5} color={st.chefsOnDuty === 0 && st.waiting > 0 ? C.amber : C.dim} style={{ marginTop: 2 }}>{st.chefsOnDuty} of {st.chefsTotal} chefs on duty</T>
          {st.next.slice(0, 2).map((i: any, k: number) => (
            <View key={k} style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <T w="700" size={13}>{i.table}</T>
              <T size={13} style={{ flex: 1 }} numberOfLines={1}>{i.qty} × {i.name}</T>
              {i.remake && <T size={12} w="700" color={C.red}>Remake</T>}
              <T size={12} color={C.dim}>{i.minutes} min</T>
            </View>
          ))}
        </Animated.View>
      ))}
    </View>
  );
}
