import { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { Pressable } from '../lib/motion';
import { router, useLocalSearchParams } from 'expo-router';
import { api, auth, homeFor } from '../lib/api';
import { AuthPage, BackButton, PillButton } from '../lib/auth-ui';
import { C, FONT, T } from '../lib/ui';

const field = { color: '#f5f5f5', fontSize: 20, padding: 0, fontFamily: FONT['400'] } as const;

/** Owner / Manager / Admin: work email + password. */
export default function LoginEmail() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const label = role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : 'Manager';
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const demoEmail = `${role === 'owner' ? 'owner' : role === 'admin' ? 'admin' : 'manager'}@spicegarden.in`;
  const submit = async () => {
    setErr(''); setBusy(true);
    try { const r = await api('/auth/login', { anon: true, body: { email: email.trim(), password: pw } }); await auth.set(r); router.replace(homeFor(r.staff.role)); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <AuthPage left={<BackButton />} title={`${label} sign in`} sub="Use the email you registered Spice Garden with."
        footer={
          <View>
            {err ? <T color={C.red} style={{ marginBottom: 12 }}>{err}</T> : null}
            <PillButton label={busy ? 'Signing in…' : 'Sign in'} onPress={submit} disabled={busy || !email || !pw} />
            <Pressable onPress={() => router.replace('/login-pin')}><T size={14} color="#b3b3b3" style={{ marginTop: 32, textAlign: 'center' }}>Working a shift? <T w="700" size={14} color="#f5f5f5">Sign in as staff</T></T></Pressable>
          </View>
        }>
        <View style={{ marginTop: 32, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#232327' }}>
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={C.dim} accessibilityLabel="Email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={field} />
        </View>
        <View style={{ marginTop: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#232327' }}>
          <TextInput value={pw} onChangeText={setPw} placeholder="Password" placeholderTextColor={C.dim} accessibilityLabel="Password" secureTextEntry={!show} autoCapitalize="none" autoComplete="current-password" onSubmitEditing={submit} style={[field, { flex: 1, letterSpacing: show ? 0 : 3 }]} />
          <Pressable onPress={() => setShow(!show)} style={{ height: 36, justifyContent: 'center' }}><T w="600" size={14} color="#b3b3b3">{show ? 'Hide' : 'Show'}</T></Pressable>
        </View>
        <Pressable onPress={() => { setEmail(demoEmail); setPw('dineos123'); }} style={{ marginTop: 20 }}>
          <T size={13} color={C.dim}>Demo: {demoEmail} · dineos123</T>
          <T size={12} color={C.dim} style={{ marginTop: 2 }}>Tap to fill</T>
        </Pressable>
      </AuthPage>
    </KeyboardAvoidingView>
  );
}
