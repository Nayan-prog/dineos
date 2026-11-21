import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { rupees } from '@dineos/shared';
import { api } from '../../lib/api';
import { C, Loading, MgrScreen, MSec, Row, T } from '../../lib/ui';

/** Analytics (web "Analytics"): last 7 days of revenue, top dishes, payment methods. Owner and manager only. */
export default function Analytics() {
  const { data } = useQuery({ queryKey: ['analytics'], queryFn: () => api('/manage/analytics') });
  const head = <View><T w="700" size={26} style={{ letterSpacing: -0.3 }}>Analytics</T><T size={13} color={C.muted} style={{ marginTop: 2 }}>Last 7 days</T></View>;
  if (!data) return <MgrScreen header={false} back gap={22}>{head}<Loading /></MgrScreen>;
  const max = Math.max(1, ...data.days.map((d: any) => d.revenue));
  return (
    <MgrScreen header={false} back gap={22}>
      {head}
      <MSec title="Revenue by day">
        {data.days.length === 0 ? <T color={C.dim}>No bills yet</T> : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 190 }}>
            {data.days.map((d: any) => (
              <View key={d.d} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                <T w="600" size={10.5} numberOfLines={1}>{rupees(d.revenue).replace('.00', '')}</T>
                <View style={{ width: '100%', maxWidth: 34, height: Math.max(4, (d.revenue / max) * 130), backgroundColor: C.blue2, borderRadius: 6 }} />
                <T size={10.5} color={C.dim} numberOfLines={1}>{d.day}</T>
              </View>
            ))}
          </View>
        )}
      </MSec>
      <MSec title="Top dishes">
        {data.top.map((t: any, i: number) => (
          <Row key={t.name} i={i}>
            <T color={C.dim} style={{ width: 20 }}>{i + 1}</T>
            <T w="600" style={{ flex: 1 }}>{t.name}</T>
            <T size={12.5} color={C.muted}>{t.qty} sold</T>
            <T style={{ width: 80, textAlign: 'right' }}>{rupees(t.revenue)}</T>
          </Row>
        ))}
        {data.top.length === 0 && <T color={C.dim}>Nothing sold yet</T>}
      </MSec>
      <MSec title="Payment methods">
        {data.methods.map((m: any, i: number) => (
          <Row key={m.method} i={i}>
            <T w="600" style={{ flex: 1 }}>{m.method.toUpperCase()}</T>
            <T size={12.5} color={C.muted}>{m.n} bills</T>
            <T style={{ width: 80, textAlign: 'right' }}>{rupees(m.revenue)}</T>
          </Row>
        ))}
        {data.methods.length === 0 && <T color={C.dim}>No payments yet</T>}
      </MSec>
    </MgrScreen>
  );
}
