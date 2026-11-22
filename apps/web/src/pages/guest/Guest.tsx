import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { ITEM_LABEL, rupees, SPICE, type ItemStatus } from '@dineos/shared';
import { api, guestSession, useLive } from '../../api';
import { ErrorText, Icon, Loading, Modal, Stepper, STATUS_COLOR, useToast, StatusDot } from '../../ui';

const ORDER = ['signin', 'verify', 'name', 'guests', 'menu', 'review', 'track', 'bill', 'thanks'];
type Step = 'signin' | 'verify' | 'name' | 'guests' | 'menu' | 'review' | 'track' | 'bill' | 'thanks';
type Line = { key: number; dishId: number; name: string; price: number; qty: number; guestNo: number; spice: string | null; options: string[]; note: string };

/** Customer QR flow on the phone: Sign in → Verify → Name → Guests → Menu → Review → Track → Bill → Thanks */
export default function Guest() {
  const { qr } = useParams({ strict: false }) as { qr: string };
  const saved = guestSession.get(qr);
  const [token, setToken] = useState<string | null>(saved?.token ?? null);
  const [step, setStep] = useState<Step>(saved ? 'track' : 'signin');
  const [phone, setPhone] = useState(''); const [devCode, setDevCode] = useState<string | undefined>();
  const [cart, setCart] = useState<Line[]>([]);
  const [guests, setGuests] = useState(2);
  const toast = useToast(); const qc = useQueryClient();
  // slide direction: forward = new step enters from the right, back = from the left
  const prev = useRef<Step>(step); const dir = useRef<'fwd' | 'back'>('fwd');
  if (prev.current !== step) { dir.current = ORDER.indexOf(step) < ORDER.indexOf(prev.current) && !(prev.current === 'track' && step === 'menu') ? 'back' : 'fwd'; prev.current = step; }
  useLive(token);
  const info = useQuery({ queryKey: ['g-table', qr], queryFn: () => api(`/guest/table/${qr}`, { token: null }) });
  const ses = useQuery({ queryKey: ['g-session', token], queryFn: () => api('/guest/me/session', { token }), enabled: !!token, retry: false });
  const g = (path: string, body?: unknown, method?: string) => api(path, { body, token, method });
  useEffect(() => { if (ses.error) { guestSession.clear(qr); setToken(null); setStep('signin'); } }, [ses.error]);
  useEffect(() => { if (ses.data?.paid && step !== 'thanks') setStep('thanks'); }, [ses.data?.paid]);
  useEffect(() => { if (ses.data && step === 'track' && ses.data.items.length === 0) setStep('menu'); }, [ses.data]);
  const call = useMutation({ mutationFn: () => g('/guest/me/call', { note: '' }), onSuccess: () => toast('Your waiter is on the way'), onError: (e) => toast((e as Error).message) });

  const view = (() => {
  if (info.error) return <div className="max-w-120 my-0 mx-auto min-h-screen pt-4 px-5 pb-30 flex flex-col gap-4.5"><div className="text-red text-[13.5px] mt-20">{(info.error as Error).message}</div></div>;
  if (!info.data) return <div className="max-w-120 my-0 mx-auto min-h-screen pt-4 px-5 pb-30 flex flex-col gap-4.5"><Loading /></div>;
  const { table, restaurant, menu } = info.data;
  const head = (title: string, sub?: string, back?: Step) => (
    <div className="flex items-center gap-2.5 min-h-12">
      {back && <button className="w-11 h-11 flex items-center justify-center border-0 bg-transparent relative rounded-[22px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_.badge]:absolute [&_.badge]:top-2.75 [&_.badge]:right-3 [&_.badge]:w-2 [&_.badge]:h-2 [&_.badge]:rounded-[4px] [&_.badge]:bg-blue2 active:[transform:scale(.98)] -ml-3" onClick={() => setStep(back)} aria-label="Back"><Icon name="back" size={22} /></button>}
      <div className="flex-1 min-w-0"><div className="font-bold text-[18px]">{title}</div>{sub && <div className="text-muted text-[12.5px]">{sub}</div>}</div>
      {token && step !== 'thanks' && <button className="w-11 h-11 flex items-center justify-center border-0 bg-transparent relative rounded-[22px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_.badge]:absolute [&_.badge]:top-2.75 [&_.badge]:right-3 [&_.badge]:w-2 [&_.badge]:h-2 [&_.badge]:rounded-[4px] [&_.badge]:bg-blue2 active:[transform:scale(.98)]" aria-label="Call waiter" onClick={() => call.mutate()}><Icon name="phone" size={22} /></button>}
    </div>
  );

  if (step === 'signin' || step === 'verify') return <SignIn qr={qr} restaurant={restaurant} table={table} step={step} phone={phone} devCode={devCode}
    onSent={(p: string, code?: string) => { setPhone(p); setDevCode(code); setStep('verify'); }} onBack={() => setStep('signin')}
    onVerified={(r: any) => { setToken(r.token); guestSession.set(qr, { token: r.token, name: r.customer.name }); setStep(r.needsName ? 'name' : r.needsGuests ? 'guests' : 'menu'); }} />;

  if (step === 'name') return <NameStep onDone={async (name) => { await g('/guest/me/name', { name }); guestSession.set(qr, { token: token!, name }); setStep('guests'); }} />;

  if (step === 'guests') return (
    <div className="max-w-120 my-0 mx-auto min-h-screen pt-4 px-5 pb-30 flex flex-col gap-4.5">
      {head(`Table ${table.code}`, restaurant.name)}
      <h1 className="m-0 text-[30px] font-bold tracking-[-.4px] phone:text-[26px] mt-10">How many guests?</h1>
      <div className="text-muted">So the kitchen can plate for everyone</div>
      <div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)]">{[1, 2, 3, 4, 5, 6, 8].map((n) => <button key={n} className={(guests === n) ? "on min-w-13 h-12! rounded-[24px]! text-[16px]" : "min-w-13 h-12! rounded-[24px]! text-[16px]"} onClick={() => setGuests(n)}>{n}</button>)}</div>
      <div className="fixed left-0 right-0 bottom-0 pt-3 px-5 pb-[calc(16px_+_env(safe-area-inset-bottom))] bg-[linear-gradient(transparent,_var(--color-bg)_30%)] [&>div]:max-w-110 [&>div]:my-0 [&>div]:mx-auto"><div><button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={async () => { await g('/guest/me/guests', { count: guests }); setStep('menu'); }}>Continue</button></div></div>
    </div>
  );

  if (step === 'menu') return <MenuStep head={head(restaurant.name, `Table ${table.code}`, ses.data?.items.length ? 'track' : undefined)} menu={menu} guestCount={ses.data?.session.guestCount ?? guests} cart={cart} setCart={setCart} onNext={() => setStep('review')} />;

  if (step === 'review') {
    const total = cart.reduce((a, l) => a + l.price * l.qty, 0);
    return <PlaceOrder head={head('Review order', `Table ${table.code}`, 'menu')} cart={cart} setCart={setCart} total={total}
      onPlace={async () => { await g('/guest/me/orders', { items: cart.map(({ dishId, qty, guestNo, spice, options, note }) => ({ dishId, qty, guestNo, spice, options, note })) }); setCart([]); qc.invalidateQueries(); setStep('track'); toast('Order sent to the kitchen'); }} />;
  }

  if (!ses.data) return <div className="max-w-120 my-0 mx-auto min-h-screen pt-4 px-5 pb-30 flex flex-col gap-4.5"><Loading /></div>;
  const s = ses.data;

  if (step === 'track') return (
    <div className="max-w-120 my-0 mx-auto min-h-screen pt-4 px-5 pb-30 flex flex-col gap-4.5">
      {head('Your order', `Table ${table.code} · ${s.session.guestCount} guests`)}
      <div className="flex items-center gap-2.5 flex-wrap gap-y-1.5 gap-x-4">{(['waiting', 'cooking', 'ready', 'served'] as ItemStatus[]).map((k) => <span key={k} className="text-[12.5px] flex items-center gap-1.5"><span className="w-2 h-2 rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)]" style={{ background: STATUS_COLOR[k] }} />{ITEM_LABEL[k]} {s.items.filter((i: any) => i.status === k).length}</span>)}</div>
      <div>{s.items.map((i: any) => <TrackRow key={i.id} i={i} token={token!} />)}</div>
      <div className="text-dim text-[12.5px]">You can change or cancel a dish while it shows Placed. Once the kitchen starts it, ask your waiter.</div>
      <div className="fixed left-0 right-0 bottom-0 pt-3 px-5 pb-[calc(16px_+_env(safe-area-inset-bottom))] bg-[linear-gradient(transparent,_var(--color-bg)_30%)] [&>div]:max-w-110 [&>div]:my-0 [&>div]:mx-auto"><div className="flex items-center gap-2.5"><button className="py-0 px-4.5 font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] bg-transparent border border-edge text-fg w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={() => setStep('menu')}>Order more</button><button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={() => setStep('bill')}>Bill · {rupees(s.totals.total)}</button></div></div>
    </div>
  );

  if (step === 'bill') return <BillStep head={head('Bill', `Table ${table.code}`, 'track')} s={s} onAsk={async (method: string) => { await g('/guest/me/bill', { method }); qc.invalidateQueries(); toast('Your waiter is bringing the bill'); }} />;

  return (
    <div className="max-w-120 my-0 mx-auto min-h-screen pt-4 px-5 pb-30 flex flex-col gap-4.5 justify-center text-center items-center">
      <span className="font-brand font-bold in-[.top]:text-[22px] text-[22px]!">{restaurant.name}</span>
      <h1 className="m-0 text-[30px] font-bold tracking-[-.4px] phone:text-[26px] mt-6">Thank you{guestSession.get(qr)?.name ? ', ' + guestSession.get(qr)!.name : ''}!</h1>
      <div className="text-muted">Paid {rupees(s.totals.total)} · see you again soon</div>
      <button className="h-10 py-0 px-4.5 rounded-[20px] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] bg-transparent border border-edge text-fg active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11 mt-6" onClick={() => { guestSession.clear(qr); setToken(null); setStep('signin'); }}>Done</button>
    </div>
  );
  })();
  return <div key={step} className={(dir.current === 'back') ? "[animation:step-back_250ms_var(--ease)_backwards]" : "[animation:step-fwd_250ms_var(--ease)_backwards]"}>{view}</div>;
}

function SignIn({ qr, restaurant, table, step, phone, devCode, onSent, onVerified, onBack }: any) {
  const [p, setP] = useState(phone); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(['', '', '', '', '', '']); const refs = useRef<(HTMLInputElement | null)[]>([]);
  const send = async () => { setErr(''); setBusy(true); try { const r = await api(`/guest/table/${qr}/start`, { body: { phone: p.replace(/\s/g, '') }, token: null }); onSent(p.replace(/\s/g, ''), r.devCode); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const verify = async (c: string) => { setErr(''); setBusy(true); try { onVerified(await api(`/guest/table/${qr}/verify`, { body: { phone, code: c }, token: null })); } catch (e) { setErr((e as Error).message); setCode(['', '', '', '', '', '']); refs.current[0]?.focus(); } finally { setBusy(false); } };
  if (step === 'signin') return (
    <div className="max-w-120 my-0 mx-auto min-h-screen pt-4 px-5 pb-30 flex flex-col gap-4.5">
      <div className="flex items-center gap-2.5 min-h-12"><span className="font-brand font-bold flex-1 min-w-0 in-[.top]:text-[22px] text-[20px]!">{restaurant.name}</span><span className="text-muted font-semibold">Table {table.code}</span></div>
      <h1 className="m-0 text-[30px] font-bold tracking-[-.4px] phone:text-[26px] mt-8">Welcome</h1>
      <div className="text-muted">Enter your mobile number to see the menu and order from your table.</div>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">Mobile number<input className="w-full py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue h-13 text-[17px]" inputMode="tel" autoFocus placeholder="98765 43210" value={p} onChange={(e) => setP(e.target.value)} /></label>
      {err && <div className="text-red text-[13.5px]">{err}</div>}
      <div className="fixed left-0 right-0 bottom-0 pt-3 px-5 pb-[calc(16px_+_env(safe-area-inset-bottom))] bg-[linear-gradient(transparent,_var(--color-bg)_30%)] [&>div]:max-w-110 [&>div]:my-0 [&>div]:mx-auto"><div><button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" disabled={p.replace(/\D/g, '').length < 10 || busy} onClick={send}>{busy ? 'Sending…' : 'Send code'}</button></div></div>
    </div>
  );
  return (
    <div className="max-w-120 my-0 mx-auto min-h-screen pt-4 px-5 pb-30 flex flex-col gap-4.5">
      <div className="flex items-center gap-2.5 min-h-12"><button className="w-11 h-11 flex items-center justify-center border-0 bg-transparent relative rounded-[22px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_.badge]:absolute [&_.badge]:top-2.75 [&_.badge]:right-3 [&_.badge]:w-2 [&_.badge]:h-2 [&_.badge]:rounded-[4px] [&_.badge]:bg-blue2 active:[transform:scale(.98)] -ml-3" onClick={onBack} aria-label="Back"><Icon name="back" size={22} /></button></div>
      <h1 className="m-0 text-[30px] font-bold tracking-[-.4px] phone:text-[26px]">Enter the code</h1>
      <div className="text-muted">Sent to {phone}{devCode ? ` · demo code ${devCode}` : ''}</div>
      <div className="flex gap-2 [&_input]:w-full [&_input]:h-14 [&_input]:text-center [&_input]:text-[22px] [&_input]:font-bold [&_input]:rounded-[12px] [&_input]:border [&_input]:border-edge [&_input]:bg-chip [&_input]:[outline:0]">{code.map((d, i) => <input key={i} ref={(el) => { refs.current[i] = el; }} inputMode="numeric" maxLength={1} value={d} autoFocus={i === 0} aria-label={`Digit ${i + 1}`}
        onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(-1); const n = [...code]; n[i] = v; setCode(n); if (v && i < 5) refs.current[i + 1]?.focus(); if (n.every(Boolean)) verify(n.join('')); }}
        onKeyDown={(e) => { if (e.key === 'Backspace' && !code[i] && i) refs.current[i - 1]?.focus(); }}
        onPaste={(e) => { const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6); if (t.length === 6) { setCode(t.split('')); verify(t); } }} />)}</div>
      {err && <div className="text-red text-[13.5px]">{err}</div>}
      {busy && <div className="text-dim">Checking…</div>}
    </div>
  );
}

function NameStep({ onDone }: { onDone: (name: string) => void }) {
  const [n, setN] = useState('');
  return (
    <div className="max-w-120 my-0 mx-auto min-h-screen pt-4 px-5 pb-30 flex flex-col gap-4.5">
      <h1 className="m-0 text-[30px] font-bold tracking-[-.4px] phone:text-[26px] mt-14">What should we call you?</h1>
      <input className="w-full py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue h-13 text-[17px]" autoFocus placeholder="Your name" value={n} onChange={(e) => setN(e.target.value)} />
      <div className="fixed left-0 right-0 bottom-0 pt-3 px-5 pb-[calc(16px_+_env(safe-area-inset-bottom))] bg-[linear-gradient(transparent,_var(--color-bg)_30%)] [&>div]:max-w-110 [&>div]:my-0 [&>div]:mx-auto"><div><button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" disabled={!n.trim()} onClick={() => onDone(n.trim())}>Continue</button></div></div>
    </div>
  );
}

function MenuStep({ head, menu, guestCount, cart, setCart, onNext }: any) {
  const [cat, setCat] = useState<number | 'all'>('all'); const [q, setQ] = useState(''); const [pick, setPick] = useState<any>(null);
  const dishes = useMemo(() => menu.flatMap((c: any) => c.dishes.map((d: any) => ({ ...d, category: c.name }))), [menu]);
  const list = dishes.filter((d: any) => (cat === 'all' || d.categoryId === cat) && d.name.toLowerCase().includes(q.toLowerCase()));
  const count = cart.reduce((a: number, l: Line) => a + l.qty, 0);
  const total = cart.reduce((a: number, l: Line) => a + l.qty * l.price, 0);
  return (
    <div className="max-w-120 my-0 mx-auto min-h-screen pt-4 px-5 pb-30 flex flex-col gap-4.5">
      {head}
      <input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" placeholder="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)] flex-nowrap! overflow-x-auto"><button className={(cat === 'all') ? "on" : ""} onClick={() => setCat('all')}>All</button>{menu.map((c: any) => <button key={c.id} className={(cat === c.id) ? "on" : ""} onClick={() => setCat(c.id)}>{c.name}</button>)}</div>
      <div>{list.map((d: any) => (
        <div key={d.id} className="flex gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0 items-start" style={{ opacity: d.available ? 1 : 0.45 }}>
          <span className={(d.veg) ? "w-3 h-3 border-[1.5px] border-green rounded-[2px] inline-flex items-center justify-center flex-none after:content-[''] after:w-1.25 after:h-1.25 after:rounded-[3px] after:bg-green mt-1" : "w-3 h-3 border-[1.5px] rounded-[2px] inline-flex items-center justify-center flex-none after:content-[''] after:w-1.25 after:h-1.25 after:rounded-[3px] border-red after:bg-red mt-1"} />
          <div className="flex-1 min-w-0"><div className="font-semibold">{d.name}</div>{d.description && <div className="text-dim text-[12.5px]">{d.description}</div>}<div className="mt-1">{rupees(d.price)}</div></div>
          {d.available ? <button className="font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] h-9 py-0 px-3.5 rounded-[18px] text-[13.5px] bg-transparent border border-edge text-fg active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={() => setPick(d)}>Add</button> : <span className="text-dim text-[12.5px]">Sold out</span>}
        </div>))}
      </div>
      {count > 0 && <div className="fixed left-0 right-0 bottom-0 pt-3 px-5 pb-[calc(16px_+_env(safe-area-inset-bottom))] bg-[linear-gradient(transparent,_var(--color-bg)_30%)] [&>div]:max-w-110 [&>div]:my-0 [&>div]:mx-auto"><div><button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={onNext}>{count} item{count > 1 ? 's' : ''} · {rupees(total)} · Review</button></div></div>}
      {pick && <GuestCustomise dish={pick} guests={guestCount} onClose={() => setPick(null)} onAdd={(l: any) => { setCart([...cart, { ...l, key: Date.now() }]); setPick(null); }} />}
    </div>
  );
}

function GuestCustomise({ dish, guests, onClose, onAdd }: any) {
  const [qty, setQty] = useState(1); const [guestNo, setGuestNo] = useState(0);
  const [spice, setSpice] = useState<string | null>(dish.hasSpice ? 'Medium' : null);
  const [options, setOptions] = useState<string[]>([]); const [note, setNote] = useState('');
  return (
    <Modal title={dish.name} onClose={onClose}>
      <div className="flex items-center gap-2.5 justify-between"><span className="text-muted">Quantity</span><Stepper value={qty} min={1} max={20} onChange={setQty} /></div>
      {guests > 1 && <div><div className="text-muted text-[12.5px] mb-2">Who is it for?</div><div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)]"><button className={(guestNo === 0) ? "on" : ""} onClick={() => setGuestNo(0)}>Sharing</button>{Array.from({ length: guests }, (_, i) => i + 1).map((n) => <button key={n} className={(guestNo === n) ? "on" : ""} onClick={() => setGuestNo(n)}>Guest {n}</button>)}</div></div>}
      {dish.hasSpice && <div><div className="text-muted text-[12.5px] mb-2">Spice level</div><div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)]">{SPICE.map((s) => <button key={s} className={(spice === s) ? "on" : ""} onClick={() => setSpice(s)}>{s}</button>)}</div></div>}
      {dish.options?.length > 0 && <div><div className="text-muted text-[12.5px] mb-2">Options</div><div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)]">{dish.options.map((o: string) => <button key={o} className={(options.includes(o)) ? "on" : ""} onClick={() => setOptions(options.includes(o) ? options.filter((x) => x !== o) : [...options, o])}>{o}</button>)}</div></div>}
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">Anything else for the kitchen?<textarea className="w-full rounded-[12px] border border-edge bg-chip text-fg [outline:0] h-auto py-3 px-3.5 resize-y focus:border-blue" rows={2} maxLength={200} placeholder="Less oil, no garlic…" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={() => onAdd({ dishId: dish.id, name: dish.name, price: dish.price, qty, guestNo, spice, options, note })}>Add · {rupees(dish.price * qty)}</button>
    </Modal>
  );
}

function PlaceOrder({ head, cart, setCart, total, onPlace }: any) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  return (
    <div className="max-w-120 my-0 mx-auto min-h-screen pt-4 px-5 pb-30 flex flex-col gap-4.5">
      {head}
      <div>{cart.map((l: Line) => (
        <div key={l.key} className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0">
          <div className="flex-1 min-w-0"><div className="font-semibold">{l.name}</div><div className="text-[12.5px] text-taupe">{[l.guestNo ? 'Guest ' + l.guestNo : 'Sharing', l.spice, ...l.options, l.note].filter(Boolean).join(' · ')}</div></div>
          <Stepper value={l.qty} min={0} max={20} onChange={(v) => setCart(v === 0 ? cart.filter((x: Line) => x.key !== l.key) : cart.map((x: Line) => (x.key === l.key ? { ...x, qty: v } : x)))} />
          <span className="w-16 text-right">{rupees(l.price * l.qty)}</span>
        </div>))}
      </div>
      <div className="flex items-center gap-2.5"><span className="text-muted flex-1 min-w-0">Total before tax</span><span className="font-bold text-[18px]">{rupees(total)}</span></div>
      <ErrorText error={err} />
      <div className="fixed left-0 right-0 bottom-0 pt-3 px-5 pb-[calc(16px_+_env(safe-area-inset-bottom))] bg-[linear-gradient(transparent,_var(--color-bg)_30%)] [&>div]:max-w-110 [&>div]:my-0 [&>div]:mx-auto"><div><button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" disabled={!cart.length || busy} onClick={async () => { setBusy(true); setErr(null); try { await onPlace(); } catch (e) { setErr(e); } finally { setBusy(false); } }}>{busy ? 'Sending…' : 'Place order'}</button></div></div>
    </div>
  );
}

function TrackRow({ i, token }: { i: any; token: string }) {
  const qc = useQueryClient(); const toast = useToast();
  const m = useMutation({ mutationFn: (fn: () => Promise<any>) => fn(), onSuccess: () => qc.invalidateQueries(), onError: (e) => toast((e as Error).message) });
  const waiting = i.status === 'waiting';
  return (
    <div className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0" style={{ opacity: i.status === 'cancelled' ? 0.45 : 1 }}>
      <div className="flex-1 min-w-0">
        <div className="font-semibold" style={{ textDecoration: i.status === 'cancelled' ? 'line-through' : undefined }}>{i.qty} × {i.name}</div>
        <div className="text-[12.5px] flex items-center gap-1.5" style={{ color: STATUS_COLOR[i.status] }}><StatusDot color={STATUS_COLOR[i.status]} ready={i.status === 'ready'} />{ITEM_LABEL[i.status as ItemStatus]}{i.guestNo ? <span className="text-dim"> · Guest {i.guestNo}</span> : null}</div>
      </div>
      {waiting && <Stepper value={i.qty} min={1} max={20} onChange={(v) => m.mutate(() => api(`/guest/me/items/${i.id}`, { method: 'PATCH', body: { qty: v }, token }))} />}
      {waiting && <button className="border-0 bg-transparent p-0 font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] text-red in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]" onClick={() => m.mutate(() => api(`/guest/me/items/${i.id}`, { method: 'DELETE', token }))}>Cancel</button>}
    </div>
  );
}

function BillStep({ head, s, onAsk }: any) {
  const [method, setMethod] = useState('upi');
  const lines = s.items.filter((i: any) => i.status !== 'cancelled');
  const asked = s.session.status === 'billing';
  return (
    <div className="max-w-120 my-0 mx-auto min-h-screen pt-4 px-5 pb-30 flex flex-col gap-4.5">
      {head}
      <div>{lines.map((i: any) => <div key={i.id} className="flex items-center gap-3.5 border-b border-b-line stagger last:border-b-0 py-2.5 px-0"><span className="flex-1 min-w-0">{i.qty} × {i.name}</span><span>{rupees(i.unitPrice * i.qty)}</span></div>)}</div>
      <div className="flex items-center gap-2.5"><span className="text-muted flex-1 min-w-0">Subtotal</span>{rupees(s.totals.subtotal)}</div>
      <div className="flex items-center gap-2.5"><span className="text-muted flex-1 min-w-0">Tax {s.taxPercent}%</span>{rupees(s.totals.tax)}</div>
      <div className="flex items-center gap-2.5"><span className="font-bold flex-1 min-w-0 text-[18px]">Total</span><span className="font-bold text-[24px]">{rupees(s.totals.total)}</span></div>
      {asked ? <div className="text-green font-semibold">Your waiter is bringing the bill. Pay at the table.</div> : <>
        <div className="text-muted text-[12.5px]">How will you pay?</div>
        <div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)]">{['upi', 'card', 'cash'].map((m) => <button key={m} className={(method === m) ? "on" : ""} onClick={() => setMethod(m)}>{m.toUpperCase()}</button>)}</div>
        <div className="fixed left-0 right-0 bottom-0 pt-3 px-5 pb-[calc(16px_+_env(safe-area-inset-bottom))] bg-[linear-gradient(transparent,_var(--color-bg)_30%)] [&>div]:max-w-110 [&>div]:my-0 [&>div]:mx-auto"><div><button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={() => onAsk(method)}>Ask for the bill</button></div></div>
      </>}
    </div>
  );
}
