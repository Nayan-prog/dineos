import { useRef } from 'react';
import { Alert, Share, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Print from 'expo-print';
import QRCode from 'react-native-qrcode-svg';
import { api } from '../../lib/api';
import { AuthPage } from '../../lib/auth-ui';
import { ICON, Icon } from '../../lib/icons';
import { PillButton } from '../../lib/auth-ui';
import { Pressable } from '../../lib/motion';
import { C, Loading, T } from '../../lib/ui';

/** Table added (App-TableAdded): the new table's QR code with Download / Print / Share. */
export default function TableAdded() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ['table', id], queryFn: () => api(`/floor/tables/${id}`) });
  const qr = useRef<any>(null);
  if (!q.data) return <AuthPage left={<View style={{ height: 48 }} />}><Loading /></AuthPage>;
  const t = q.data.table;
  const shape = t.shape[0].toUpperCase() + t.shape.slice(1);
  const share = () => Share.share({ message: `Table ${t.code} · ${t.qrUrl}` }).catch(() => {});
  const print = () => qr.current?.toDataURL(async (b64: string) => {
    try { await Print.printAsync({ html: `<div style="text-align:center;font-family:sans-serif;padding:40px"><h1>Table ${t.code}</h1><p>Scan to order</p><img width="320" height="320" src="data:image/png;base64,${b64}"/><p>${t.qrUrl}</p></div>` }); }
    catch (e) { Alert.alert((e as Error).message); }
  });
  const btn = { height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: C.chip, justifyContent: 'center' } as const;
  return (
    <AuthPage
      left={<Pressable accessibilityLabel="Close" onPress={() => router.replace('/manager/tables')} style={{ width: 48, height: 48, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><Icon d={ICON.close} color="#f5f5f5" sw={1.9} /></Pressable>}
      footer={
        <View>
          <PillButton label="Open table" onPress={() => router.replace(`/manager/table/${t.id}`)} />
          <Pressable onPress={() => router.replace('/manager/table-new')} style={{ marginTop: 16, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><T w="700" color="#f5f5f5">Add another table</T></Pressable>
        </View>
      }>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} /><T w="600" color="#7fcfa3">QR code created</T></View>
      <T w="700" size={34} color="#f5f5f5" style={{ marginTop: 10, marginBottom: 6, lineHeight: 40, letterSpacing: -0.5 }}>Table {t.code} is ready</T>
      <T size={15} color="#b3b3b3" style={{ lineHeight: 21 }}>{t.area} · {t.seats} seats · {shape}</T>
      <View style={{ marginTop: 28, alignItems: 'center', gap: 12 }}>
        <View style={{ padding: 12, backgroundColor: '#fff', borderRadius: 18 }}><QRCode value={t.qrUrl} size={216} backgroundColor="#ffffff" color="#0b0b0c" getRef={(c) => { qr.current = c; }} /></View>
        <T size={13} color={C.dim} numberOfLines={1}>{t.qrUrl.replace(/^https?:\/\//, '')}</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[['Download', share], ['Print', print], ['Share', share]].map(([l, f]) => <Pressable key={l as string} onPress={f as () => void} style={btn}><T w="600">{l as string}</T></Pressable>)}
        </View>
      </View>
    </AuthPage>
  );
}
