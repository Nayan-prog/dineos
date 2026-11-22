import { useState, type ReactNode } from 'react';
import { Icon } from '../../ui';

/** Phone sign-in screens (apps/mobile welcome, login-email, login-pin, signup; designs MW-Welcome, MW-Login*, MW-Signup-1..6). Data calls come in as props from Auth.tsx. */

export type Role = 'owner' | 'manager' | 'admin';
type Result = Promise<string | void>; // resolves to an error message, or nothing on success

function Page({ left, right, title, sub, subColor, footer, children }: { left?: ReactNode; right?: ReactNode; title?: string; sub?: string; subColor?: string; footer?: ReactNode; children?: ReactNode }) {
  return (
    <div className="min-h-dvh pt-[calc(12px_+_env(safe-area-inset-top))] px-5 pb-[calc(28px_+_env(safe-area-inset-bottom))] flex flex-col text-[#f5f5f5] [animation:fade_var(--t-base)_var(--ease)] [&_h1]:mt-5 [&_h1]:mx-0 [&_h1]:mb-2 [&_h1]:text-[34px] [&_h1]:leading-[40px] [&_h1]:font-bold [&_h1]:tracking-[-.5px]">
      <div className="h-12 flex items-center flex-none">{left}<span className="flex-1 min-w-0" />{right}</div>
      <div className="flex-1 min-h-0 flex flex-col">
        {title && <h1>{title}</h1>}
        {sub && <p className="mt-0 mx-0 mb-4 text-[15px] leading-[21px] text-[#b3b3b3]" style={subColor ? { color: subColor } : undefined}>{sub}</p>}
        {children}
      </div>
      {footer}
    </div>
  );
}
const Back = ({ onClick }: { onClick: () => void }) => <button className="w-12 h-12 -ml-3 flex items-center justify-center border-0 bg-transparent text-[#f5f5f5]" aria-label="Go back" onClick={onClick}><Icon name="back" size={22} sw={1.9} /></button>;
const Pill = ({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) => <button className="w-full h-14 border-0 rounded-[999px] bg-[#f5f5f5] text-bg text-[16px] font-semibold [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease)] disabled:bg-[#232327] disabled:text-[#8b8b93] disabled:opacity-100 active:enabled:[transform:scale(.98)]" disabled={disabled} onClick={onClick}>{label}</button>;
const Err = ({ text }: { text: string }) => (text ? <div className="text-red text-[13.5px] mb-3" role="alert">{text}</div> : null);

const ROLES: [string, string, Role | null][] = [['Owner', 'crown', 'owner'], ['Manager', 'dash', 'manager'], ['Admin', 'shield', 'admin'], ['Staff', 'staff', null]];

/** Choose role: Owner / Manager / Admin sign in with email, Staff with phone + PIN. */
export function MWelcome({ onRole, onStaff, onSignup }: { onRole: (r: Role) => void; onStaff: () => void; onSignup: () => void }) {
  return (
    <Page left={<span className="font-brand font-bold in-[.top]:text-[22px] text-[20px]!">DineOS</span>} title="Sign in" sub="Spice Garden · FC Road, Pune" subColor="var(--color-blue)"
      footer={<div className="text-center text-[14px] text-[#b3b3b3] [&_button]:border-0 [&_button]:bg-transparent [&_button]:p-0 [&_button]:text-[#f5f5f5] [&_button]:font-bold [&_button]:text-[14px] [&_button]:min-h-11 [&_button]:min-w-11 mt-0">New restaurant? <button onClick={onSignup}>Create account</button></div>}>
      <div className="[&_a]:flex [&_a]:items-center [&_a]:gap-3.5 [&_a]:py-4 [&_a]:px-0 [&_a]:border-0 [&_a]:border-b [&_a]:border-b-line [&_a]:bg-transparent [&_a]:w-full [&_a]:text-left [&_a]:text-[16px] [&_a]:font-semibold [&_button]:flex [&_button]:items-center [&_button]:gap-3.5 [&_button]:py-4 [&_button]:px-0 [&_button]:border-0 [&_button]:border-b [&_button]:border-b-line [&_button]:bg-transparent [&_button]:w-full [&_button]:text-left [&_button]:text-[16px] [&_button]:font-semibold [&>*]:stagger mt-5">
        {ROLES.map(([label, icon, role]) => (
          <button key={label} className="flex items-center gap-3.5 py-4 px-0 border-0 border-b border-b-[#1c1c20] bg-transparent w-full text-left text-[#f5f5f5] text-[16px] font-semibold [&>span:first-child]:w-11 [&>span:first-child]:h-11 [&>span:first-child]:rounded-[22px] [&>span:first-child]:bg-[#232327] [&>span:first-child]:flex [&>span:first-child]:items-center [&>span:first-child]:justify-center [&>span:first-child]:flex-none" onClick={() => (role ? onRole(role) : onStaff())}>
            <span><Icon name={icon} size={22} /></span><span className="flex-1 min-w-0">{label}</span><Icon name="chev" size={18} sw={1.9} />
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
      footer={<form onSubmit={(e) => { e.preventDefault(); go(); }}><Err text={err} /><Pill label={busy ? 'Signing in…' : 'Sign in'} disabled={busy || !email || !pw} onClick={go} /><div className="mt-7 text-center text-[14px] text-[#b3b3b3] [&_button]:border-0 [&_button]:bg-transparent [&_button]:p-0 [&_button]:text-[#f5f5f5] [&_button]:font-bold [&_button]:text-[14px] [&_button]:min-h-11 [&_button]:min-w-11">Working a shift? <button type="button" onClick={onStaff}>Sign in as staff</button></div></form>}>
      <label className="flex items-center gap-2.5 mt-8 border-b border-b-[#232327] py-1 px-0 [&_span]:text-[#b3b3b3] [&_span]:text-[15px] [&_input]:flex-1 [&_input]:min-w-0 [&_input]:p-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-[#f5f5f5] [&_input]:text-[20px] [&_input]:[outline:0] [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-[#b3b3b3] [&_button]:font-semibold [&_button]:text-[14px] [&_button]:h-9 [&_input]:min-h-11"><span className="sr absolute w-0.25 h-0.25 overflow-hidden [clip:rect(0_0_0_0)]">Email</span><input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }} /></label>
      <label className="flex items-center gap-2.5 border-b border-b-[#232327] py-1 px-0 mt-3 [&_span]:text-[#b3b3b3] [&_span]:text-[15px] [&_input]:flex-1 [&_input]:min-w-0 [&_input]:p-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-[#f5f5f5] [&_input]:text-[20px] [&_input]:[outline:0] [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-[#b3b3b3] [&_button]:font-semibold [&_button]:text-[14px] [&_button]:h-9 [&_input]:min-h-11"><span className="sr absolute w-0.25 h-0.25 overflow-hidden [clip:rect(0_0_0_0)]">Password</span><input type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Password" value={pw} style={{ letterSpacing: show ? 0 : 3 }} onChange={(e) => { setPw(e.target.value); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && go()} /><button type="button" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></label>
      <button className="mt-5 text-[13px] text-dim text-left border-0 bg-transparent p-0 min-h-11" onClick={() => { setEmail(demo); setPw('dineos123'); }}><div>Demo: {demo} · dineos123</div><div className="text-[12px] mt-0.5">Tap to fill</div></button>
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
    <Page left={<Back onClick={onBack} />} right={<span className="text-[14px] font-semibold text-[#b3b3b3]">Spice Garden</span>} title="Staff sign in" sub="Enter your phone number and PIN."
      footer={<div className="mt-4"><div className="text-center"><Err text={err} /></div><Pill label={busy ? 'Signing in…' : 'Start shift'} disabled={!ready || busy} onClick={go} /><div className="text-center text-[14px] text-[#b3b3b3] [&_button]:border-0 [&_button]:bg-transparent [&_button]:p-0 [&_button]:text-[#f5f5f5] [&_button]:font-bold [&_button]:text-[14px] [&_button]:min-h-11 [&_button]:min-w-11 mt-5">Manager? <button onClick={onManager}>Sign in with email</button></div></div>}>
      <label className="flex items-center gap-2.5 border-b border-b-[#232327] py-1 px-0 [&_span]:text-[#b3b3b3] [&_span]:text-[15px] [&_input]:flex-1 [&_input]:min-w-0 [&_input]:p-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-[#f5f5f5] [&_input]:text-[20px] [&_input]:[outline:0] [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-[#b3b3b3] [&_button]:font-semibold [&_button]:text-[14px] [&_button]:h-9 [&_input]:min-h-11 mt-5"><span>Phone</span><input type="tel" inputMode="tel" aria-label="Phone number" maxLength={15} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <div className="flex items-center gap-2.5 justify-between mt-5.5">
        <span className="text-[#b3b3b3] text-[15px]">PIN</span>
        <div className="flex gap-3.5 [&_span]:w-3.5 [&_span]:h-3.5 [&_span]:rounded-[7px] [&_span]:shadow-[inset_0_0_0_1.5px_#3a3a40] [&_span]:[transition:background-color_var(--t-fast)_var(--ease)] [&_span.f]:bg-[#f5f5f5] [&_span.f]:shadow-[inset_0_0_0_1.5px_#f5f5f5]" aria-label={`${pin.length} digits entered`}>{Array.from({ length: Math.max(4, pin.length) }, (_, i) => <span key={i} className={(i < pin.length) ? "f" : ""} />)}</div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {DEMO.map(([r, who, ph, pn]) => <button key={r} className="text-[13px] text-dim text-left border-0 bg-transparent p-0 min-h-11 mt-0" onClick={() => { setPhone(ph); setPin(pn); setErr(''); }}>Demo {r.toLowerCase()}: {ph} · PIN {pn} <span className="text-[12px]">({who}) · tap to fill</span></button>)}
      </div>
      <div className="mt-auto pt-4 grid grid-cols-[repeat(3,_1fr)] gap-2 [&_button]:h-14 [&_button]:border-0 [&_button]:rounded-[16px] [&_button]:bg-[#111113] [&_button]:text-[#f5f5f5] [&_button]:text-[22px] [&_button]:font-semibold [&_button]:[transition:transform_var(--t-fast)_var(--ease)] [&_button:active]:[transform:scale(.96)] [&_button.blank]:bg-transparent [&_button.blank]:pointer-events-none">
        {KEYS.map((k, i) => <button key={i} type="button" className={(k) ? "" : "blank"} aria-label={k === '⌫' ? 'Delete' : k || undefined} aria-hidden={k ? undefined : true} tabIndex={k ? 0 : -1} onClick={() => press(k)}>{k}</button>)}
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
  const field = (el: ReactNode) => <label className="flex items-center gap-2.5 mt-8 border-b border-b-[#232327] py-1 px-0 [&_span]:text-[#b3b3b3] [&_span]:text-[15px] [&_input]:flex-1 [&_input]:min-w-0 [&_input]:p-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-[#f5f5f5] [&_input]:text-[20px] [&_input]:[outline:0] [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-[#b3b3b3] [&_button]:font-semibold [&_button]:text-[14px] [&_button]:h-9 [&_input]:min-h-11">{el}</label>;
  const footer = (label: string, ok: boolean, onClick: () => void, withLogin?: boolean) => (
    <div><Err text={err} /><Pill label={busy ? 'Please wait…' : label} disabled={!ok || busy} onClick={onClick} />{withLogin && <div className="text-center text-[14px] text-[#b3b3b3] [&_button]:border-0 [&_button]:bg-transparent [&_button]:p-0 [&_button]:text-[#f5f5f5] [&_button]:font-bold [&_button]:text-[14px] [&_button]:min-h-11 [&_button]:min-w-11 mt-10">Already have an account? <button onClick={onLogin}>Log in</button></div>}</div>
  );
  const next = () => go(step + 1);
  const pages: Record<number, { title: string; sub?: string; body?: ReactNode; footer: ReactNode }> = {
    1: { title: 'Create your account', sub: 'Set up your restaurant in a few minutes. Orders, kitchen, tables and bills, all in one app.', footer: footer('Continue with email', true, next, true) },
    2: { title: "What's your email?", footer: footer('Continue', emailOk, next, true), body: field(<input type="email" autoFocus autoComplete="email" placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && emailOk && next()} />) },
    3: { title: 'Verify your email', sub: `We sent a 6-digit code to ${email.trim()}.`, footer: footer('Continue', code.length === 6, next), body: field(<input inputMode="numeric" autoFocus autoComplete="one-time-code" placeholder="6-digit code" aria-label="6-digit code" maxLength={6} value={code} className="tracking-[4px]" onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />) },
    4: { title: 'Create a password', footer: footer('Next', pwOk, next), body: <>
      <label className="flex items-center gap-2.5 mt-8 border-b border-b-[#232327] py-1 px-0 [&_span]:text-[#b3b3b3] [&_span]:text-[15px] [&_input]:flex-1 [&_input]:min-w-0 [&_input]:p-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-[#f5f5f5] [&_input]:text-[20px] [&_input]:[outline:0] [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-[#b3b3b3] [&_button]:font-semibold [&_button]:text-[14px] [&_button]:h-9 [&_input]:min-h-11"><input type={show ? 'text' : 'password'} autoFocus autoComplete="new-password" placeholder="Password" aria-label="Password" value={password} style={{ letterSpacing: show ? 0 : 3 }} onChange={(e) => setPassword(e.target.value)} /><button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} className="w-9 flex items-center justify-center text-[#8a8a8a]!"><Icon name={show ? 'eyeoff' : 'eye'} size={20} sw={1.8} /></button></label>
      <div className="mt-3 text-[14px] text-dim">At least 8 characters, with a number and a symbol.</div></> },
    5: { title: "What's your name?", sub: 'Your staff will see this as the owner.', footer: footer('Continue', name.trim().length >= 2, next), body: field(<input autoFocus autoComplete="name" placeholder="Full name" aria-label="Full name" value={name} onChange={(e) => setName(e.target.value)} />) },
    6: { title: "What's your restaurant called?", sub: 'Guests see this on the menu and their bill.', footer: footer('Create restaurant', restaurant.trim().length >= 2, finish), body: <>
      {field(<input autoFocus placeholder="Restaurant name" aria-label="Restaurant name" value={restaurant} onChange={(e) => setRestaurant(e.target.value)} />)}
      <label className="flex items-center gap-2.5 border-b border-b-[#232327] py-1 px-0 mt-3 [&_span]:text-[#b3b3b3] [&_span]:text-[15px] [&_input]:flex-1 [&_input]:min-w-0 [&_input]:p-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-[#f5f5f5] [&_input]:text-[20px] [&_input]:[outline:0] [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-[#b3b3b3] [&_button]:font-semibold [&_button]:text-[14px] [&_button]:h-9 [&_input]:min-h-11"><span className="w-11 text-dim! text-[16px]!">City</span><input aria-label="City" autoComplete="address-level2" className="text-[18px]!" value={city} onChange={(e) => setCity(e.target.value)} /></label></> },
  };
  const p = pages[step];
  return (
    <div key={step} className={(dir === 'fwd') ? "[animation:step-fwd_250ms_var(--ease)_backwards]" : "[animation:step-back_250ms_var(--ease)_backwards]"}>
      <Page left={<Back onClick={() => (step === 1 ? onExit() : go(step - 1))} />} title={p.title} sub={p.sub} footer={p.footer}>{p.body}</Page>
    </div>
  );
}
