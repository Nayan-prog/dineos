import { useMemo, useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated from 'react-native-reanimated';
import { rupees, SPICE } from '@dineos/shared';
import { api } from '../../lib/api';
import { ICON, Icon } from '../../lib/icons';
import { Pressable, rise } from '../../lib/motion';
import { C, Chip, FONT, Loading, MgrDetail, Pills, T } from '../../lib/ui';

type Mods = { spice: string; opts: string[]; note: string };
const DEFAULT: Mods = { spice: 'Medium', opts: [], note: '' };
const keyOf = (guest: number, dish: number) => `${guest}:${dish}`;

/** Take order (App-TakeOrder): pick dishes per guest (or shared), customise spice / options / note, send to the kitchen. */
export default function TakeOrder() {
  const params = useLocalSearchParams<{ table?: string }>();
  const qc = useQueryClient();
  const tables = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables') });
  const menu = useQuery({ queryKey: ['menu'], queryFn: () => api('/floor/menu') });
  const [tableId, setTableId] = useState<number | null>(params.table ? Number(params.table) : null);
  const [guests, setGuests] = useState<number | null>(null);
  const [cat, setCat] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [who, setWho] = useState(1);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [mods, setMods] = useState<Record<number, Mods>>({});
  const [open, setOpen] = useState<number | null>(null);
  const table = tables.data?.tables.find((t: any) => t.id === tableId);
  const g = guests ?? (table?.guests || 2);
  const cats: any[] = menu.data ?? [];
  const current = cat ?? cats[0]?.id;
  const all: any[] = useMemo(() => cats.flatMap((c: any) => c.dishes), [menu.data]);
  const dishes: any[] = search.trim() ? all.filter((d: any) => d.name.toLowerCase().includes(search.trim().toLowerCase())) : (cats.find((c: any) => c.id === current)?.dishes ?? []);

  const lines = Object.entries(qty).filter(([k, n]) => n > 0 && Number(k.split(':')[0]) <= g);
  const count = lines.reduce((a, [, n]) => a + n, 0);
  const price = (id: number) => all.find((d: any) => d.id === id)?.price ?? 0;
  const total = lines.reduce((a, [k, n]) => a + n * price(Number(k.split(':')[1])), 0);
  const perGuest = (n: number) => lines.filter(([k]) => Number(k.split(':')[0]) === n).reduce((a, [, c]) => a + c, 0);
  const empty = Array.from({ length: g }, (_, i) => i + 1).filter((n) => perGuest(n) === 0).map((n) => `Guest ${n}`);

  const bump = (dish: number, d: number) => { const k = keyOf(who, dish); setQty({ ...qty, [k]: Math.max(0, (qty[k] ?? 0) + d) }); };
  const setMod = (dish: number, patch: Partial<Mods>) => setMods({ ...mods, [dish]: { ...DEFAULT, ...(mods[dish] ?? {}), ...patch } });

  const send = useMutation({
    mutationFn: async () => {
      let sessionId = table.sessionId;
      if (!sessionId || guests) sessionId = (await api('/floor/sessions', { body: { tableId, guestCount: g } })).id;
      const items = lines.map(([k, n]) => {
        const [guestNo, dishId] = k.split(':').map(Number);
        const dish = all.find((d: any) => d.id === dishId); const m = mods[dishId] ?? DEFAULT;
        return { dishId, qty: n, guestNo, spice: dish?.hasSpice ? m.spice : null, options: m.opts, note: m.note };
      });
      return api('/floor/orders', { body: { sessionId, items } });
    },
    onSuccess: () => { qc.invalidateQueries(); Alert.alert('Sent to the kitchen'); router.replace(`/waiter/table/${tableId}`); },
    onError: (e) => Alert.alert((e as Error).message),
  });

  if (!tables.data || !menu.data) return <MgrDetail title="Take order" back="/waiter"><Loading /></MgrDetail>;
  const stepper = (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 36, borderRadius: 18, backgroundColor: C.chip }} accessibilityLabel="Guests at table">
      <Pressable accessibilityLabel="Fewer guests" onPress={() => { const n = Math.max(1, g - 1); setGuests(n); if (who > n) setWho(0); }} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}><T size={17}>−</T></Pressable>
      <T w="700" size={13}>{g} guests</T>
      <Pressable accessibilityLabel="More guests" onPress={() => setGuests(Math.min(12, g + 1))} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}><T size={17}>+</T></Pressable>
    </View>
  );
  const sub = table ? `${table.area} · ${table.seats} seats${table.waiter ? ' · ' + table.waiter.split(' ')[0] : ''}` : 'Pick a table';
  const footer = (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 8 }}>
      {count > 0 && empty.length > 0 && g > 1 && <T size={12.5} color="#f5c27a">{empty.join(' and ')} {empty.length > 1 ? 'have' : 'has'} nothing yet</T>}
      <Pressable haptic disabled={!count || !table || send.isPending} onPress={() => send.mutate()} style={{ height: 52, borderRadius: 26, backgroundColor: C.blue2, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, opacity: !count || send.isPending ? 0.45 : 1 }}>
        <T w="600" size={15} color="#fff">{count} items · {rupees(total)}</T><View style={{ flex: 1 }} /><T w="600" size={15} color="#fff">{send.isPending ? 'Sending…' : 'Send to kitchen'}</T>
      </Pressable>
    </View>
  );
  return (
    <MgrDetail title={table ? `Table ${table.code} · ${table.sessionId ? 'Add items' : 'New order'}` : 'Take order'} sub={sub} back="/waiter" right={table ? stepper : undefined} footer={footer} gap={10}>
      {!table && <Pills items={tables.data.tables.map((t: any) => [t.id, t.state === 'free' ? t.code : `${t.code} · ${t.guests}`] as [number, string])} value={tableId ?? -1} onChange={(v) => { setTableId(v); setGuests(null); setWho(1); }} />}
      {tables.data.tables.length === 0 && <T color={C.dim}>No tables assigned to you yet. Ask the manager.</T>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: C.chip }}>
        <Icon d={ICON.search} size={18} color={C.muted} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search dishes" placeholderTextColor={C.muted} accessibilityLabel="Search dishes" style={{ flex: 1, minWidth: 0, padding: 0, color: C.text, fontSize: 14, fontFamily: FONT['400'] }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        {cats.map((c: any) => <Chip key={c.id} label={c.name} on={!search.trim() && c.id === current} onPress={() => { setCat(c.id); setSearch(''); }} />)}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <T size={12.5} color={C.dim} style={{ marginRight: 2 }}>For</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}>
          {Array.from({ length: g + 1 }, (_, n) => (n + 1) % (g + 1)).map((n) => { const on = n === who; const c = n === 0 ? 0 : perGuest(n); return (
            <Pressable key={n} onPress={() => setWho(n)} style={{ height: 30, paddingHorizontal: 10, borderRadius: 15, justifyContent: 'center', backgroundColor: on ? 'rgba(59,130,246,0.16)' : 'transparent', borderWidth: 1, borderColor: on ? C.blue2 : C.border }}>
              <T w="600" size={12} color={on ? '#9cc3fa' : C.muted}>{n === 0 ? 'Shared' : `Guest ${n}${c ? ' · ' + c : ''}`}</T>
            </Pressable>
          ); })}
        </ScrollView>
      </View>

      {dishes.length === 0 && <T color={C.dim}>No dishes found</T>}
      {dishes.map((d: any, i: number) => {
        const n = qty[keyOf(who, d.id)] ?? 0; const m = mods[d.id] ?? DEFAULT; const hasMods = !!mods[d.id]; const isOpen = open === d.id && n > 0; const out = !d.available;
        const others = Array.from({ length: g + 1 }, (_, k) => k).filter((k) => k !== who && (qty[keyOf(k, d.id)] ?? 0) > 0).map((k) => `${k === 0 ? 'Shared' : 'G' + k} ×${qty[keyOf(k, d.id)]}`);
        const parts = [...(hasMods && d.hasSpice ? [`${m.spice} spicy`] : []), ...m.opts, ...(m.note ? [`“${m.note}”`] : [])];
        return (
          <Animated.View key={d.id} entering={rise(i)} style={{ backgroundColor: C.card, borderRadius: 16, padding: 12, gap: 10, opacity: out ? 0.5 : 1, borderWidth: 1, borderColor: isOpen ? C.border : 'transparent' }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: C.line, alignItems: 'center', justifyContent: 'center' }}><T w="700" size={20} color={C.dim}>{d.name[0]}</T></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 10, height: 10, borderWidth: 1.5, borderColor: d.veg ? C.green : C.red, borderRadius: 2 }} /><T w="600" numberOfLines={1} style={{ flex: 1 }}>{d.name}</T></View>
                <T size={12.5} color={C.dim}>{rupees(d.price)} · {d.prepMinutes} min{others.length ? <T size={12.5} color={C.blue}> · {others.join(', ')}</T> : null}</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  {n > 0 && !out ? <Pressable onPress={() => setOpen(isOpen ? null : d.id)} accessibilityState={{ expanded: isOpen }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 32 }}><Icon d={ICON.edit} size={14} color={C.blue} sw={2} /><T w="600" size={13} color={C.blue}>{hasMods ? 'Edit changes' : 'Customize'}</T></Pressable> : <View />}
                  {out ? <T w="600" size={12} color={C.dim}>Sold out</T> : n === 0 ? (
                    <Pressable disabled={!table} onPress={() => bump(d.id, 1)} style={{ height: 34, paddingHorizontal: 16, borderRadius: 17, backgroundColor: C.chip, justifyContent: 'center', opacity: table ? 1 : 0.45 }}><T w="600" size={13} color={C.blue}>Add</T></Pressable>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', height: 34, borderRadius: 17, backgroundColor: C.chip2 }}>
                      <Pressable accessibilityLabel={`Remove one ${d.name}`} onPress={() => bump(d.id, -1)} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}><T size={17}>−</T></Pressable>
                      <T w="700" style={{ minWidth: 16, textAlign: 'center' }}>{n}</T>
                      <Pressable accessibilityLabel={`Add one ${d.name}`} onPress={() => bump(d.id, 1)} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}><T size={17}>+</T></Pressable>
                    </View>
                  )}
                </View>
              </View>
            </View>
            {hasMods && !isOpen && n > 0 && parts.length > 0 && <T size={12.5} color="#f5c27a">{parts.join(' · ')}</T>}
            {isOpen && (
              <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, gap: 10 }}>
                {d.hasSpice && <View><T size={12} color={C.muted} style={{ marginBottom: 6 }}>Spice level</T><View style={{ flexDirection: 'row', gap: 6 }}>{SPICE.map((x) => <Pressable key={x} onPress={() => setMod(d.id, { spice: x })} style={{ flex: 1, height: 34, borderRadius: 17, backgroundColor: m.spice === x ? C.text : C.chip, alignItems: 'center', justifyContent: 'center' }}><T w="600" size={12} color={m.spice === x ? C.bg : C.muted}>{x === 'Extra spicy' ? 'Extra' : x}</T></Pressable>)}</View></View>}
                {d.options?.length > 0 && <View><T size={12} color={C.muted} style={{ marginBottom: 6 }}>Options</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{d.options.map((o: string) => { const on = m.opts.includes(o); return <Pressable key={o} onPress={() => setMod(d.id, { opts: on ? m.opts.filter((y) => y !== o) : [...m.opts, o] })} style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: on ? C.text : C.chip, justifyContent: 'center' }}><T w="600" size={12.5} color={on ? C.bg : C.muted}>{o}</T></Pressable>; })}</View></View>}
                <View><T size={12} color={C.muted} style={{ marginBottom: 6 }}>Note for the kitchen</T><TextInput value={m.note} onChangeText={(v) => setMod(d.id, { note: v })} placeholder="e.g. less oil, sauce on the side" placeholderTextColor={C.dim} multiline maxLength={200} style={{ minHeight: 56, padding: 10, borderRadius: 12, backgroundColor: C.chip, color: C.text, fontSize: 13.5, fontFamily: FONT['400'], textAlignVertical: 'top' }} /></View>
                <Pressable onPress={() => setOpen(null)} style={{ height: 40, borderRadius: 20, backgroundColor: C.text, alignItems: 'center', justifyContent: 'center' }}><T w="600" color={C.bg}>Done</T></Pressable>
              </View>
            )}
          </Animated.View>
        );
      })}
    </MgrDetail>
  );
}
