import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { api, auth } from '../../lib/api';
import { ICON, Icon } from '../../lib/icons';
import { Pressable } from '../../lib/motion';
import { useNotifications } from '../../lib/notify';
import { C, FONT, MgrScreen, T } from '../../lib/ui';
import { WaiterNav, useWaiter } from '../../lib/waiter-ui';

const START = 18 * 60, END = 23 * 60; // tonight's shift window shown in the design

/** Profile (App-Profile, waiter version): who I am, shift / break, my numbers today, notifications, sign out. */
export default function WaiterProfile() {
  const me = auth.get()!.staff;
  const w = useWaiter();
  const stats = useQuery({ queryKey: ['my-stats'], queryFn: () => api('/team/stats/me') });
  const { unread } = useNotifications();
  const logout = async () => { await api('/auth/logout', { body: {} }).catch(() => {}); await auth.clear(); router.replace('/welcome'); };
  const now = new Date(); const mins = now.getHours() * 60 + now.getMinutes();
  const pct = Math.max(0, Math.min(100, ((mins - START) / (END - START)) * 100));
  const s = stats.data;
  const nums: [string, string][] = [['Tables served', s ? String(s.tablesServed) : '–'], ['Orders taken', s ? String(s.ordersTaken) : '–'], ['Avg serve time', s ? `${s.avgServeMin}m` : '–']];
  const big = { color: C.text, fontSize: 20, fontFamily: FONT['700'] } as const;
  return (
    <MgrScreen base="/waiter" gap={18} nav={<WaiterNav active="profile" />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.chip2, alignItems: 'center', justifyContent: 'center' }}><T w="700" size={24}>{me.name[0]}</T></View>
        <View><T w="700" size={20}>{me.name}</T><T size={13} color={C.muted}>Waiter · {w.sub.replace(' · ', ' · ')}</T></View>
      </View>

      <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View><T w="600">{w.onBreak ? 'On break' : 'On duty'}</T><T size={12.5} color={C.dim}>Evening shift · 6 PM to 11 PM</T></View>
          <T w="600" size={12} color={w.onBreak ? C.amber : C.green}>{w.onBreak ? 'Break' : 'On duty'}</T>
        </View>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: C.chip2 }}><View style={{ height: 4, borderRadius: 2, backgroundColor: C.blue2, width: `${pct}%` }} /></View>
        <Pressable onPress={w.toggleBreak} haptic style={{ height: 42, borderRadius: 21, backgroundColor: C.chip2, alignItems: 'center', justifyContent: 'center' }}><T w="600">{w.onBreak ? 'End break' : 'Take a break'}</T></Pressable>
      </View>

      <View style={{ backgroundColor: C.card, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 4, flexDirection: 'row' }}>
        {nums.map(([l, v]) => <View key={l} style={{ flex: 1, alignItems: 'center' }}><T style={big}>{v}</T><T size={12} color={C.dim}>{l}</T></View>)}
      </View>

      <View>
        <Pressable onPress={() => router.replace('/waiter/notifications')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderBottomWidth: 1, borderBottomColor: C.line }}>
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
