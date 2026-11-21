import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { api, auth } from '../../lib/api';
import { ICON, Icon } from '../../lib/icons';
import { Pressable } from '../../lib/motion';
import { useNotifications } from '../../lib/notify';
import { C, FONT, Loading, MgrScreen, T } from '../../lib/ui';

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', manager: 'Manager', admin: 'Admin' };
const START = 18 * 60, END = 23 * 60 + 30; // tonight's shift window shown in the design

/** Profile (App-Profile): who you are, shift / break, today's numbers, notifications, sign out. */
export default function Profile() {
  const me = auth.get()!.staff;
  const qc = useQueryClient();
  const meQ = useQuery({ queryKey: ['me'], queryFn: () => api('/auth/me') });
  const d = useQuery({ queryKey: ['dashboard', 1], queryFn: () => api('/manage/dashboard?days=1') });
  const { unread } = useNotifications();
  const brk = useMutation({ mutationFn: (onBreak: boolean) => api(`/team/staff/${me.id}`, { method: 'PATCH', body: { onBreak } }), onSuccess: () => qc.invalidateQueries() });
  const onBreak = meQ.data?.staff.onBreak ?? false;
  const logout = async () => { await api('/auth/logout', { body: {} }).catch(() => {}); await auth.clear(); router.replace('/welcome'); };
  const head = <View><T w="700" size={26} style={{ letterSpacing: -0.3 }}>Profile</T></View>;
  if (!meQ.data) return <MgrScreen active="profile" header={false} back gap={18}>{head}<Loading /></MgrScreen>;
  const now = new Date(); const mins = now.getHours() * 60 + now.getMinutes();
  const pct = Math.max(0, Math.min(100, ((mins - START) / (END - START)) * 100));
  const k = d.data?.kpis;
  const stats: [string, string][] = [['Orders today', String(k?.orders ?? '–')], ['Tables in use', k ? `${k.occupied}/${k.tables}` : '–'], ['Avg prep', k ? `${k.avgPrepMinutes}m` : '–']];
  const big = { color: C.text, fontSize: 20, fontFamily: FONT['700'] } as const;
  return (
    <MgrScreen active="profile" header={false} back gap={18}>
      {head}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.chip2, alignItems: 'center', justifyContent: 'center' }}><T w="700" size={24}>{me.name[0]}</T></View>
        <View><T w="700" size={20}>{me.name}</T><T size={13} color={C.muted}>{ROLE_LABEL[me.role] ?? me.role} · Spice Garden</T></View>
      </View>

      <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View><T w="600">{onBreak ? 'On break' : 'On duty'}</T><T size={12.5} color={C.dim}>Evening shift · 6 PM to 11:30 PM</T></View>
          <T w="600" size={12} color={onBreak ? C.amber : C.green}>{onBreak ? 'Break' : 'On duty'}</T>
        </View>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: C.chip2 }}><View style={{ height: 4, borderRadius: 2, backgroundColor: C.blue2, width: `${pct}%` }} /></View>
        <Pressable onPress={() => brk.mutate(!onBreak)} haptic style={{ height: 42, borderRadius: 21, backgroundColor: C.chip2, alignItems: 'center', justifyContent: 'center' }}><T w="600">{onBreak ? 'End break' : 'Take a break'}</T></Pressable>
      </View>

      <View style={{ backgroundColor: C.card, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 4, flexDirection: 'row' }}>
        {stats.map(([l, v]) => <View key={l} style={{ flex: 1, alignItems: 'center' }}><T style={{ color: C.text }}><T style={big}>{v}</T></T><T size={12} color={C.dim}>{l}</T></View>)}
      </View>

      <View>
        <Pressable onPress={() => router.replace('/manager/notifications')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <Icon d={ICON.bell} size={20} color={C.muted} />
          <T w="500" style={{ flex: 1 }}>Notifications</T>
          {unread > 0 && <T w="600" size={13} color={C.blue}>{unread}</T>}
          <Icon d={ICON.chev} size={16} color={C.dim} />
        </Pressable>
        <Pressable onPress={logout} style={{ minHeight: 52, justifyContent: 'center' }}><T w="600" color={C.red}>Sign out</T></Pressable>
      </View>
    </MgrScreen>
  );
}
