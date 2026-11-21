import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Pressable } from '../lib/motion';
import { router } from 'expo-router';
import { api, auth, homeFor } from '../lib/api';
import { AuthPage, BackButton, PillButton } from '../lib/auth-ui';
import { C, FONT, T } from '../lib/ui';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/** Staff: phone number + PIN keypad (4 dots; up to 6 digits are accepted by the API). */
export default function LoginPin() {
  const [phone, setPhone] = useState(''); const [pin, setPin] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const ready = pin.length >= 4 && phone.trim().length >= 6;
  const press = (k: string) => { if (!k) return; setErr(''); setPin(k === '⌫' ? pin.slice(0, -1) : pin.length < 6 ? pin + k : pin); };
  const submit = async () => {
    setErr(''); setBusy(true);
    try { const r = await api('/auth/pin', { anon: true, body: { phone: phone.trim(), pin } }); await auth.set(r); router.replace(homeFor(r.staff.role)); }
    catch (e) { setErr((e as Error).message); setPin(''); } finally { setBusy(false); }
  };
  return (
    <AuthPage left={<BackButton />} right={<T w="600" size={14} color="#b3b3b3">Spice Garden</T>} title="Staff sign in" sub="Enter your phone number and PIN."
      footer={
        <View style={{ marginTop: 16 }}>
          {err ? <T color={C.red} style={{ marginBottom: 12, textAlign: 'center' }}>{err}</T> : null}
          <PillButton label={busy ? 'Signing in…' : 'Start shift'} onPress={submit} disabled={!ready || busy} />
          <Pressable onPress={() => router.replace({ pathname: '/login-email', params: { role: 'manager' } })}><T size={14} color="#b3b3b3" style={{ marginTop: 20, textAlign: 'center' }}>Manager? <T w="700" size={14} color="#f5f5f5">Sign in with email</T></T></Pressable>
        </View>
      }>
      <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#232327' }}>
        <T size={15} color="#b3b3b3">Phone</T>
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" accessibilityLabel="Phone number" maxLength={15} style={{ flex: 1, minWidth: 0, color: '#f5f5f5', fontSize: 20, padding: 0, fontFamily: FONT['400'] }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 }}>
        <T size={15} color="#b3b3b3">PIN</T>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {Array.from({ length: Math.max(4, pin.length) }, (_, i) => { const f = i < pin.length; return <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: f ? '#f5f5f5' : 'transparent', borderWidth: 1.5, borderColor: f ? '#f5f5f5' : '#3a3a40' }} />; })}
        </View>
      </View>
      <View style={{ marginTop: 16, gap: 8 }}>
        {[['Waiter', 'Priya Sharma', '9811111111', '1111'], ['Chef', 'Ravi Kumar', '9822222221', '2222']].map(([role, who, ph, pn]) => (
          <Pressable key={role} onPress={() => { setPhone(ph); setPin(pn); setErr(''); }}>
            <T size={13} color={C.dim}>Demo {role.toLowerCase()}: {ph} · PIN {pn} <T size={12} color={C.dim}>({who}) · tap to fill</T></T>
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: 'auto', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {KEYS.map((k, i) => (
          <Pressable key={i} onPress={() => press(k)} accessibilityLabel={k === '⌫' ? 'Delete' : k || 'Blank'} style={{ width: '31.9%', height: 56, borderRadius: 16, backgroundColor: k ? '#111113' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            <T w="600" size={22} color="#f5f5f5">{k}</T>
          </Pressable>
        ))}
      </View>
    </AuthPage>
  );
}
