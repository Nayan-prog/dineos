import { useEffect, useState } from 'react';
import { Alert, TextInput, useWindowDimensions, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { PillButton } from '../../lib/auth-ui';
import { Pressable } from '../../lib/motion';
import { C, Chip, FONT, MgrDetail, T } from '../../lib/ui';

const SHAPES: [string, 'square' | 'round' | 'long'][] = [['Square', 'square'], ['Round', 'round'], ['Long', 'long']];

/** Add table (App-AddTable): live preview, number, area, seats, shape. Saving creates the QR code. */
export default function AddTable() {
  const qc = useQueryClient();
  const areas = useQuery({ queryKey: ['areas'], queryFn: () => api('/floor/areas') });
  const tables = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables') });
  const [areaId, setAreaId] = useState<number | null>(null);
  const [code, setCode] = useState(''); const [touched, setTouched] = useState(false);
  const [seats, setSeats] = useState(4);
  const [shape, setShape] = useState<'square' | 'round' | 'long'>('square');
  const [newArea, setNewArea] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const list: { id: number; name: string }[] = areas.data ?? [];
  const area = areaId ?? list[0]?.id ?? null;

  // suggested number: same letters as the last table in the area, next number after the highest
  useEffect(() => {
    if (touched || !tables.data || area == null) return;
    const here: string[] = tables.data.tables.filter((x: any) => x.areaId === area).map((x: any) => x.code);
    const last = here[here.length - 1] ?? 'T';
    const prefix = (last.match(/^[A-Za-z]+/) ?? ['T'])[0];
    const max = Math.max(0, ...here.filter((c) => c.startsWith(prefix)).map((c) => parseInt(c.slice(prefix.length), 10) || 0));
    setCode(`${prefix}${max + 1}`);
  }, [area, tables.data, touched]);

  const save = useMutation({
    mutationFn: () => api('/floor/tables', { body: { areaId: area, code: code.trim(), seats, shape } }),
    onSuccess: (t: any) => { qc.invalidateQueries(); router.replace({ pathname: '/manager/table-added', params: { id: String(t.id) } }); },
    onError: (e) => Alert.alert((e as Error).message),
  });
  const addArea = useMutation({
    mutationFn: () => api('/floor/areas', { body: { name: (newArea ?? '').trim() } }),
    onSuccess: (a: any) => { qc.invalidateQueries({ queryKey: ['areas'] }); setAreaId(a.id); setNewArea(null); setTouched(false); },
    onError: (e) => Alert.alert((e as Error).message),
  });

  // preview geometry (box is the screen width minus the 20px side padding, 176 high)
  const W = width - 40, H = 176, cx = W / 2, cy = H / 2;
  const [tw, th, tr] = shape === 'round' ? [96, 96, 48] : shape === 'long' ? [Math.max(120, Math.ceil(seats / 2) * 34), 64, 14] : [seats > 4 ? 110 : 84, 84, 14];
  const chairs: { x: number; y: number }[] = [];
  if (shape === 'round') {
    for (let i = 0; i < seats; i++) { const a = (i / seats) * Math.PI * 2 - Math.PI / 2; chairs.push({ x: cx + Math.cos(a) * 64 - 11, y: cy + Math.sin(a) * 64 - 11 }); }
  } else {
    const top = Math.ceil(seats / 2), bottom = seats - top;
    const row = (n: number, y: number) => { for (let i = 0; i < n; i++) chairs.push({ x: cx - tw / 2 + ((i + 0.5) * tw) / n - 11, y }); };
    row(top, cy - th / 2 - 28); row(bottom, cy + th / 2 + 6);
  }
  const line = { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#232327' } as const;
  return (
    <MgrDetail title="Add table" sub="Spice Garden" gap={22} pad={20}
      footer={<View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}><PillButton label={save.isPending ? 'Saving…' : 'Save and create QR code'} disabled={!code.trim() || area == null || save.isPending} onPress={() => save.mutate()} /></View>}>
      <View style={{ height: H, borderRadius: 20, backgroundColor: C.card, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: cx - tw / 2, top: cy - th / 2, width: tw, height: th, borderRadius: tr, backgroundColor: C.chip2, alignItems: 'center', justifyContent: 'center' }}><T w="700" size={15} color="#f5f5f5">{code || '—'}</T></View>
        {chairs.map((c, i) => <View key={i} style={{ position: 'absolute', left: c.x, top: c.y, width: 22, height: 22, borderRadius: 7, backgroundColor: C.blue2, opacity: 0.85 }} />)}
        <T size={12} color={C.dim} style={{ position: 'absolute', right: 14, bottom: 12 }}>Preview</T>
      </View>

      <View style={[line, { gap: 12, paddingTop: 4, paddingBottom: 12 }]}>
        <T w="600" color="#b3b3b3" style={{ width: 110 }}>Table number</T>
        <TextInput value={code} onChangeText={(v) => { setCode(v); setTouched(true); }} autoCapitalize="characters" maxLength={10} accessibilityLabel="Table number" style={{ flex: 1, minWidth: 0, padding: 0, color: '#f5f5f5', fontSize: 20, fontFamily: FONT['600'] }} />
      </View>

      <View>
        <T w="600" color="#b3b3b3" style={{ marginBottom: 10 }}>Area</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {list.map((a) => <Chip key={a.id} label={a.name} on={a.id === area} onPress={() => { setAreaId(a.id); setTouched(false); }} h={40} px={16} size={14} />)}
          <Pressable onPress={() => setNewArea(newArea === null ? '' : null)} style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: C.border, justifyContent: 'center' }}><T w="600" color="#b3b3b3">+ New area</T></Pressable>
        </View>
        {newArea !== null && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <TextInput value={newArea} onChangeText={setNewArea} placeholder="Area name" placeholderTextColor={C.dim} maxLength={40} style={{ flex: 1, height: 44, borderRadius: 12, paddingHorizontal: 14, backgroundColor: C.chip, color: C.text, fontFamily: FONT['400'], fontSize: 14 }} />
            <Pressable onPress={() => addArea.mutate()} disabled={!newArea.trim() || addArea.isPending} style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: C.blue2, justifyContent: 'center', opacity: newArea.trim() ? 1 : 0.45 }}><T w="600" color="#fff">Add</T></Pressable>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View><T w="600" size={16}>Seats</T><T size={13} color={C.dim}>Guests that fit at this table</T></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 22, backgroundColor: C.chip }}>
          <Pressable accessibilityLabel="Fewer seats" onPress={() => setSeats(Math.max(1, seats - 1))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><T size={22} color="#f5f5f5">−</T></Pressable>
          <T w="700" size={18} style={{ minWidth: 28, textAlign: 'center' }}>{seats}</T>
          <Pressable accessibilityLabel="More seats" onPress={() => setSeats(Math.min(30, seats + 1))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><T size={22} color="#f5f5f5">+</T></Pressable>
        </View>
      </View>

      <View>
        <T w="600" color="#b3b3b3" style={{ marginBottom: 10 }}>Shape</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SHAPES.map(([l, v]) => <Pressable key={v} onPress={() => setShape(v)} style={{ flex: 1, height: 40, borderRadius: 12, backgroundColor: shape === v ? '#f5f5f5' : C.chip, alignItems: 'center', justifyContent: 'center' }}><T w="600" color={shape === v ? C.bg : '#b3b3b3'}>{l}</T></Pressable>)}
        </View>
      </View>
    </MgrDetail>
  );
}
