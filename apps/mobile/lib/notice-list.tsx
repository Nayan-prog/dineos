import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { Pressable, rise } from './motion';
import { since, useNotifications } from './notify';
import { C, Chip, Loading, MgrDetail, MgrScreen, T } from './ui';

const FILTERS = ['All', 'Orders', 'Kitchen', 'Alerts'] as const;

/** Notifications (App-Notifications): open service alerts and the activity log, filterable, "Mark all read". Shared by the manager and waiter apps. */
export function NoticeScreen({ back, tableBase, nav, bottom }: { back: string; tableBase: string; nav?: 'alerts'; bottom?: React.ReactNode }) {
  const [f, setF] = useState<(typeof FILTERS)[number]>('All');
  const { items, unread, markAll, loading } = useNotifications();
  const list = items.filter((n) => f === 'All' || n.cat === f).slice(0, 40);
  const markBtn = <Pressable onPress={markAll} style={{ height: 44, paddingHorizontal: 8, justifyContent: 'center' }}><T w="600" size={13} color={C.blue}>Mark all read</T></Pressable>;
  const body = <>
      <View style={{ flexDirection: 'row', gap: 8 }}>{FILTERS.map((x) => <Chip key={x} label={x} on={f === x} onPress={() => setF(x)} />)}</View>
      {loading ? <Loading /> : (
        <View>
          {list.length === 0 && <T color={C.dim}>Nothing here</T>}
          {list.map((n, i) => (
            <Animated.View key={n.id} entering={rise(i)}>
              <Pressable onPress={() => n.tableId && tableBase && router.push(`${tableBase}/${n.tableId}` as any)} style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' }}><T w="700" size={12.5} color={n.color}>{n.tag}</T></View>
                <View style={{ flex: 1, minWidth: 0 }}><T w={n.unread ? '600' : '500'}>{n.title}</T><T size={12.5} color={C.dim}>{n.sub}</T></View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}><T size={12} color={C.dim}>{since(n.at)}</T><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: n.unread ? C.blue2 : 'transparent' }} /></View>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      )}
  </>;
  // manager: same layout as the sidebar pages (back arrow + 26px heading, no top bar)
  if (nav) return (
    <MgrScreen active="alerts" header={false} back gap={14}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View><T w="700" size={26} style={{ letterSpacing: -0.3 }}>Notifications</T><T size={13} color={C.muted} style={{ marginTop: 2 }}>{unread} new</T></View>
        {markBtn}
      </View>
      {body}
    </MgrScreen>
  );
  return (
    <MgrDetail title="Notifications" sub={`${unread} new`} nav={nav} bottom={bottom} back={back} gap={14}
      right={<Pressable onPress={markAll} style={{ height: 44, paddingHorizontal: 8, justifyContent: 'center' }}><T w="600" size={13} color={C.blue}>Mark all read</T></Pressable>}>
      <View style={{ flexDirection: 'row', gap: 8 }}>{FILTERS.map((x) => <Chip key={x} label={x} on={f === x} onPress={() => setF(x)} />)}</View>
      {loading ? <Loading /> : (
        <View>
          {list.length === 0 && <T color={C.dim}>Nothing here</T>}
          {list.map((n, i) => (
            <Animated.View key={n.id} entering={rise(i)}>
              <Pressable onPress={() => n.tableId && tableBase && router.push(`${tableBase}/${n.tableId}` as any)} style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' }}><T w="700" size={12.5} color={n.color}>{n.tag}</T></View>
                <View style={{ flex: 1, minWidth: 0 }}><T w={n.unread ? '600' : '500'}>{n.title}</T><T size={12.5} color={C.dim}>{n.sub}</T></View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}><T size={12} color={C.dim}>{since(n.at)}</T><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: n.unread ? C.blue2 : 'transparent' }} /></View>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      )}
    </MgrDetail>
  );
}
