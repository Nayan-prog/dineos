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
    <div className="min-h-screen grid grid-cols-[1fr_1fr] phone:grid-cols-[1fr]">
      <div className="p-12 flex flex-col justify-between border-r border-r-line2 phone:hidden [&_h2]:text-[44px] [&_h2]:leading-[1.1] [&_h2]:tracking-[-1px] [&_h2]:m-0">
        <span className="font-brand font-bold in-[.top]:text-[22px] text-[24px]!">DineOS</span>
        <div>
          <h2>Run your restaurant<br /><span className="text-muted">from one screen.</span></h2>
          <div className="mt-9 flex flex-col">
            {[['01', 'Orders from the table QR go straight to the right station'], ['02', 'Chefs share one queue per station, oldest first'], ['03', 'Waiters get food-ready and guest calls, with hand-off']].map(([n, t]) => (
              <div key={n} className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0"><span className="text-dim font-bold">{n}</span><span className="text-muted">{t}</span></div>
            ))}
          </div>
        </div>
        <span className="text-dim text-[12.5px]">Spice Garden · FC Road, Pune</span>
      </div>
      <div className="flex items-center justify-center p-8"><div className="w-[min(400px,_100%)] flex flex-col gap-4">{children}</div></div>
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
      <div><h1 className="m-0 text-[30px] font-bold tracking-[-.4px] phone:text-[26px]">Sign in</h1><div className="text-muted mt-1">Choose how you work at the restaurant</div></div>
      <div className="[&_a]:flex [&_a]:items-center [&_a]:gap-3.5 [&_a]:py-4 [&_a]:px-0 [&_a]:border-0 [&_a]:border-b [&_a]:border-b-line [&_a]:bg-transparent [&_a]:w-full [&_a]:text-left [&_a]:text-[16px] [&_a]:font-semibold [&_button]:flex [&_button]:items-center [&_button]:gap-3.5 [&_button]:py-4 [&_button]:px-0 [&_button]:border-0 [&_button]:border-b [&_button]:border-b-line [&_button]:bg-transparent [&_button]:w-full [&_button]:text-left [&_button]:text-[16px] [&_button]:font-semibold [&>*]:stagger">
        {['Owner', 'Manager', 'Admin'].map((r) => <button key={r} onClick={() => { setRole(r); setMode('email'); }}><span className="flex-1 min-w-0">{r}</span><Icon name="chev" size={16} /></button>)}
        <button onClick={() => { setRole('Staff'); setMode('pin'); }}><span className="flex-1 min-w-0">Staff <span className="text-dim font-medium">· waiter or chef</span></span><Icon name="chev" size={16} /></button>
      </div>
      <div className="text-muted text-[12.5px]">New restaurant? <Link to="/signup" className="text-blue font-semibold">Create an account</Link></div>
    </Split>
  );
  return (
    <Split>
      <button className="border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] self-start" onClick={() => { setMode(null); setErr(''); }}>← Back</button>
      <div><h1 className="m-0 text-[30px] font-bold tracking-[-.4px] phone:text-[26px]">{role} sign in</h1><div className="text-muted mt-1">{mode === 'pin' ? 'Use the phone number and PIN your manager gave you' : 'Use your work email and password'}</div></div>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">{mode === 'pin' ? 'Phone number' : 'Email'}<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" autoFocus inputMode={mode === 'pin' ? 'tel' : 'email'} value={a} onChange={(e) => setA(e.target.value)} placeholder={mode === 'pin' ? '98xxxxxxxx' : 'you@restaurant.com'} required /></label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">{mode === 'pin' ? 'PIN' : 'Password'}<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" type="password" inputMode={mode === 'pin' ? 'numeric' : undefined} maxLength={mode === 'pin' ? 6 : 100} value={b} onChange={(e) => setB(e.target.value)} required /></label>
        {err && <div className="text-red text-[13.5px]">{err}</div>}
        <button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <div className="text-dim text-[12.5px]">Demo: {mode === 'pin' ? 'waiter 9811111111 · chef 9822222221 · PIN 1111 / 2222' : `${role.toLowerCase()}@spicegarden.in · dineos123`}</div>
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
      <div><h1 className="m-0 text-[30px] font-bold tracking-[-.4px] phone:text-[26px]">Create your account</h1><div className="text-muted mt-1">Set up your restaurant in a minute</div></div>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)]">{['owner', 'manager'].map((r) => <button type="button" key={r} className={(f.role === r) ? "on" : ""} onClick={() => setF({ ...f, role: r })}>{r === 'owner' ? 'I am the owner' : 'I am the manager'}</button>)}</div>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Your name<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" value={f.name} onChange={set('name')} required /></label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Work email<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" type="email" value={f.email} onChange={set('email')} required /></label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Password<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" type="password" minLength={8} value={f.password} onChange={set('password')} placeholder="At least 8 characters" required /></label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Restaurant name<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" value={f.restaurantName} onChange={set('restaurantName')} required /></label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">City<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" value={f.city} onChange={set('city')} /></label>
        {err && <div className="text-red text-[13.5px]">{err}</div>}
        <button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <div className="text-muted text-[12.5px]">Already have an account? <Link to="/login" className="text-blue font-semibold">Sign in</Link></div>
    </Split>
  );
}
