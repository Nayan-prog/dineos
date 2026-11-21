import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, auth } from '../../lib/api';
import { Btn, C, Input, Loading, MgrScreen, T } from '../../lib/ui';

/** Settings (web "Settings"): restaurant name, address, city and GST. Only the owner or manager can change them. */
export default function Settings() {
  const me = auth.get()!.staff;
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['restaurant'], queryFn: () => api('/team/restaurant') });
  const [f, setF] = useState<{ name: string; address: string; city: string; taxPercent: string } | null>(null);
  useEffect(() => { if (data) setF({ name: data.name, address: data.address, city: data.city, taxPercent: String(data.taxPercent) }); }, [data]);
  const save = useMutation({
    mutationFn: () => api('/team/restaurant', { method: 'PATCH', body: { name: f!.name.trim(), address: f!.address.trim(), city: f!.city.trim(), taxPercent: Number(f!.taxPercent) } }),
    onSuccess: () => { qc.invalidateQueries(); Alert.alert('Saved'); }, onError: (e) => Alert.alert((e as Error).message),
  });
  const head = <View><T w="700" size={26} style={{ letterSpacing: -0.3 }}>Settings</T><T size={13} color={C.muted} style={{ marginTop: 2 }}>Restaurant details</T></View>;
  if (!f) return <MgrScreen header={false} back gap={18}>{head}<Loading /></MgrScreen>;
  const can = me.role === 'owner' || me.role === 'manager';
  const field = (label: string, key: keyof typeof f, kb?: 'numeric') => (
    <View style={{ gap: 6 }}><T size={13} color={C.muted}>{label}</T><Input value={f[key]} editable={can} keyboardType={kb} onChangeText={(v) => setF({ ...f, [key]: v })} style={{ opacity: can ? 1 : 0.6 }} /></View>
  );
  return (
    <MgrScreen header={false} back gap={18}>
      {head}
      {field('Restaurant name', 'name')}
      {field('Address', 'address')}
      {field('City', 'city')}
      {field('Tax (GST %)', 'taxPercent', 'numeric')}
      {can ? <Btn label={save.isPending ? 'Saving…' : 'Save'} disabled={!f.name.trim() || save.isPending} onPress={() => save.mutate()} /> : <T size={12.5} color={C.dim}>Only the owner or manager can change these.</T>}
    </MgrScreen>
  );
}
