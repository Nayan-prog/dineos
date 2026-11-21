import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { rupees, SPICE, TASK_LABEL, type TaskKind } from '@dineos/shared';
import { api, session, useTick } from '../../api';
import { ago, ErrorText, Icon, Loading, Modal, Sec, Stepper, TABLE_STATE, Title, useIsMobile, useMe, useToast, StatusDot } from '../../ui';
import { TakeOrderM, WaiterAlertsM, WaiterHomeM } from './mobile';
import { tableRange as tableRangeOf } from '../../ui';

const KIND_COLOR: Record<TaskKind, string> = { food_ready: 'var(--green)', call: 'var(--blue)', bill: 'var(--taupe)' };

function useTasks() {
  return useQuery({ queryKey: ['tasks'], queryFn: () => api('/team/tasks'), refetchInterval: 10000 });
}
function useTaskActions() {
  const qc = useQueryClient(); const toast = useToast();
  return useMutation({
    mutationFn: ([id, what]: [number, 'take' | 'done']) => api(`/team/tasks/${id}/${what}`, { body: {} }),
    // the button reacts at once; the server answer (or a rollback) follows
    onMutate: async ([id, what]) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const prev = qc.getQueryData(['tasks']) as any;
      if (prev) qc.setQueryData(['tasks'], { ...prev, tasks: prev.tasks.map((t: any) => (t.id === id ? (what === 'take' ? { ...t, status: 'taken', mine: true } : { ...t, status: 'done' }) : t)) });
      return { prev };
    },
    onError: (e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['tasks'], ctx.prev); toast((e as Error).message); },
    onSettled: () => qc.invalidateQueries(),
  });
}
function origin(t: any, rules: any) {
  if (t.level === 0) return [`Your table · passes on in ${Math.max(0, rules.areaSecs - Math.round((Date.now() - new Date(t.createdAt).getTime()) / 1000))} s`, 'var(--dim)'];
  if (t.ownTable) return ['Your table · now with the whole area', 'var(--amber)'];
  if (t.level === 2) return [`Passed on from ${t.assignedName?.split(' ')[0] ?? 'nobody'} · manager alerted`, 'var(--red)'];
  return [`Passed on from ${t.assignedName?.split(' ')[0] ?? 'nobody'} · no reply in time`, 'var(--amber)'];
}

function DutyButton() {
  const me = useMe(); const qc = useQueryClient();
  const staff = useQuery({ queryKey: ['me'], queryFn: () => api('/auth/me') });
  const onBreak = staff.data?.staff.onBreak ?? me.onBreak;
  const m = useMutation({ mutationFn: () => api(`/team/staff/${me.id}`, { method: 'PATCH', body: { onBreak: !onBreak } }), onSuccess: () => qc.invalidateQueries() });
  return <button className="btn ghost sm" onClick={() => m.mutate()} style={{ color: onBreak ? 'var(--amber)' : 'var(--green)' }}><span className="dot" style={{ background: onBreak ? 'var(--amber)' : 'var(--green)' }} />{onBreak ? 'On break · tap to resume' : 'On duty'}</button>;
}

export function WaiterHome() {
  useTick(5000);
  const me = useMe();
  const mobile = useIsMobile();
  const tables = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables') });
  const tasks = useTasks(); const act = useTaskActions();
  const open = (tasks.data?.tasks ?? []).filter((t: any) => t.status === 'open');
  const mine = (tasks.data?.tasks ?? []).filter((t: any) => t.status === 'taken' && t.mine);
  const ts = tables.data?.tables ?? [];
  const hour = new Date().getHours();
  if (mobile) return <WaiterHomeM tasks={tasks.data} act={(id, what) => act.mutate([id, what])} />;
  return (
    <>
      <Title title={`Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, ${me.name.split(' ')[0]}`} sub={`Tables ${ts.map((t: any) => t.code).join(', ') || 'not assigned yet'}`}
        right={<div className="row-flex"><DutyButton /><Link to="/w/take-order" className="btn"><Icon name="plus" size={18} sw={2} />Take order</Link></div>} />
      <div className="kpis">{[['Tables in use', ts.filter((t: any) => t.state !== 'free').length], ['Food ready', ts.reduce((a: number, t: any) => a + t.ready, 0)], ['Alerts', open.length], ['Waiting for bill', ts.filter((t: any) => t.state === 'billing').length]].map(([l, v]) => <div key={l as string}><div className="kpi-l">{l}</div><div className="kpi-v">{v}</div></div>)}</div>
      <div className="cols" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(260px, 1fr)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Sec title="Needs someone" n={open.length} right={<Link to="/w/alerts" className="link">All alerts</Link>}>
            {open.length === 0 && <div className="empty">All clear</div>}
            {open.slice(0, 5).map((t: any) => <TaskRow key={t.id} t={t} rules={tasks.data.rules} onTake={() => act.mutate([t.id, 'take'])} />)}
          </Sec>
          {mine.length > 0 && <Sec title="I'm handling" n={mine.length}>{mine.map((t: any) => <MineRow key={t.id} t={t} onDone={() => act.mutate([t.id, 'done'])} />)}</Sec>}
        </div>
        <Sec title="My tables">
          <div className="grid-tables" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
            {ts.map((t: any) => { const [l, c] = TABLE_STATE[t.state]; return <Link key={t.id} to="/w/table/$id" params={{ id: String(t.id) }} className="tile" style={{ minHeight: 64, boxShadow: `inset 0 0 0 1px ${t.state === 'free' ? 'transparent' : c}` }}><span className="row-flex"><span className="bb">{t.code}</span><span className="grow" /><span className="dot" style={{ background: c }} /></span><span className="dim" style={{ fontSize: 11.5 }}>{t.state === 'free' ? `${t.seats} seats` : `${t.guests} guests · ${l}`}</span></Link>; })}
          </div>
        </Sec>
      </div>
    </>
  );
}

function TaskRow({ t, rules, onTake }: { t: any; rules: any; onTake: () => void }) {
  const [o, c] = origin(t, rules);
  return (
    <div className="row" style={{ padding: '16px 0' }}>
      <StatusDot color={KIND_COLOR[t.kind as TaskKind]} ready />
      <span className="bb" style={{ width: 44, fontSize: 17 }}>{t.table}</span>
      <div className="grow"><div className="b">{TASK_LABEL[t.kind as TaskKind]} <span className="muted" style={{ fontWeight: 500 }}>· {t.detail}</span></div><div className="small" style={{ color: c }}>{o}</div></div>
      <button className="btn sm" onClick={onTake}>On it</button>
    </div>
  );
}
function MineRow({ t, onDone }: { t: any; onDone: () => void }) {
  return (
    <div className="row" style={{ padding: '16px 0' }}>
      <span className="dot" style={{ background: KIND_COLOR[t.kind as TaskKind] }} />
      <span className="bb" style={{ width: 44, fontSize: 17 }}>{t.table}</span>
      <div className="grow b">{TASK_LABEL[t.kind as TaskKind]} <span className="muted" style={{ fontWeight: 500 }}>· {t.detail}</span></div>
      {t.kind === 'bill' ? <Link to="/w/table/$id" params={{ id: String(t.tableId) }} className="btn ghost sm">Open bill</Link> : <button className="btn ghost sm" onClick={onDone}>Done</button>}
    </div>
  );
}

export function Alerts() {
  useTick(5000);
  const me = useMe();
  const mobile = useIsMobile();
  const tasks = useTasks(); const act = useTaskActions();
  const staff = useQuery({ queryKey: ['me'], queryFn: () => api('/auth/me') });
  const tables = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables'), enabled: mobile });
  if (mobile) { const l: any[] = tables.data?.tables ?? []; return <WaiterAlertsM tasks={tasks.data} act={(id, what) => act.mutate([id, what])} sub={l.length ? `${tableRangeOf(l.map((t) => t.code))} · ${l[0].area}` : undefined} />; }
  if (!tasks.data) return <Loading />;
  const all = tasks.data.tasks;
  const open = all.filter((t: any) => t.status === 'open');
  const mine = all.filter((t: any) => t.status === 'taken' && t.mine);
  const others = all.filter((t: any) => t.status === 'taken' && !t.mine);
  const r = tasks.data.rules;
  return (
    <>
      <Title title="Alerts" sub="The first person to tap On it takes the alert" right={<DutyButton />} />
      <div className="cols" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(260px, 1fr)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <Sec title="Needs someone" n={open.length}>{open.length === 0 && <div className="empty">All clear</div>}{open.map((t: any) => <TaskRow key={t.id} t={t} rules={r} onTake={() => act.mutate([t.id, 'take'])} />)}</Sec>
          <Sec title="I'm handling" n={mine.length}>{mine.length === 0 && <div className="dim">Nothing yet. Tap On it to take an alert.</div>}{mine.map((t: any) => <MineRow key={t.id} t={t} onDone={() => act.mutate([t.id, 'done'])} />)}</Sec>
          {others.length > 0 && <Sec title="Taken by others">{others.map((t: any) => <div key={t.id} className="row dim"><span className="bb" style={{ width: 44, marginLeft: 22 }}>{t.table}</span><span>{TASK_LABEL[t.kind as TaskKind]} · {t.takenName?.split(' ')[0]} is on it</span></div>)}</Sec>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <Sec title="How an alert moves">
            {[['1', 'Your waiter', 'Goes to the waiter who owns the table', `0 to ${r.areaSecs} s`], ['2', 'Free waiters in the area', 'Everyone on duty in the same area sees it', `${r.areaSecs} to ${r.managerSecs} s`], ['3', 'Manager', 'Nobody took it, the manager is alerted', `After ${r.managerSecs} s`]].map(([n, a, b, c], i) => (
              <div key={n} className="row-flex" style={{ alignItems: 'flex-start', gap: 14, padding: '12px 0', borderTop: i ? '1px solid var(--line2)' : 0 }}>
                <span style={{ width: 26, height: 26, borderRadius: 13, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', flex: 'none' }}>{n}</span>
                <div className="grow"><div className="row-flex"><span className="b grow">{a}</span><span className="dim small">{c}</span></div><div className="dim small">{b}</div></div>
              </div>
            ))}
          </Sec>
          <Sec title="Covering tonight">
            <div className="row"><span className="muted grow">Status</span><span className="b">{staff.data?.staff.onBreak ? 'On break' : 'On duty'}</span></div>
            <div className="row"><span className="muted grow">Signed in as</span><span className="b">{me.name}</span></div>
          </Sec>
        </div>
      </div>
    </>
  );
}

// ---------------- Take order (POS) ----------------
type Line = { key: number; dishId: number; name: string; price?: number; qty: number; guestNo: number; spice: string | null; options: string[]; note: string };

/** Phone: the app's take-order flow. Desktop: the two-column POS below. */
export function TakeOrder() { return useIsMobile() ? <TakeOrderM /> : <TakeOrderDesktop />; }

function TakeOrderDesktop() {
  const search = useSearch({ strict: false }) as { table?: number };
  const qc = useQueryClient(); const toast = useToast(); const nav = useNavigate();
  const tables = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables') });
  const menu = useQuery({ queryKey: ['menu'], queryFn: () => api('/floor/menu') });
  const [tableId, setTableId] = useState<number | null>(search.table ? Number(search.table) : null);
  const [guests, setGuests] = useState<number | null>(null);
  const [cat, setCat] = useState<number | 'all'>('all');
  const [q, setQ] = useState('');
  const [cart, setCart] = useState<Line[]>([]);
  const [pick, setPick] = useState<any | null>(null);
  const table = tables.data?.tables.find((t: any) => t.id === tableId);
  const g = guests ?? (table?.guests || 2);
  const dishes = useMemo(() => (menu.data ?? []).flatMap((c: any) => c.dishes), [menu.data]);
  const list = dishes.filter((d: any) => (cat === 'all' || d.categoryId === cat) && d.name.toLowerCase().includes(q.toLowerCase()));
  const send = useMutation({
    mutationFn: async () => {
      let sessionId = table.sessionId;
      if (!sessionId || guests) sessionId = (await api('/floor/sessions', { body: { tableId, guestCount: g } })).id;
      return api('/floor/orders', { body: { sessionId, items: cart.map(({ dishId, qty, guestNo, spice, options, note }) => ({ dishId, qty, guestNo, spice, options, note })) } });
    },
    onSuccess: () => { qc.invalidateQueries(); toast(`Sent to the kitchen · ${cart.length} dishes for ${table.code}`); setCart([]); nav({ to: '/w/table/$id', params: { id: String(tableId) } }); },
  });
  const total = cart.reduce((a, l) => a + (l.price ?? 0) * l.qty, 0);
  const byGuest = [...new Set(cart.map((l) => l.guestNo))].sort((a, b) => a - b);
  if (!tables.data || !menu.data) return <Loading />;
  return (
    <>
      <Title title="Take order" sub={table ? `${table.code} · ${table.seats} seats` : 'Pick a table'} />
      <div className="cols" style={{ gridTemplateColumns: 'minmax(0, 1.7fr) minmax(300px, 1fr)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="pills">{tables.data.tables.map((t: any) => <button key={t.id} className={tableId === t.id ? 'on' : ''} onClick={() => { setTableId(t.id); setGuests(null); }}>{t.code}{t.state !== 'free' ? ' ·' + t.guests : ''}</button>)}</div>
          {tables.data.tables.length === 0 && <div className="empty">No tables assigned to you yet. Ask the manager.</div>}
          {table && <div className="row-flex" style={{ gap: 16 }}><span className="muted">Guests at {table.code}</span><Stepper value={g} min={1} max={30} onChange={setGuests} /></div>}
          <input className="input" placeholder="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="pills"><button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>All</button>{menu.data.map((c: any) => <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>{c.name}</button>)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
            {list.map((d: any) => (
              <button key={d.id} className="tile" disabled={!d.available || !table} onClick={() => setPick(d)} style={{ minHeight: 84 }}>
                <span className="row-flex" style={{ alignItems: 'flex-start' }}><span className={`veg ${d.veg ? '' : 'non'}`} style={{ marginTop: 3 }} /><span className="b grow">{d.name}</span></span>
                <span className="row-flex"><span className="muted small grow">{d.available ? `${d.prepMinutes} min` : 'Out of stock'}</span>{'price' in d && <span className="b">{rupees(d.price)}</span>}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 className="sec-h">Order{table ? ` · ${table.code}` : ''}<span className="n">{cart.reduce((a, l) => a + l.qty, 0)} items</span></h2>
          {cart.length === 0 && <div className="empty">Tap a dish to add it</div>}
          {byGuest.map((gn) => (
            <div key={gn}>
              <div className="dim small b" style={{ marginBottom: 2 }}>{gn ? `Guest ${gn}` : 'Shared'}</div>
              {cart.filter((l) => l.guestNo === gn).map((l) => (
                <div key={l.key} className="row" style={{ padding: '10px 0' }}>
                  <div className="grow"><div className="b">{l.qty} × {l.name}</div>{(l.spice || l.note || l.options.length > 0) && <div className="taupe small">{[l.spice, ...l.options, l.note].filter(Boolean).join(' · ')}</div>}</div>
                  {l.price != null && <span>{rupees(l.price * l.qty)}</span>}
                  <button className="link red" onClick={() => setCart(cart.filter((x) => x.key !== l.key))}>Remove</button>
                </div>
              ))}
            </div>
          ))}
          {cart.length > 0 && total > 0 && <div className="row-flex"><span className="muted grow">Total before tax</span><span className="bb" style={{ fontSize: 18 }}>{rupees(total)}</span></div>}
          <ErrorText error={send.error} />
          <button className="btn block" disabled={!table || !cart.length || send.isPending} onClick={() => send.mutate()}>{send.isPending ? 'Sending…' : 'Send to kitchen'}</button>
        </div>
      </div>
      {pick && <Customise dish={pick} guests={g} onClose={() => setPick(null)} onAdd={(l) => { setCart([...cart, { ...l, key: Date.now() }]); setPick(null); }} />}
    </>
  );
}

export function Customise({ dish, guests, onClose, onAdd }: { dish: any; guests: number; onClose: () => void; onAdd: (l: Omit<Line, 'key'>) => void }) {
  const [qty, setQty] = useState(1); const [guestNo, setGuestNo] = useState(0);
  const [spice, setSpice] = useState<string | null>(dish.hasSpice ? 'Medium' : null);
  const [options, setOptions] = useState<string[]>([]); const [note, setNote] = useState('');
  return (
    <Modal title={dish.name} onClose={onClose}>
      {dish.description && <div className="muted">{dish.description}</div>}
      <div className="row-flex" style={{ justifyContent: 'space-between' }}><span className="muted">Quantity</span><Stepper value={qty} min={1} max={50} onChange={setQty} /></div>
      {guests > 0 && <div><div className="muted small" style={{ marginBottom: 8 }}>For</div><div className="pills"><button className={guestNo === 0 ? 'on' : ''} onClick={() => setGuestNo(0)}>Shared</button>{Array.from({ length: guests }, (_, i) => i + 1).map((n) => <button key={n} className={guestNo === n ? 'on' : ''} onClick={() => setGuestNo(n)}>G{n}</button>)}</div></div>}
      {dish.hasSpice && <div><div className="muted small" style={{ marginBottom: 8 }}>Spice level</div><div className="pills">{SPICE.map((s) => <button key={s} className={spice === s ? 'on' : ''} onClick={() => setSpice(s)}>{s}</button>)}</div></div>}
      {dish.options?.length > 0 && <div><div className="muted small" style={{ marginBottom: 8 }}>Options</div><div className="pills">{dish.options.map((o: string) => <button key={o} className={options.includes(o) ? 'on' : ''} onClick={() => setOptions(options.includes(o) ? options.filter((x) => x !== o) : [...options, o])}>{o}</button>)}</div></div>}
      <label className="field">Note for the kitchen<textarea className="input" rows={2} maxLength={200} placeholder="Less oil, no garlic…" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <button className="btn block" onClick={() => onAdd({ dishId: dish.id, name: dish.name, price: dish.price, qty, guestNo, spice, options, note })}>Add {qty} to order{dish.price != null ? ' · ' + rupees(dish.price * qty) : ''}</button>
    </Modal>
  );
}

export const myId = () => session.get()?.staff.id;
