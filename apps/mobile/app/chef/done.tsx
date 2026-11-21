import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Animated from 'react-native-reanimated';
import { api } from '../../lib/api';
import { ChefScreen, doneStats, useChef } from '../../lib/chef-ui';
import { CountUp, rise } from '../../lib/motion';
import { C, FONT, Loading, MSec, T } from '../../lib/ui';

/** Done today (App-Chef-Done): dishes made, average prep time, on-time share, dishes per hour, recent dishes. */
export default function ChefDone() {
  const c = useChef();
  const q = useQuery({ queryKey: ['done'], queryFn: () => api('/kitchen/done') });
  const rows: any[] = q.data ?? [];
  const st = doneStats(rows);
  const now = new Date();
  const hours = Array.from({ length: 6 }, (_, i) => (now.getHours() - 5 + i + 24) % 24);
  const per = hours.map((h) => rows.filter((r) => r.readyAt && new Date(r.readyAt).getHours() === h).reduce((a, r) => a + r.qty, 0));
  const max = Math.max(1, ...per);
  const label = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;
  const big = { color: C.text, fontSize: 24, fontFamily: FONT['700'] } as const;
  return (
    <ChefScreen active="done" sub={`Done today · ${c.d?.station.name ?? ''}`} gap={20}>
      {!q.data ? <Loading /> : <>
        <View style={{ flexDirection: 'row', gap: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <View style={{ flex: 1 }}><CountUp value={st.made} style={big} /><T size={12} color={C.dim}>Dishes made</T></View>
          <View style={{ flex: 1 }}><CountUp value={st.avg} format={(n) => n + 'm'} style={big} /><T size={12} color={C.dim}>Avg prep time</T></View>
          <View style={{ flex: 1 }}><CountUp value={st.onTime} format={(n) => n + '%'} style={{ ...big, color: '#7fcfa3' }} /><T size={12} color={C.dim}>On time</T></View>
        </View>
        <MSec title="Dishes per hour">
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 90 }}>
            {per.map((v, i) => (
              <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                <T size={11} color={C.muted}>{v}</T>
                <View style={{ width: '100%', borderRadius: 3, backgroundColor: C.blue2, opacity: i === per.length - 1 ? 1 : 0.55, height: `${Math.round((v / max) * 80)}%` }} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>{hours.map((h) => <T key={h} size={11} color={C.dim} style={{ flex: 1, textAlign: 'center' }}>{label(h)}</T>)}</View>
        </MSec>
        <MSec title="Recent">
          {rows.length === 0 && <T color={C.dim}>Nothing finished yet today</T>}
          {rows.slice(0, 10).map((r, i) => { const m = st.prep(r); return (
            <Animated.View key={r.id} entering={rise(i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <T size={12.5} color={C.dim} style={{ width: 52 }}>{new Date(r.readyAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: false })}</T>
              <View style={{ flex: 1, minWidth: 0 }}><T w="600">{r.qty} × {r.name}</T><T size={12} color={C.dim}>{r.table}{r.waiter ? ` · ${r.waiter.split(' ')[0]}` : ''}</T></View>
              <T w="600" size={13} color={m > r.prepMinutes ? '#f5c27a' : '#7fcfa3'}>{m} min</T>
            </Animated.View>
          ); })}
        </MSec>
      </>}
    </ChefScreen>
  );
}
