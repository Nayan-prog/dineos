import { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { api, auth } from '../lib/api';
import { AuthPage, PillButton } from '../lib/auth-ui';
import { Icon } from '../lib/icons';
import { Pressable } from '../lib/motion';
import { C, FONT, T } from '../lib/ui';

const EYE = 'M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z';
const SLASH = 'M4 4l16 16';
const input = { flex: 1, minWidth: 0, padding: 0, color: '#f5f5f5', fontSize: 20, fontFamily: FONT['400'] } as const;
const row = { marginTop: 32, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 } as const;

/** Owner sign-up (App-Signup-1 to 6): welcome → email → code → password → name → restaurant. Calls POST /auth/signup at the end. */
export default function Signup() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [password, setPassword] = useState(''); const [show, setShow] = useState(false);
  const [name, setName] = useState(''); const [restaurant, setRestaurant] = useState(''); const [city, setCity] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  const back = () => { setErr(''); if (step === 1) router.canGoBack() ? router.back() : router.replace('/welcome'); else setStep(step - 1); };
  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { if (step === 1) return false; setErr(''); setStep(step - 1); return true; }); return () => h.remove(); }, [step]);

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const pwOk = password.length >= 8 && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
  const create = async () => {
    setErr(''); setBusy(true);
    try {
      const r = await api('/auth/signup', { anon: true, body: { name: name.trim(), email: email.trim().toLowerCase(), password, restaurantName: restaurant.trim(), city: city.trim(), role: 'owner' } });
      await auth.set(r); router.replace('/manager');
    } catch (e) { const m = (e as Error).message; setErr(m); if (/email/i.test(m)) setStep(2); } finally { setBusy(false); }
  };

  const login = <Pressable onPress={() => router.replace({ pathname: '/login-email', params: { role: 'manager' } })}><T size={14} color="#b3b3b3" style={{ marginTop: 40, textAlign: 'center' }}>Already have an account? <T w="700" size={14} color="#f5f5f5">Log in</T></T></Pressable>;
  const error = err ? <T color={C.red} style={{ marginBottom: 12 }}>{err}</T> : null;
  const footer = (label: string, ok: boolean, onPress: () => void, withLogin?: boolean) => (
    <View>{error}<PillButton label={busy ? 'Please wait…' : label} disabled={!ok || busy} onPress={onPress} />{withLogin ? login : null}</View>
  );
  const next = () => { setErr(''); setStep(step + 1); };

  const pages: Record<number, { title: string; sub?: string; body?: React.ReactNode; footer: React.ReactNode }> = {
    1: { title: 'Create your account', sub: 'Set up your restaurant in a few minutes. Orders, kitchen, tables and bills, all in one app.', footer: footer('Continue with email', true, next, true) },
    2: {
      title: "What's your email?", footer: footer('Continue', emailOk, next, true),
      body: <View style={row}><TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={C.dim} accessibilityLabel="Email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoFocus style={input} /></View>,
    },
    3: {
      title: 'Verify your email', sub: `We sent a 6-digit code to ${email.trim()}.`, footer: footer('Continue', code.length === 6, next),
      body: <View style={row}><TextInput value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" placeholderTextColor={C.dim} accessibilityLabel="6-digit code" keyboardType="number-pad" autoComplete="sms-otp" maxLength={6} autoFocus style={[input, { letterSpacing: 4 }]} /></View>,
    },
    4: {
      title: 'Create a password', footer: footer('Next', pwOk, next),
      body: <>
        <View style={row}>
          <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={C.dim} accessibilityLabel="Password" secureTextEntry={!show} autoCapitalize="none" autoComplete="new-password" autoFocus style={[input, { letterSpacing: show ? 0 : 3 }]} />
          <Pressable accessibilityLabel={show ? 'Hide password' : 'Show password'} onPress={() => setShow(!show)} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}><Icon d={show ? EYE + SLASH : EYE} size={20} color="#8a8a8a" sw={1.8} /></Pressable>
        </View>
        <T size={14} color={C.dim} style={{ marginTop: 12 }}>At least 8 characters, with a number and a symbol.</T>
      </>,
    },
    5: {
      title: "What's your name?", sub: 'Your staff will see this as the owner.', footer: footer('Continue', name.trim().length >= 2, next),
      body: <View style={row}><TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={C.dim} accessibilityLabel="Full name" autoComplete="name" autoCapitalize="words" autoFocus style={input} /></View>,
    },
    6: {
      title: "What's your restaurant called?", sub: 'Guests see this on the menu and their bill.', footer: footer('Create restaurant', restaurant.trim().length >= 2, create),
      body: <>
        <View style={row}><TextInput value={restaurant} onChangeText={setRestaurant} placeholder="Restaurant name" placeholderTextColor={C.dim} accessibilityLabel="Restaurant name" autoCapitalize="words" autoFocus style={input} /></View>
        <View style={[row, { marginTop: 8 }]}>
          <T size={16} color={C.dim} style={{ width: 44 }}>City</T>
          <TextInput value={city} onChangeText={setCity} accessibilityLabel="City" autoComplete="postal-address-locality" autoCapitalize="words" style={[input, { fontSize: 18 }]} />
        </View>
      </>,
    },
  };
  const p = pages[step];
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <AuthPage left={<Pressable accessibilityLabel="Go back" onPress={back} style={{ width: 48, height: 48, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><BackIcon /></Pressable>} title={p.title} sub={p.sub} footer={p.footer}>{p.body}</AuthPage>
    </KeyboardAvoidingView>
  );
}

function BackIcon() { return <Icon d="M19 12H5M11 6l-6 6 6 6" color="#f5f5f5" sw={1.9} />; }
