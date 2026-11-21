import { useState, type ReactNode } from 'react';
import { Icon } from '../../ui';

/** Phone sign-in screens (apps/mobile welcome, login-email, login-pin, signup; designs MW-Welcome, MW-Login*, MW-Signup-1..6). Data calls come in as props from Auth.tsx. */

export type Role = 'owner' | 'manager' | 'admin';
type Result = Promise<string | void>; // resolves to an error message, or nothing on success

function Page({ left, right, title, sub, subColor, footer, children }: { left?: ReactNode; right?: ReactNode; title?: string; sub?: string; subColor?: string; footer?: ReactNode; children?: ReactNode }) {
  return (
    <div className="ma">
      <div className="ma-bar">{left}<span className="grow" />{right}</div>
      <div className="ma-body">
        {title && <h1>{title}</h1>}
        {sub && <p className="ma-sub" style={subColor ? { color: subColor } : undefined}>{sub}</p>}
        {children}
      </div>
      {footer}
    </div>
  );
}
const Back = ({ onClick }: { onClick: () => void }) => <button className="ma-back" aria-label="Go back" onClick={onClick}><Icon name="back" size={22} sw={1.9} /></button>;
const Pill = ({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) => <button className="ma-pill" disabled={disabled} onClick={onClick}>{label}</button>;
const Err = ({ text }: { text: string }) => (text ? <div className="err" role="alert" style={{ marginBottom: 12 }}>{text}</div> : null);

const ROLES: [string, string, Role | null][] = [['Owner', 'crown', 'owner'], ['Manager', 'dash', 'manager'], ['Admin', 'shield', 'admin'], ['Staff', 'staff', null]];

/** Choose role: Owner / Manager / Admin sign in with email, Staff with phone + PIN. */
export function MWelcome({ onRole, onStaff, onSignup }: { onRole: (r: Role) => void; onStaff: () => void; onSignup: () => void }) {
  return (
    <Page left={<span className="brand" style={{ fontSize: 20 }}>DineOS</span>} title="Sign in" sub="Spice Garden · FC Road, Pune" subColor="var(--blue)"
      footer={<div className="ma-alt" style={{ marginTop: 0 }}>New restaurant? <button onClick={onSignup}>Create account</button></div>}>
      <div className="role-list" style={{ marginTop: 20 }}>
        {ROLES.map(([label, icon, role]) => (
          <button key={label} className="ma-role" onClick={() => (role ? onRole(role) : onStaff())}>
            <span><Icon name={icon} size={22} /></span><span className="grow">{label}</span><Icon name="chev" size={18} sw={1.9} />
          </button>
        ))}
      </div>
    </Page>
  );
}

/** Owner / Manager / Admin: email + password. */
export function MEmail({ role, onBack, onStaff, submit }: { role: Role; onBack: () => void; onStaff: () => void; submit: (email: string, password: string) => Result }) {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const demo = `${role}@spicegarden.in`;
  const go = async () => { if (busy || !email || !pw) return; setErr(''); setBusy(true); const e = await submit(email.trim(), pw); if (e) setErr(e); setBusy(false); };
  return (
    <Page left={<Back onClick={onBack} />} title={`${role[0].toUpperCase() + role.slice(1)} sign in`} sub="Use the email you registered Spice Garden with."
      footer={<form onSubmit={(e) => { e.preventDefault(); go(); }}><Err text={err} /><Pill label={busy ? 'Signing in…' : 'Sign in'} disabled={busy || !email || !pw} onClick={go} /><div className="ma-alt">Working a shift? <button type="button" onClick={onStaff}>Sign in as staff</button></div></form>}>
      <label className="ma-field"><span className="sr" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Email</span><input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }} /></label>
      <label className="ma-field tight"><span className="sr" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Password</span><input type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Password" value={pw} style={{ letterSpacing: show ? 0 : 3 }} onChange={(e) => { setPw(e.target.value); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && go()} /><button type="button" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></label>
      <button className="ma-demo" onClick={() => { setEmail(demo); setPw('dineos123'); }}><div>Demo: {demo} · dineos123</div><div style={{ fontSize: 12, marginTop: 2 }}>Tap to fill</div></button>
    </Page>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
const DEMO: [string, string, string, string][] = [['Waiter', 'Priya Sharma', '9811111111', '1111'], ['Chef', 'Ravi Kumar', '9822222221', '2222']];

/** Staff: phone number + PIN keypad (4 dots, up to 6 digits). */
export function MPin({ onBack, onManager, submit }: { onBack: () => void; onManager: () => void; submit: (phone: string, pin: string) => Result }) {
  const [phone, setPhone] = useState(''); const [pin, setPin] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const ready = pin.length >= 4 && phone.trim().length >= 6;
  const press = (k: string) => { if (!k) return; setErr(''); setPin(k === '⌫' ? pin.slice(0, -1) : pin.length < 6 ? pin + k : pin); };
  const go = async () => { if (!ready || busy) return; setErr(''); setBusy(true); const e = await submit(phone.trim(), pin); if (e) { setErr(e); setPin(''); } setBusy(false); };
  return (
    <Page left={<Back onClick={onBack} />} right={<span style={{ fontSize: 14, fontWeight: 600, color: '#b3b3b3' }}>Spice Garden</span>} title="Staff sign in" sub="Enter your phone number and PIN."
      footer={<div style={{ marginTop: 16 }}><div style={{ textAlign: 'center' }}><Err text={err} /></div><Pill label={busy ? 'Signing in…' : 'Start shift'} disabled={!ready || busy} onClick={go} /><div className="ma-alt" style={{ marginTop: 20 }}>Manager? <button onClick={onManager}>Sign in with email</button></div></div>}>
      <label className="ma-field" style={{ marginTop: 20 }}><span>Phone</span><input type="tel" inputMode="tel" aria-label="Phone number" maxLength={15} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <div className="row-flex" style={{ justifyContent: 'space-between', marginTop: 22 }}>
        <span style={{ color: '#b3b3b3', fontSize: 15 }}>PIN</span>
        <div className="ma-pin" aria-label={`${pin.length} digits entered`}>{Array.from({ length: Math.max(4, pin.length) }, (_, i) => <span key={i} className={i < pin.length ? 'f' : ''} />)}</div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {DEMO.map(([r, who, ph, pn]) => <button key={r} className="ma-demo" style={{ marginTop: 0 }} onClick={() => { setPhone(ph); setPin(pn); setErr(''); }}>Demo {r.toLowerCase()}: {ph} · PIN {pn} <span style={{ fontSize: 12 }}>({who}) · tap to fill</span></button>)}
      </div>
      <div className="ma-keys">
        {KEYS.map((k, i) => <button key={i} type="button" className={k ? '' : 'blank'} aria-label={k === '⌫' ? 'Delete' : k || undefined} aria-hidden={k ? undefined : true} tabIndex={k ? 0 : -1} onClick={() => press(k)}>{k}</button>)}
      </div>
    </Page>
  );
}

export type SignupData = { name: string; email: string; password: string; restaurantName: string; city: string };

/** Owner sign-up, 6 steps (MW-Signup-1..6): welcome, email, code, password, name, restaurant. Calls `create` at the end. */
export function MSignup({ onExit, onLogin, create }: { onExit: () => void; onLogin: () => void; create: (d: SignupData) => Result }) {
  const [step, setStep] = useState(1); const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [password, setPassword] = useState(''); const [show, setShow] = useState(false);
  const [name, setName] = useState(''); const [restaurant, setRestaurant] = useState(''); const [city, setCity] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = (n: number) => { setDir(n > step ? 'fwd' : 'back'); setErr(''); setStep(n); };
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const pwOk = password.length >= 8 && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
  const finish = async () => {
    setErr(''); setBusy(true);
    const e = await create({ name: name.trim(), email: email.trim().toLowerCase(), password, restaurantName: restaurant.trim(), city: city.trim() });
    if (e) { setErr(e); if (/email/i.test(e)) go(2); }
    setBusy(false);
  };
  const field = (el: ReactNode) => <label className="ma-field">{el}</label>;
  const footer = (label: string, ok: boolean, onClick: () => void, withLogin?: boolean) => (
    <div><Err text={err} /><Pill label={busy ? 'Please wait…' : label} disabled={!ok || busy} onClick={onClick} />{withLogin && <div className="ma-alt" style={{ marginTop: 40 }}>Already have an account? <button onClick={onLogin}>Log in</button></div>}</div>
  );
  const next = () => go(step + 1);
  const pages: Record<number, { title: string; sub?: string; body?: ReactNode; footer: ReactNode }> = {
    1: { title: 'Create your account', sub: 'Set up your restaurant in a few minutes. Orders, kitchen, tables and bills, all in one app.', footer: footer('Continue with email', true, next, true) },
    2: { title: "What's your email?", footer: footer('Continue', emailOk, next, true), body: field(<input type="email" autoFocus autoComplete="email" placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && emailOk && next()} />) },
    3: { title: 'Verify your email', sub: `We sent a 6-digit code to ${email.trim()}.`, footer: footer('Continue', code.length === 6, next), body: field(<input inputMode="numeric" autoFocus autoComplete="one-time-code" placeholder="6-digit code" aria-label="6-digit code" maxLength={6} value={code} style={{ letterSpacing: 4 }} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />) },
    4: { title: 'Create a password', footer: footer('Next', pwOk, next), body: <>
      <label className="ma-field"><input type={show ? 'text' : 'password'} autoFocus autoComplete="new-password" placeholder="Password" aria-label="Password" value={password} style={{ letterSpacing: show ? 0 : 3 }} onChange={(e) => setPassword(e.target.value)} /><button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} style={{ width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a8a8a' }}><Icon name={show ? 'eyeoff' : 'eye'} size={20} sw={1.8} /></button></label>
      <div style={{ marginTop: 12, fontSize: 14, color: 'var(--dim)' }}>At least 8 characters, with a number and a symbol.</div></> },
    5: { title: "What's your name?", sub: 'Your staff will see this as the owner.', footer: footer('Continue', name.trim().length >= 2, next), body: field(<input autoFocus autoComplete="name" placeholder="Full name" aria-label="Full name" value={name} onChange={(e) => setName(e.target.value)} />) },
    6: { title: "What's your restaurant called?", sub: 'Guests see this on the menu and their bill.', footer: footer('Create restaurant', restaurant.trim().length >= 2, finish), body: <>
      {field(<input autoFocus placeholder="Restaurant name" aria-label="Restaurant name" value={restaurant} onChange={(e) => setRestaurant(e.target.value)} />)}
      <label className="ma-field tight"><span style={{ width: 44, color: 'var(--dim)', fontSize: 16 }}>City</span><input aria-label="City" autoComplete="address-level2" style={{ fontSize: 18 }} value={city} onChange={(e) => setCity(e.target.value)} /></label></> },
  };
  const p = pages[step];
  return (
    <div key={step} className={dir === 'fwd' ? 'step-fwd' : 'step-back'}>
      <Page left={<Back onClick={() => (step === 1 ? onExit() : go(step - 1))} />} title={p.title} sub={p.sub} footer={p.footer}>{p.body}</Page>
    </div>
  );
}
