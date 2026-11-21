import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { api, auth } from '../../lib/api';
import { ICON, Icon } from '../../lib/icons';
import { Pressable, rise } from '../../lib/motion';
import { Btn, C, Input, Loading, MgrScreen, Pills, Sec, Sheet, T, UnderTabs } from '../../lib/ui';

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', manager: 'Manager', admin: 'Admin', waiter: 'Waiter', chef: 'Chef' };
const MGR = ['owner', 'manager', 'admin'];

/** Team (App-Mgr-Staff): everyone on the roster with duty status, filter by role, add staff, open Shifts. */
export default function Team() {
  const [role, setRole] = useState<'all' | 'waiter' | 'chef' | 'mgr'>('all');
  const [adding, setAdding] = useState(false);
  const q = useQuery({ queryKey: ['staff'], queryFn: () => api('/team/staff') });
  const head = (extra?: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <View>
        <T w="700" size={26} style={{ letterSpacing: -0.3 }}>Team</T>
        <T size={13} color={C.muted} style={{ marginTop: 2 }}>{extra ?? ' '}</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Pressable onPress={() => setAdding(true)} hitSlop={8} style={{ height: 40, flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon d={ICON.plus} size={16} color={C.blue} sw={2} /><T w="600" color={C.blue}>Add staff</T></Pressable>
      </View>
    </View>
  );
  if (!q.data) return <MgrScreen header={false} back active="team" gap={16}>{head()}<Loading /></MgrScreen>;
  const all: any[] = q.data.staff;
  const onDuty = all.filter((p) => p.onDuty && !p.onBreak).length;
  const hour = new Date().getHours();
  const shift = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const list = all.filter((p) => role === 'all' || (role === 'mgr' ? MGR.includes(p.role) : p.role === role));
  const where = (p: any) => p.role === 'chef' ? q.data.stations.find((x: any) => x.id === p.stationId)?.name ?? 'No station' : p.role === 'waiter' ? q.data.areas.find((x: any) => x.id === p.areaId)?.name ?? 'No area' : 'Management';
  const status = (p: any): [string, string] => p.onBreak ? ['On break', C.amber] : p.onDuty ? ['On duty', C.green] : ['Off', '#6f6f78'];
  const today = (p: any) => p.role === 'waiter' ? `${p.ordersToday} orders` : p.role === 'chef' ? `${p.doneToday} items` : '—';
  return (
    <MgrScreen header={false} back active="team" gap={16}>
      {head(`${onDuty} of ${all.length} on duty · ${shift} shift`)}
      <UnderTabs items={[['all', 'All'], ['waiter', 'Waiters'], ['chef', 'Chefs'], ['mgr', 'Managers']]} value={role} onChange={setRole} />
      <View>
        {list.map((p, i) => { const [st, sc] = status(p); return (
          <Animated.View key={p.id} entering={rise(i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.chip2, alignItems: 'center', justifyContent: 'center' }}>
              <T w="600" size={15}>{p.name[0]}</T>
              <View style={{ position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: 6, backgroundColor: sc, borderWidth: 2, borderColor: C.bg }} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}><T w="600" numberOfLines={1}>{p.name}</T><T size={12.5} color={C.dim}>{ROLE_LABEL[p.role]} · {where(p)}</T></View>
            <View style={{ alignItems: 'flex-end' }}><T w="600" size={13.5}>{today(p)}</T><T size={12} color={sc}>{st}</T></View>
          </Animated.View>
        ); })}
        {list.length === 0 && <T color={C.dim}>Nobody here yet</T>}
      </View>
      {adding && <AddStaff stations={q.data.stations} areas={q.data.areas} onClose={() => setAdding(false)} />}
    </MgrScreen>
  );
}

function AddStaff({ stations, areas, onClose }: { stations: any[]; areas: any[]; onClose: () => void }) {
  const me = auth.get()!.staff;
  const qc = useQueryClient();
  const [role, setRole] = useState<'waiter' | 'chef' | 'manager' | 'admin'>('waiter');
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [pin, setPin] = useState('');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [stationId, setStationId] = useState<number | null>(stations[0]?.id ?? null); const [areaId, setAreaId] = useState<number | null>(areas[0]?.id ?? null);
  const staff = role === 'waiter' || role === 'chef';
  const roles: [string, string][] = [['waiter', 'Waiter'], ['chef', 'Chef'], ...(me.role === 'admin' ? [] : [['manager', 'Manager'], ['admin', 'Admin']] as [string, string][])];
  const save = useMutation({
    mutationFn: () => api('/team/staff', { body: { name: name.trim(), phone: phone.trim(), role, ...(staff ? { pin } : { email: email.trim(), password }), ...(role === 'chef' ? { stationId } : {}), ...(role === 'waiter' ? { areaId } : {}) } }),
    onSuccess: () => { qc.invalidateQueries(); onClose(); },
    onError: (e) => Alert.alert((e as Error).message),
  });
  const ok = name.trim().length >= 2 && phone.trim().length >= 6 && (staff ? /^\d{4,6}$/.test(pin) : email.includes('@') && password.length >= 8);
  return (
    <Sheet visible title="Add staff" onClose={onClose}>
      <Pills items={roles as [any, string][]} value={role} onChange={setRole} />
      <Input value={name} onChangeText={setName} placeholder="Full name" />
      <Input value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" maxLength={15} />
      {staff ? <Input value={pin} onChangeText={setPin} placeholder="4 digit PIN" keyboardType="number-pad" secureTextEntry maxLength={6} /> : <>
        <Input value={email} onChangeText={setEmail} placeholder="Work email" keyboardType="email-address" autoCapitalize="none" />
        <Input value={password} onChangeText={setPassword} placeholder="Password (8+ characters)" secureTextEntry autoCapitalize="none" />
      </>}
      {role === 'chef' && <Sec title="Station"><Pills items={stations.map((x) => [x.id, x.name] as [number, string])} value={stationId ?? -1} onChange={setStationId} /></Sec>}
      {role === 'waiter' && <Sec title="Area"><Pills items={areas.map((x) => [x.id, x.name] as [number, string])} value={areaId ?? -1} onChange={setAreaId} /></Sec>}
      <Btn label={save.isPending ? 'Adding…' : 'Add to team'} disabled={!ok || save.isPending} onPress={() => save.mutate()} />
    </Sheet>
  );
}
