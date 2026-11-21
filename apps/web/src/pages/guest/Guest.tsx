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
  if (info.error) return <div className="phone"><div className="err" style={{ marginTop: 80 }}>{(info.error as Error).message}</div></div>;
  if (!info.data) return <div className="phone"><Loading /></div>;
  const { table, restaurant, menu } = info.data;
  const head = (title: string, sub?: string, back?: Step) => (
    <div className="row-flex" style={{ minHeight: 48 }}>
      {back && <button className="iconbtn" style={{ marginLeft: -12 }} onClick={() => setStep(back)} aria-label="Back"><Icon name="back" size={22} /></button>}
      <div className="grow"><div className="bb" style={{ fontSize: 18 }}>{title}</div>{sub && <div className="muted small">{sub}</div>}</div>
      {token && step !== 'thanks' && <button className="iconbtn" aria-label="Call waiter" onClick={() => call.mutate()}><Icon name="phone" size={22} /></button>}
    </div>
  );

  if (step === 'signin' || step === 'verify') return <SignIn qr={qr} restaurant={restaurant} table={table} step={step} phone={phone} devCode={devCode}
    onSent={(p: string, code?: string) => { setPhone(p); setDevCode(code); setStep('verify'); }} onBack={() => setStep('signin')}
    onVerified={(r: any) => { setToken(r.token); guestSession.set(qr, { token: r.token, name: r.customer.name }); setStep(r.needsName ? 'name' : r.needsGuests ? 'guests' : 'menu'); }} />;

  if (step === 'name') return <NameStep onDone={async (name) => { await g('/guest/me/name', { name }); guestSession.set(qr, { token: token!, name }); setStep('guests'); }} />;

  if (step === 'guests') return (
    <div className="phone">
      {head(`Table ${table.code}`, restaurant.name)}
      <h1 className="title" style={{ marginTop: 40 }}>How many guests?</h1>
      <div className="muted">So the kitchen can plate for everyone</div>
      <div className="pills">{[1, 2, 3, 4, 5, 6, 8].map((n) => <button key={n} className={guests === n ? 'on' : ''} style={{ minWidth: 52, height: 48, borderRadius: 24, fontSize: 16 }} onClick={() => setGuests(n)}>{n}</button>)}</div>
      <div className="bottom-bar"><div><button className="btn block" onClick={async () => { await g('/guest/me/guests', { count: guests }); setStep('menu'); }}>Continue</button></div></div>
    </div>
  );

  if (step === 'menu') return <MenuStep head={head(restaurant.name, `Table ${table.code}`, ses.data?.items.length ? 'track' : undefined)} menu={menu} guestCount={ses.data?.session.guestCount ?? guests} cart={cart} setCart={setCart} onNext={() => setStep('review')} />;

  if (step === 'review') {
    const total = cart.reduce((a, l) => a + l.price * l.qty, 0);
    return <PlaceOrder head={head('Review order', `Table ${table.code}`, 'menu')} cart={cart} setCart={setCart} total={total}
      onPlace={async () => { await g('/guest/me/orders', { items: cart.map(({ dishId, qty, guestNo, spice, options, note }) => ({ dishId, qty, guestNo, spice, options, note })) }); setCart([]); qc.invalidateQueries(); setStep('track'); toast('Order sent to the kitchen'); }} />;
  }

  if (!ses.data) return <div className="phone"><Loading /></div>;
  const s = ses.data;

  if (step === 'track') return (
    <div className="phone">
      {head('Your order', `Table ${table.code} · ${s.session.guestCount} guests`)}
      <div className="row-flex wrap" style={{ gap: '6px 16px' }}>{(['waiting', 'cooking', 'ready', 'served'] as ItemStatus[]).map((k) => <span key={k} className="row-flex small" style={{ gap: 6 }}><span className="dot" style={{ background: STATUS_COLOR[k] }} />{ITEM_LABEL[k]} {s.items.filter((i: any) => i.status === k).length}</span>)}</div>
      <div>{s.items.map((i: any) => <TrackRow key={i.id} i={i} token={token!} />)}</div>
      <div className="dim small">You can change or cancel a dish while it shows Placed. Once the kitchen starts it, ask your waiter.</div>
      <div className="bottom-bar"><div className="row-flex"><button className="btn ghost block" onClick={() => setStep('menu')}>Order more</button><button className="btn block" onClick={() => setStep('bill')}>Bill · {rupees(s.totals.total)}</button></div></div>
    </div>
  );

  if (step === 'bill') return <BillStep head={head('Bill', `Table ${table.code}`, 'track')} s={s} onAsk={async (method: string) => { await g('/guest/me/bill', { method }); qc.invalidateQueries(); toast('Your waiter is bringing the bill'); }} />;

  return (
    <div className="phone" style={{ justifyContent: 'center', textAlign: 'center', alignItems: 'center' }}>
      <span className="brand" style={{ fontSize: 22 }}>{restaurant.name}</span>
      <h1 className="title" style={{ marginTop: 24 }}>Thank you{guestSession.get(qr)?.name ? ', ' + guestSession.get(qr)!.name : ''}!</h1>
      <div className="muted">Paid {rupees(s.totals.total)} · see you again soon</div>
      <button className="btn ghost" style={{ marginTop: 24 }} onClick={() => { guestSession.clear(qr); setToken(null); setStep('signin'); }}>Done</button>
    </div>
  );
  })();
  return <div key={step} className={dir.current === 'back' ? 'step-back' : 'step-fwd'}>{view}</div>;
}

function SignIn({ qr, restaurant, table, step, phone, devCode, onSent, onVerified, onBack }: any) {
  const [p, setP] = useState(phone); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(['', '', '', '', '', '']); const refs = useRef<(HTMLInputElement | null)[]>([]);
  const send = async () => { setErr(''); setBusy(true); try { const r = await api(`/guest/table/${qr}/start`, { body: { phone: p.replace(/\s/g, '') }, token: null }); onSent(p.replace(/\s/g, ''), r.devCode); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const verify = async (c: string) => { setErr(''); setBusy(true); try { onVerified(await api(`/guest/table/${qr}/verify`, { body: { phone, code: c }, token: null })); } catch (e) { setErr((e as Error).message); setCode(['', '', '', '', '', '']); refs.current[0]?.focus(); } finally { setBusy(false); } };
  if (step === 'signin') return (
    <div className="phone">
      <div className="row-flex" style={{ minHeight: 48 }}><span className="brand grow" style={{ fontSize: 20 }}>{restaurant.name}</span><span className="muted b">Table {table.code}</span></div>
      <h1 className="title" style={{ marginTop: 32 }}>Welcome</h1>
      <div className="muted">Enter your mobile number to see the menu and order from your table.</div>
      <label className="field">Mobile number<input className="input" style={{ height: 52, fontSize: 17 }} inputMode="tel" autoFocus placeholder="98765 43210" value={p} onChange={(e) => setP(e.target.value)} /></label>
      {err && <div className="err">{err}</div>}
      <div className="bottom-bar"><div><button className="btn block" disabled={p.replace(/\D/g, '').length < 10 || busy} onClick={send}>{busy ? 'Sending…' : 'Send code'}</button></div></div>
    </div>
  );
  return (
    <div className="phone">
      <div className="row-flex" style={{ minHeight: 48 }}><button className="iconbtn" style={{ marginLeft: -12 }} onClick={onBack} aria-label="Back"><Icon name="back" size={22} /></button></div>
      <h1 className="title">Enter the code</h1>
      <div className="muted">Sent to {phone}{devCode ? ` · demo code ${devCode}` : ''}</div>
      <div className="otp">{code.map((d, i) => <input key={i} ref={(el) => { refs.current[i] = el; }} inputMode="numeric" maxLength={1} value={d} autoFocus={i === 0} aria-label={`Digit ${i + 1}`}
        onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(-1); const n = [...code]; n[i] = v; setCode(n); if (v && i < 5) refs.current[i + 1]?.focus(); if (n.every(Boolean)) verify(n.join('')); }}
        onKeyDown={(e) => { if (e.key === 'Backspace' && !code[i] && i) refs.current[i - 1]?.focus(); }}
        onPaste={(e) => { const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6); if (t.length === 6) { setCode(t.split('')); verify(t); } }} />)}</div>
      {err && <div className="err">{err}</div>}
      {busy && <div className="dim">Checking…</div>}
    </div>
  );
}

function NameStep({ onDone }: { onDone: (name: string) => void }) {
  const [n, setN] = useState('');
  return (
    <div className="phone">
      <h1 className="title" style={{ marginTop: 56 }}>What should we call you?</h1>
      <input className="input" style={{ height: 52, fontSize: 17 }} autoFocus placeholder="Your name" value={n} onChange={(e) => setN(e.target.value)} />
      <div className="bottom-bar"><div><button className="btn block" disabled={!n.trim()} onClick={() => onDone(n.trim())}>Continue</button></div></div>
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
    <div className="phone">
      {head}
      <input className="input" placeholder="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="pills" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}><button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>All</button>{menu.map((c: any) => <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>{c.name}</button>)}</div>
      <div>{list.map((d: any) => (
        <div key={d.id} className="row" style={{ alignItems: 'flex-start', opacity: d.available ? 1 : 0.45 }}>
          <span className={`veg ${d.veg ? '' : 'non'}`} style={{ marginTop: 4 }} />
          <div className="grow"><div className="b">{d.name}</div>{d.description && <div className="dim small">{d.description}</div>}<div style={{ marginTop: 4 }}>{rupees(d.price)}</div></div>
          {d.available ? <button className="btn ghost sm" onClick={() => setPick(d)}>Add</button> : <span className="dim small">Sold out</span>}
        </div>))}
      </div>
      {count > 0 && <div className="bottom-bar"><div><button className="btn block" onClick={onNext}>{count} item{count > 1 ? 's' : ''} · {rupees(total)} · Review</button></div></div>}
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
      <div className="row-flex" style={{ justifyContent: 'space-between' }}><span className="muted">Quantity</span><Stepper value={qty} min={1} max={20} onChange={setQty} /></div>
      {guests > 1 && <div><div className="muted small" style={{ marginBottom: 8 }}>Who is it for?</div><div className="pills"><button className={guestNo === 0 ? 'on' : ''} onClick={() => setGuestNo(0)}>Sharing</button>{Array.from({ length: guests }, (_, i) => i + 1).map((n) => <button key={n} className={guestNo === n ? 'on' : ''} onClick={() => setGuestNo(n)}>Guest {n}</button>)}</div></div>}
      {dish.hasSpice && <div><div className="muted small" style={{ marginBottom: 8 }}>Spice level</div><div className="pills">{SPICE.map((s) => <button key={s} className={spice === s ? 'on' : ''} onClick={() => setSpice(s)}>{s}</button>)}</div></div>}
      {dish.options?.length > 0 && <div><div className="muted small" style={{ marginBottom: 8 }}>Options</div><div className="pills">{dish.options.map((o: string) => <button key={o} className={options.includes(o) ? 'on' : ''} onClick={() => setOptions(options.includes(o) ? options.filter((x) => x !== o) : [...options, o])}>{o}</button>)}</div></div>}
      <label className="field">Anything else for the kitchen?<textarea className="input" rows={2} maxLength={200} placeholder="Less oil, no garlic…" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <button className="btn block" onClick={() => onAdd({ dishId: dish.id, name: dish.name, price: dish.price, qty, guestNo, spice, options, note })}>Add · {rupees(dish.price * qty)}</button>
    </Modal>
  );
}

function PlaceOrder({ head, cart, setCart, total, onPlace }: any) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  return (
    <div className="phone">
      {head}
      <div>{cart.map((l: Line) => (
        <div key={l.key} className="row">
          <div className="grow"><div className="b">{l.name}</div><div className="taupe small">{[l.guestNo ? 'Guest ' + l.guestNo : 'Sharing', l.spice, ...l.options, l.note].filter(Boolean).join(' · ')}</div></div>
          <Stepper value={l.qty} min={0} max={20} onChange={(v) => setCart(v === 0 ? cart.filter((x: Line) => x.key !== l.key) : cart.map((x: Line) => (x.key === l.key ? { ...x, qty: v } : x)))} />
          <span style={{ width: 64, textAlign: 'right' }}>{rupees(l.price * l.qty)}</span>
        </div>))}
      </div>
      <div className="row-flex"><span className="muted grow">Total before tax</span><span className="bb" style={{ fontSize: 18 }}>{rupees(total)}</span></div>
      <ErrorText error={err} />
      <div className="bottom-bar"><div><button className="btn block" disabled={!cart.length || busy} onClick={async () => { setBusy(true); setErr(null); try { await onPlace(); } catch (e) { setErr(e); } finally { setBusy(false); } }}>{busy ? 'Sending…' : 'Place order'}</button></div></div>
    </div>
  );
}

function TrackRow({ i, token }: { i: any; token: string }) {
  const qc = useQueryClient(); const toast = useToast();
  const m = useMutation({ mutationFn: (fn: () => Promise<any>) => fn(), onSuccess: () => qc.invalidateQueries(), onError: (e) => toast((e as Error).message) });
  const waiting = i.status === 'waiting';
  return (
    <div className="row" style={{ opacity: i.status === 'cancelled' ? 0.45 : 1 }}>
      <div className="grow">
        <div className="b" style={{ textDecoration: i.status === 'cancelled' ? 'line-through' : undefined }}>{i.qty} × {i.name}</div>
        <div className="small row-flex" style={{ gap: 6, color: STATUS_COLOR[i.status] }}><StatusDot color={STATUS_COLOR[i.status]} ready={i.status === 'ready'} />{ITEM_LABEL[i.status as ItemStatus]}{i.guestNo ? <span className="dim"> · Guest {i.guestNo}</span> : null}</div>
      </div>
      {waiting && <Stepper value={i.qty} min={1} max={20} onChange={(v) => m.mutate(() => api(`/guest/me/items/${i.id}`, { method: 'PATCH', body: { qty: v }, token }))} />}
      {waiting && <button className="link red" onClick={() => m.mutate(() => api(`/guest/me/items/${i.id}`, { method: 'DELETE', token }))}>Cancel</button>}
    </div>
  );
}

function BillStep({ head, s, onAsk }: any) {
  const [method, setMethod] = useState('upi');
  const lines = s.items.filter((i: any) => i.status !== 'cancelled');
  const asked = s.session.status === 'billing';
  return (
    <div className="phone">
      {head}
      <div>{lines.map((i: any) => <div key={i.id} className="row" style={{ padding: '10px 0' }}><span className="grow">{i.qty} × {i.name}</span><span>{rupees(i.unitPrice * i.qty)}</span></div>)}</div>
      <div className="row-flex"><span className="muted grow">Subtotal</span>{rupees(s.totals.subtotal)}</div>
      <div className="row-flex"><span className="muted grow">Tax {s.taxPercent}%</span>{rupees(s.totals.tax)}</div>
      <div className="row-flex"><span className="bb grow" style={{ fontSize: 18 }}>Total</span><span className="bb" style={{ fontSize: 24 }}>{rupees(s.totals.total)}</span></div>
      {asked ? <div className="green b">Your waiter is bringing the bill. Pay at the table.</div> : <>
        <div className="muted small">How will you pay?</div>
        <div className="pills">{['upi', 'card', 'cash'].map((m) => <button key={m} className={method === m ? 'on' : ''} onClick={() => setMethod(m)}>{m.toUpperCase()}</button>)}</div>
        <div className="bottom-bar"><div><button className="btn block" onClick={() => onAsk(method)}>Ask for the bill</button></div></div>
      </>}
    </div>
  );
}
