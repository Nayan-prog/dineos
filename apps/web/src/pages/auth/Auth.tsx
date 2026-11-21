import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { api, session } from '../../api';
import { homeFor, Icon, useIsMobile } from '../../ui';
import { MEmail, MPin, MSignup, MWelcome, type Role, type SignupData } from './MobileAuth';

// data calls shared by the desktop forms and the phone screens
const signIn = (kind: 'pin' | 'email', a: string, b: string) => api(kind === 'pin' ? '/auth/pin' : '/auth/login', { body: kind === 'pin' ? { phone: a, pin: b } : { email: a, password: b }, token: null });
const createAccount = (body: SignupData & { role: string }) => api('/auth/signup', { body, token: null });

function Split({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-left">
        <span className="brand" style={{ fontSize: 24 }}>DineOS</span>
        <div>
          <h2>Run your restaurant<br /><span className="muted">from one screen.</span></h2>
          <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column' }}>
            {[['01', 'Orders from the table QR go straight to the right station'], ['02', 'Chefs share one queue per station, oldest first'], ['03', 'Waiters get food-ready and guest calls, with hand-off']].map(([n, t]) => (
              <div key={n} className="row"><span className="dim bb">{n}</span><span className="muted">{t}</span></div>
            ))}
          </div>
        </div>
        <span className="dim small">Spice Garden · FC Road, Pune</span>
      </div>
      <div className="auth-right"><div className="auth-card">{children}</div></div>
    </div>
  );
}

export function Login() {
  const nav = useNavigate();
  const mobile = useIsMobile();
  const [mode, setMode] = useState<null | 'email' | 'pin'>(null);
  const [role, setRole] = useState('Owner');
  const [a, setA] = useState(''); const [b, setB] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await signIn(mode === 'pin' ? 'pin' : 'email', a.trim(), b);
      session.set(r); nav({ to: homeFor(r.staff.role) });
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  if (mobile) {
    const phoneSignIn = async (kind: 'pin' | 'email', a: string, b: string) => {
      try { const r = await signIn(kind, a, b); session.set(r); nav({ to: homeFor(r.staff.role) }); } catch (x) { return (x as Error).message; }
    };
    if (mode === 'email') return <MEmail role={role.toLowerCase() as Role} onBack={() => setMode(null)} onStaff={() => setMode('pin')} submit={(e, p) => phoneSignIn('email', e, p)} />;
    if (mode === 'pin') return <MPin onBack={() => setMode(null)} onManager={() => { setRole('Manager'); setMode('email'); }} submit={(ph, pin) => phoneSignIn('pin', ph, pin)} />;
    return <MWelcome onRole={(r) => { setRole(r[0].toUpperCase() + r.slice(1)); setMode('email'); }} onStaff={() => setMode('pin')} onSignup={() => nav({ to: '/signup' })} />;
  }
  if (!mode) return (
    <Split>
      <div><h1 className="title">Sign in</h1><div className="muted" style={{ marginTop: 4 }}>Choose how you work at the restaurant</div></div>
      <div className="role-list">
        {['Owner', 'Manager', 'Admin'].map((r) => <button key={r} onClick={() => { setRole(r); setMode('email'); }}><span className="grow">{r}</span><Icon name="chev" size={16} /></button>)}
        <button onClick={() => { setRole('Staff'); setMode('pin'); }}><span className="grow">Staff <span className="dim" style={{ fontWeight: 500 }}>· waiter or chef</span></span><Icon name="chev" size={16} /></button>
      </div>
      <div className="muted small">New restaurant? <Link to="/signup" className="blue b">Create an account</Link></div>
    </Split>
  );
  return (
    <Split>
      <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => { setMode(null); setErr(''); }}>← Back</button>
      <div><h1 className="title">{role} sign in</h1><div className="muted" style={{ marginTop: 4 }}>{mode === 'pin' ? 'Use the phone number and PIN your manager gave you' : 'Use your work email and password'}</div></div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label className="field">{mode === 'pin' ? 'Phone number' : 'Email'}<input className="input" autoFocus inputMode={mode === 'pin' ? 'tel' : 'email'} value={a} onChange={(e) => setA(e.target.value)} placeholder={mode === 'pin' ? '98xxxxxxxx' : 'you@restaurant.com'} required /></label>
        <label className="field">{mode === 'pin' ? 'PIN' : 'Password'}<input className="input" type="password" inputMode={mode === 'pin' ? 'numeric' : undefined} maxLength={mode === 'pin' ? 6 : 100} value={b} onChange={(e) => setB(e.target.value)} required /></label>
        {err && <div className="err">{err}</div>}
        <button className="btn block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <div className="dim small">Demo: {mode === 'pin' ? 'waiter 9811111111 · chef 9822222221 · PIN 1111 / 2222' : `${role.toLowerCase()}@spicegarden.in · dineos123`}</div>
    </Split>
  );
}

export function Signup() {
  const nav = useNavigate();
  const mobile = useIsMobile();
  const [f, setF] = useState({ name: '', email: '', password: '', restaurantName: '', city: '', role: 'owner' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const r = await createAccount(f); session.set(r); nav({ to: '/tables' }); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  if (mobile) return <MSignup onExit={() => nav({ to: '/login' })} onLogin={() => nav({ to: '/login' })} create={async (d) => { try { const r = await createAccount({ ...d, role: 'owner' }); session.set(r); nav({ to: '/dashboard' }); } catch (x) { return (x as Error).message; } }} />;
  return (
    <Split>
      <div><h1 className="title">Create your account</h1><div className="muted" style={{ marginTop: 4 }}>Set up your restaurant in a minute</div></div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="pills">{['owner', 'manager'].map((r) => <button type="button" key={r} className={f.role === r ? 'on' : ''} onClick={() => setF({ ...f, role: r })}>{r === 'owner' ? 'I am the owner' : 'I am the manager'}</button>)}</div>
        <label className="field">Your name<input className="input" value={f.name} onChange={set('name')} required /></label>
        <label className="field">Work email<input className="input" type="email" value={f.email} onChange={set('email')} required /></label>
        <label className="field">Password<input className="input" type="password" minLength={8} value={f.password} onChange={set('password')} placeholder="At least 8 characters" required /></label>
        <label className="field">Restaurant name<input className="input" value={f.restaurantName} onChange={set('restaurantName')} required /></label>
        <label className="field">City<input className="input" value={f.city} onChange={set('city')} /></label>
        {err && <div className="err">{err}</div>}
        <button className="btn block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <div className="muted small">Already have an account? <Link to="/login" className="blue b">Sign in</Link></div>
    </Split>
  );
}
