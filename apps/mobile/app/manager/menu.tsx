import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rupees } from '@dineos/shared';
import { api, auth } from '../../lib/api';
import { ICON, Icon } from '../../lib/icons';
import { Pressable } from '../../lib/motion';
import { Btn, C, Chip, Input, Loading, MgrScreen, Pills, Row, Sec, Sheet, Stepper, T } from '../../lib/ui';

/** Menu & Dishes (web "Menu & Dishes"): browse by category, switch stock, add or edit a dish. Admin cannot see or set prices. */
export default function Menu() {
  const me = auth.get()!.staff;
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['menu'], queryFn: () => api('/floor/menu') });
  const stations = useQuery({ queryKey: ['stations'], queryFn: () => api('/kitchen/stations') });
  const [cat, setCat] = useState<number | 'all'>('all');
  const [edit, setEdit] = useState<any | null>(null);
  const stock = useMutation({ mutationFn: ([id, available]: [number, boolean]) => api(`/kitchen/dishes/${id}/stock`, { method: 'PATCH', body: { available } }), onSuccess: () => qc.invalidateQueries(), onError: (e) => Alert.alert((e as Error).message) });
  const head = (sub: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <View><T w="700" size={26} style={{ letterSpacing: -0.3 }}>Menu & Dishes</T><T size={13} color={C.muted} style={{ marginTop: 2 }}>{sub}</T></View>
      {me.role !== 'admin' && <Pressable onPress={() => setEdit({})} hitSlop={8} style={{ height: 40, flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon d={ICON.plus} size={16} color={C.blue} sw={2} /><T w="600" color={C.blue}>Add dish</T></Pressable>}
    </View>
  );
  if (!data) return <MgrScreen header={false} back gap={14}>{head(' ')}<Loading /></MgrScreen>;
  const dishes: any[] = data.flatMap((c: any) => c.dishes.map((d: any) => ({ ...d, category: c.name })));
  const list = dishes.filter((d) => cat === 'all' || d.categoryId === cat);
  const stationName = (id: number) => stations.data?.find((s: any) => s.id === id)?.name ?? '';
  return (
    <MgrScreen header={false} back gap={14}>
      {head(`${dishes.length} dishes · ${dishes.filter((d) => !d.available).length} out of stock`)}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        <Chip label="All" on={cat === 'all'} onPress={() => setCat('all')} />
        {data.map((c: any) => <Chip key={c.id} label={c.name} on={cat === c.id} onPress={() => setCat(c.id)} />)}
      </ScrollView>
      <View>
        {list.map((d, i) => (
          <Row key={d.id} i={i} style={{ opacity: d.available ? 1 : 0.7 }}>
            <View style={{ width: 10, height: 10, borderWidth: 1.5, borderColor: d.veg ? C.green : C.red, borderRadius: 2 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T w="600">{d.name}</T>
              <T size={12} color={C.dim}>{d.category} · {stationName(d.stationId)} · {d.prepMinutes} min{'price' in d ? ' · ' + rupees(d.price) : ''}</T>
              {d.options?.length > 0 && <T size={12} color={C.taupe}>{d.options.join(' · ')}</T>}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Pressable onPress={() => stock.mutate([d.id, !d.available])} hitSlop={8}><T w="600" size={12.5} color={d.available ? C.green : C.red}>{d.available ? 'In stock' : 'Out of stock'}</T></Pressable>
              <Pressable onPress={() => setEdit(d)} hitSlop={8}><T w="600" size={12.5} color={C.blue}>Edit</T></Pressable>
            </View>
          </Row>
        ))}
        {list.length === 0 && <T color={C.dim}>No dishes here</T>}
      </View>
      {edit && <DishForm dish={edit} cats={data} stations={stations.data ?? []} admin={me.role === 'admin'} onClose={() => setEdit(null)} />}
    </MgrScreen>
  );
}

function DishForm({ dish, cats, stations, admin, onClose }: { dish: any; cats: any[]; stations: any[]; admin: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: dish.name ?? '', description: dish.description ?? '', categoryId: dish.categoryId ?? cats[0]?.id, stationId: dish.stationId ?? stations[0]?.id,
    price: dish.price != null ? String(dish.price / 100) : '', veg: dish.veg ?? true, prepMinutes: dish.prepMinutes ?? 15, options: (dish.options ?? []).join(', '), hasSpice: dish.hasSpice ?? true,
  });
  const save = useMutation({
    mutationFn: () => {
      const body: any = { name: f.name.trim(), description: f.description.trim(), categoryId: f.categoryId, stationId: f.stationId, veg: f.veg, prepMinutes: f.prepMinutes, hasSpice: f.hasSpice, options: f.options.split(',').map((x: string) => x.trim()).filter(Boolean) };
      if (!admin) body.price = Math.round(Number(f.price || 0) * 100);
      return dish.id ? api(`/manage/dishes/${dish.id}`, { method: 'PATCH', body }) : api('/manage/dishes', { body });
    },
    onSuccess: () => { qc.invalidateQueries(); onClose(); }, onError: (e) => Alert.alert((e as Error).message),
  });
  return (
    <Sheet visible title={dish.id ? 'Edit dish' : 'Add dish'} onClose={onClose}>
      <Input value={f.name} onChangeText={(v) => setF({ ...f, name: v })} placeholder="Name" />
      <Input value={f.description} onChangeText={(v) => setF({ ...f, description: v })} placeholder="Description" />
      <Sec title="Category"><Pills items={cats.map((c) => [c.id, c.name] as [number, string])} value={f.categoryId} onChange={(v) => setF({ ...f, categoryId: v })} /></Sec>
      <Sec title="Station (kitchen queue)"><Pills items={stations.map((s) => [s.id, s.name] as [number, string])} value={f.stationId} onChange={(v) => setF({ ...f, stationId: v })} /></Sec>
      {!admin && <Input value={f.price} onChangeText={(v) => setF({ ...f, price: v.replace(/[^0-9.]/g, '') })} placeholder="Price (₹)" keyboardType="numeric" />}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><T color={C.muted}>Prep time (min)</T><Stepper value={f.prepMinutes} min={1} max={120} onChange={(v) => setF({ ...f, prepMinutes: v })} /></View>
      <Input value={f.options} onChangeText={(v) => setF({ ...f, options: v })} placeholder="Options guests can pick: No onion, Extra butter" />
      <View style={{ flexDirection: 'row', gap: 8 }}><Chip label="Veg" on={f.veg} onPress={() => setF({ ...f, veg: !f.veg })} /><Chip label="Ask spice level" on={f.hasSpice} onPress={() => setF({ ...f, hasSpice: !f.hasSpice })} /></View>
      <Btn label={save.isPending ? 'Saving…' : 'Save dish'} disabled={f.name.trim().length < 2 || save.isPending} onPress={() => save.mutate()} />
    </Sheet>
  );
}
