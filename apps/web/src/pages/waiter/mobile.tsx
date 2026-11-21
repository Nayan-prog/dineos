import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ITEM_LABEL, rupees, SPICE, TASK_LABEL, type ItemStatus, type TaskKind } from '@dineos/shared';
import { api, session } from '../../api';
import { since, useNotifications } from '../../notify';
import { Icon, Loading, Modal, StatusDot, useMe, useToast, useWaiter } from '../../ui';
import { Chips, MHead, MSec, MTSTATE } from '../manager/mobile';

/** Phone layouts for the waiter pages. They mirror apps/mobile/app/waiter/* and the MW-Waiter-*.dc.html designs.
 *  Data and mutations come from the same queries the desktop pages use. */

const mins = (d: string | null) => (d ? Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000)) : 0);
const Empty = ({ children, center }: { children: ReactNode; center?: boolean }) => <div className="dim" style={{ padding: center ? '24px 0' : '4px 0', textAlign: center ? 'center' : undefined }}>{children}</div>;

// ---------- Home (MW-Waiter-Home) ----------
type Tab = 'serve' | 'calls' | 'bills' | 'done';
const TABS: [Tab, string, string][] = [['serve', 'To serve', '#5eb88a'], ['calls', 'Calls', 'var(--blue)'], ['bills', 'Bills', 'var(--taupe)'], ['done', 'Done', 'var(--blue2)']];
const TAB_OF: Record<TaskKind, Tab> = { food_ready: 'serve', call: 'calls', bill: 'bills' };
const KIND: Record<TaskKind, [string, string]> = { food_ready: ['Food ready', '#7fcfa3'], call: ['Guest called', '#9cc3fa'], bill: ['Bill asked', '#d6c3ae'] };
const NOTE: Record<Tab, string> = { serve: 'Pick up from the kitchen pass', calls: 'Guests asking for you', bills: 'Tables ready to pay', done: 'Finished recently' };
const LATE_MIN = 5;

export function WaiterHomeM({ tasks, act }: { tasks: any; act: (id: number, what: 'take' | 'done') => void }) {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('serve');
  const all: any[] = tasks?.tasks ?? [];
  const mine = all.filter((t) => t.status === 'open' || (t.status === 'taken' && t.mine));
  const done = all.filter((t) => t.status === 'done');
  const count = (k: Tab) => (k === 'done' ? done.length : mine.filter((t) => TAB_OF[t.kind as TaskKind] === k).length);
  const list = tab === 'done' ? [] : mine.filter((t) => TAB_OF[t.kind as TaskKind] === tab);
  const open = all.filter((t) => t.status === 'open').length;
  const button = (t: any): [string, string, () => void] => {
    if (t.status === 'open') return ['On it', t.kind === 'food_ready' ? 'blue' : 'light', () => act(t.id, 'take')];
    if (t.kind === 'bill') return ['Open bill', 'light', () => nav({ to: '/w/bill/$table', params: { table: String(t.tableId) } })];
    if (t.kind === 'food_ready') return ['Mark served', 'blue', () => act(t.id, 'done')];
    return ['Done', 'light', () => act(t.id, 'done')];
  };
  return (
    <>
      <button className="mline" style={{ minHeight: 44 }} onClick={() => nav({ to: '/w/alerts' })}>
        <span className="grow muted" style={{ fontSize: 13 }}>{open === 0 ? 'No alerts waiting' : `${open} alert${open > 1 ? 's' : ''} need someone`}</span>
        <b className="blue" style={{ fontSize: 13 }}>Open alerts</b><span className="blue" style={{ display: 'flex' }}><Icon name="chev" size={14} /></span>
      </button>
      <div className="wtabs">
        {TABS.map(([k, label, dot]) => (
          <button key={k} className={k === tab ? 'on' : ''} onClick={() => setTab(k)}>
            <b style={{ fontSize: 22 }}>{count(k)}</b>
            <span className="row-flex" style={{ gap: 5, fontSize: 12.5 }}><span className="dot" style={{ width: 6, height: 6, background: dot }} />{label}</span>
          </button>
        ))}
      </div>
      <div className="dim small" style={{ marginTop: -8 }}>{NOTE[tab]}</div>
      {!tasks ? <Loading /> : tab === 'done' ? (
        <div>
          {done.length === 0 && <Empty center>Nothing finished yet.</Empty>}
          {done.map((t) => (
            <div key={t.id} className="row" style={{ minHeight: 52, padding: 0, gap: 12 }}>
              <span className="dim small" style={{ width: 52 }}>{new Date(t.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: false })}</span>
              <div className="grow"><b>{TASK_LABEL[t.kind as TaskKind]}</b><div className="dim small">{t.table}</div></div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? <Empty center>All caught up.</Empty> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((t) => {
            const m = mins(t.createdAt); const late = m >= LATE_MIN; const [kind, kindFg] = KIND[t.kind as TaskKind]; const [label, style, press] = button(t);
            const origin = t.level === 0 ? '' : t.ownTable ? 'Your table' : `Passed on from ${t.assignedName?.split(' ')[0] ?? 'nobody'}`;
            return (
              <div key={t.id} className={'wcard' + (late ? ' late' : '')}>
                <div className="row-flex">
                  <b style={{ fontSize: 20 }}>{t.table}</b><b className="small" style={{ color: kindFg }}>{kind}</b><span className="grow" />
                  <span className="row-flex" style={{ gap: 4, color: late ? 'var(--amber)' : 'var(--dim)' }}><Icon name="clock" size={14} /><b style={{ fontSize: 13 }}>{m < 1 ? 'Now' : `${m} min`}</b></span>
                </div>
                <div className="row-flex" style={{ gap: 10, margin: '10px 0 12px', alignItems: 'flex-start' }}><b className="grow" style={{ fontSize: 15 }}>{t.detail || TASK_LABEL[t.kind as TaskKind]}</b>{origin && <span className="dim small">{origin}</span>}</div>
                <button className="wbtn" style={style === 'blue' ? { background: 'var(--blue2)', color: '#fff' } : { background: 'var(--text)', color: 'var(--bg)' }} onClick={press}>{label}</button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ---------- My tables (MW-Waiter-Tables) ----------
const HINT: Record<string, string> = { seated: 'Choosing dishes', eating: 'Food on the way', ready: 'Food ready', served: 'Eating', billing: 'Waiting to pay' };
export function WaiterTablesM({ list }: { list: any[] }) {
  const nav = useNavigate();
  const busy = list.filter((t) => t.state !== 'free').length;
  const guests = list.reduce((a, t) => a + t.guests, 0);
  const seats = list.reduce((a, t) => a + t.seats, 0);
  return (
    <>
      <div className="row-flex" style={{ gap: 24, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
        <div><div><b style={{ fontSize: 22 }}>{busy}</b><span className="dim" style={{ fontSize: 14 }}> / {list.length}</span></div><div className="dim small">Tables busy</div></div>
        <div><div><b style={{ fontSize: 22 }}>{guests}</b><span className="dim" style={{ fontSize: 14 }}> / {seats}</span></div><div className="dim small">Guests seated</div></div>
      </div>
      {list.length === 0 ? <Empty>No tables assigned to you yet. Ask the manager.</Empty> : (
        <div className="wgrid">
          {list.map((t) => {
            const [label, fg, dot] = MTSTATE[t.state] ?? MTSTATE.free; const free = t.state === 'free';
            return (
              <button key={t.id} className={'wtable' + (t.state === 'ready' ? ' ring' : '')} aria-label={`Table ${t.code}, ${label}`}
                onClick={() => (free ? nav({ to: '/w/take-order', search: { table: t.id } as any }) : nav({ to: '/w/table/$id', params: { id: String(t.id) } }))}>
                <span className="row-flex" style={{ justifyContent: 'space-between' }}>
                  <b style={{ fontSize: 20, color: free ? 'var(--muted)' : 'var(--text)' }}>{t.code}</b>
                  <span className="row-flex" style={{ gap: 5 }}><span className="dot" style={{ width: 7, height: 7, background: free ? 'transparent' : dot }} /><b style={{ fontSize: 12, color: free ? 'var(--dim)' : fg }}>{label}</b></span>
                </span>
                <span className="muted small">{free ? `${t.seats} seats · tap to seat guests` : `${t.guests} of ${t.seats} seats · ${HINT[t.state] ?? ''}`}</span>
                {!free && <span className="row-flex" style={{ justifyContent: 'space-between', marginTop: 'auto' }}><b style={{ fontSize: 13 }}>{'amount' in t ? rupees(t.amount) : ''}</b><span className="dim" style={{ fontSize: 13 }}>{mins(t.openedAt)}m</span></span>}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

// ---------- Orders (MW-Waiter-Orders) ----------
const ORDER_LATE = 20;
export function WaiterOrdersPage() {
  const nav = useNavigate();
  const { list: tables } = useWaiter();
  const q = useQuery({ queryKey: ['orders'], queryFn: () => api('/floor/orders') });
  const items: any[] = q.data ?? [];
  const rows = tables.filter((t) => t.sessionId).map((t) => {
    const mine = items.filter((i) => i.tableId === t.id && i.status !== 'cancelled');
    const served = mine.filter((i) => i.status === 'served').length;
    const ready = mine.find((i) => i.status === 'ready');
    const cooking = mine.filter((i) => i.status === 'cooking' || i.status === 'waiting');
    const oldest = [...cooking].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))[0];
    const late = oldest && mins(oldest.createdAt) >= ORDER_LATE;
    const [state, fg]: [string, string] = t.state === 'billing' ? ['Bill asked', '#d6c3ae'] : ready ? ['Food ready', '#7fcfa3'] : late ? ['Late', '#f5c27a'] : oldest ? ['Cooking', '#f5c27a'] : mine.length ? ['All served', '#9cc3fa'] : ['Seated', '#9cc3fa'];
    const latest = t.state === 'billing' ? `${'amount' in t ? rupees(t.amount) + ' · ' : ''}open the bill` : ready ? `${ready.name} ready · ${mins(ready.createdAt)} min ago` : oldest ? `${oldest.name} ${oldest.status === 'cooking' ? 'cooking' : 'placed'} · ${mins(oldest.createdAt)} min` : mine.length ? 'Everything is served' : 'Nothing ordered yet';
    return { t, state, fg, latest, served, total: mine.length, orderId: mine[0]?.orderId };
  });
  return (
    <>
      {!q.data ? <Loading /> : rows.length === 0 ? <Empty center>No open orders right now.</Empty> : rows.map((r) => (
        <button key={r.t.id} className="mline" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: '14px 0' }} onClick={() => nav({ to: '/w/table/$id', params: { id: String(r.t.id) } })}>
          <span className="row-flex"><b style={{ fontSize: 18 }}>{r.t.code}</b><span className="dim small">{r.orderId ? `#${r.orderId} · ` : ''}{r.t.guests} guests</span><span className="grow" /><b className="small" style={{ color: r.fg }}>{r.state}</b></span>
          <span className="row-flex"><span className="bar grow" style={{ height: 4 }}><span style={{ background: 'var(--blue2)', width: `${r.total ? Math.round((r.served / r.total) * 100) : 0}%` }} /></span><span className="muted small">{r.served}/{r.total} served</span></span>
          <span className="dim small">{r.latest}</span>
        </button>
      ))}
    </>
  );
}

// ---------- Table (MW-OrderDetail) ----------
const L: Record<string, [string, string]> = {
  served: ['Served', '#7fcfa3'], ready: ['Ready at the pass', '#9cc3fa'], cooking: ['Cooking', '#f5c27a'],
  waiting: ['Waiting · kitchen has not started', 'var(--muted)'], cancelled: ['Cancelled', 'var(--dim)'],
};
export function WaiterTableM({ data }: { data: any }) {
  const qc = useQueryClient(); const toast = useToast();
  const id = String(data.table.id);
  const serve = useMutation({
    mutationFn: (itemId: number) => api(`/floor/items/${itemId}/served`, { body: {} }),
    onMutate: async (itemId) => {
      await qc.cancelQueries({ queryKey: ['table', id] });
      const prev = qc.getQueryData(['table', id]) as any;
      if (prev) qc.setQueryData(['table', id], { ...prev, items: prev.items.map((i: any) => (i.id === itemId ? { ...i, status: 'served' } : i)) });
      return { prev };
    },
    onError: (e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['table', id], ctx.prev); toast((e as Error).message); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['table', id] }),
  });
  const cancel = useMutation({ mutationFn: (itemId: number) => api(`/floor/items/${itemId}/cancel`, { body: {} }), onSuccess: () => qc.invalidateQueries(), onError: (e) => toast((e as Error).message) });
  const { table, session: sess, items, totals } = data;
  const live = items.filter((i: any) => i.status !== 'cancelled');
  const served = live.filter((i: any) => i.status === 'served').length;
  const pct = live.length ? Math.round((served / live.length) * 100) : 0;
  const state = !sess ? 'free' : sess.status === 'billing' ? 'billing' : !live.length ? 'seated' : live.some((i: any) => i.status === 'ready') ? 'ready' : live.some((i: any) => i.status === 'waiting' || i.status === 'cooking') ? 'eating' : 'served';
  const [label, textColor] = MTSTATE[state];
  const seated = sess ? mins(sess.openedAt) : 0;
  const detail = (i: any) => (i.status === 'cooking' ? `Cooking${i.chef ? ' · ' + i.chef.split(' ')[0] : ''}` : L[i.status][0]);
  return (
    <>
      <MHead title={`Table ${table.code}`} sub={sess ? `${sess.guestCount} guests · ${table.seats} seats · seated ${seated} min` : `${table.area} · ${table.seats} seats`} right={<b className="small" style={{ color: textColor, paddingTop: 10 }}>{label}</b>} />
      {sess && (
        <div>
          <div className="row-flex" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}><b style={{ fontSize: 15 }}>{served} of {live.length} dishes served</b><b className="blue" style={{ fontSize: 18 }}>{pct}%</b></div>
          <div className="bar" style={{ height: 5, marginTop: 8 }}><div style={{ background: 'var(--blue2)', width: `${pct}%` }} /></div>
        </div>
      )}
      {!sess && <Empty>Free table. Take an order to seat guests.</Empty>}
      <div>
        {items.map((it: any) => {
          const note = [it.spice, ...(it.options ?? []), it.note].filter(Boolean).join(' · ');
          return (
            <div key={it.id} className="row" style={{ gap: 12, minHeight: 58, padding: '9px 0', opacity: it.status === 'cancelled' ? 0.7 : 1 }}>
              <span className="b muted" style={{ minWidth: 48, textAlign: 'center', fontSize: 11 }}>{it.guestNo ? 'G' + it.guestNo : 'Shared'}</span>
              <div className="grow">
                <b style={{ fontSize: 14, textDecoration: it.status === 'cancelled' ? 'line-through' : undefined, color: it.status === 'cancelled' ? 'var(--dim)' : undefined }}>{it.qty} × {it.name}</b>
                <div className="small" style={{ color: L[it.status][1] }}>{detail(it)}</div>
                {note && <div className="taupe small">{note}</div>}
              </div>
              {it.status === 'ready' && <button className="wsmall blue" style={{ height: 34, fontSize: 12.5 }} onClick={() => serve.mutate(it.id)}>Mark served</button>}
              {it.status === 'waiting' && <button className="link red" style={{ fontSize: 12.5 }} onClick={() => confirm(`Cancel ${it.name}?`) && cancel.mutate(it.id)}>Cancel</button>}
            </div>
          );
        })}
        {sess && items.length === 0 && <Empty>Nothing ordered yet</Empty>}
      </div>
      {sess && totals && 'total' in totals && <div className="row-flex" style={{ justifyContent: 'space-between' }}><span className="muted" style={{ fontSize: 13.5 }}>Running total incl. GST</span><b>{rupees(totals.total)}</b></div>}
      <div className="mfoot">
        <Link to="/w/take-order" search={{ table: table.id } as any} className="mpill ghost">{sess ? 'Add items' : 'Take order'}</Link>
        {sess && <Link to="/w/bill/$table" params={{ table: String(table.id) }} className="mpill" style={{ background: 'var(--text)', color: 'var(--bg)' }}>Bill</Link>}
      </div>
    </>
  );
}

// ---------- Alerts (MW-Waiter-Alerts) ----------
const KIND_DOT: Record<TaskKind, string> = { food_ready: '#5eb88a', call: 'var(--blue)', bill: 'var(--taupe)' };
export function WaiterAlertsM({ tasks, act, sub }: { tasks: any; act: (id: number, what: 'take' | 'done') => void; sub?: string }) {
  const nav = useNavigate();
  const all: any[] = tasks?.tasks ?? [];
  const open = all.filter((t) => t.status === 'open');
  const mine = all.filter((t) => t.status === 'taken' && t.mine);
  const others = all.filter((t) => t.status === 'taken' && !t.mine);
  const rules = tasks?.rules;
  const origin = (t: any): [string, string] => t.level === 0 ? ['Your table', '#8b8b93'] : t.ownTable ? ['Your table · now with the whole area', 'var(--amber)'] : [`Passed on from ${t.assignedName?.split(' ')[0] ?? 'nobody'}${t.level === 2 ? ' · manager alerted' : ' · no reply in time'}`, 'var(--amber)'];
  return (
    <>
      <MHead title="Alerts" sub={sub} />
      {!tasks ? <Loading /> : <>
        <MSec title="Needs someone" right={<b className="muted">{open.length}</b>}>
          {open.length === 0 && <Empty>All clear</Empty>}
          {open.map((t) => { const [o, c] = origin(t); return (
            <div key={t.id} className="row" style={{ gap: 12, padding: '12px 0' }}>
              <StatusDot color={KIND_DOT[t.kind as TaskKind]} ready />
              <div className="grow">
                <b><b className="bb">{t.table}</b> · {TASK_LABEL[t.kind as TaskKind]}</b>
                <div className="muted small ellipsis">{t.detail}</div>
                <div className="small" style={{ color: c }}>{o}</div>
              </div>
              <button className="wsmall" onClick={() => act(t.id, 'take')}>On it</button>
            </div>
          ); })}
        </MSec>
        <MSec title="I'm handling" right={<b className="muted">{mine.length}</b>}>
          {mine.map((t) => (
            <div key={t.id} className="row" style={{ gap: 12, padding: '12px 0' }}>
              <span className="dot" style={{ background: KIND_DOT[t.kind as TaskKind] }} />
              <b className="grow"><b className="bb">{t.table}</b> · {TASK_LABEL[t.kind as TaskKind]}</b>
              {t.kind === 'bill' ? <button className="wsmall ghost" onClick={() => nav({ to: '/w/bill/$table', params: { table: String(t.tableId) } })}>Open bill</button> : <button className="wsmall ghost" onClick={() => act(t.id, 'done')}>Done</button>}
            </div>
          ))}
          {others.map((t) => <div key={t.id} className="dim" style={{ fontSize: 13, paddingTop: 12, paddingLeft: 20 }}>{t.table} · {TASK_LABEL[t.kind as TaskKind]} · {t.takenName?.split(' ')[0]} is on it</div>)}
        </MSec>
        {rules && <div className="dim small">Not taken in {rules.areaSecs} s → all free waiters in the area. Not taken in {rules.managerSecs} s → manager.</div>}
      </>}
    </>
  );
}

// ---------- Bill (MW-Bill) ----------
const METHODS: ['cash' | 'upi' | 'card', string][] = [['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card']];
const SPLITS = [1, 2, 3, 6];
export function WaiterBillPage() {
  const { table: tableId } = useParams({ strict: false }) as { table: string };
  const nav = useNavigate(); const qc = useQueryClient(); const toast = useToast();
  const t = useQuery({ queryKey: ['table', tableId], queryFn: () => api(`/floor/tables/${tableId}`) });
  const sessionId: number | undefined = t.data?.session?.id;
  const bill = useQuery({ queryKey: ['bill', sessionId], queryFn: () => api(`/floor/sessions/${sessionId}/bill`), enabled: !!sessionId });
  const [method, setMethod] = useState<'cash' | 'upi' | 'card'>('upi');
  const [split, setSplit] = useState(1);
  const pay = useMutation({
    mutationFn: () => api(`/floor/sessions/${sessionId}/pay`, { body: { method } }),
    onSuccess: () => { qc.invalidateQueries(); toast(`${t.data.table.code} paid · table is free`); nav({ to: '/w/tables', replace: true }); },
    onError: (e) => toast((e as Error).message),
  });
  if (!t.data || (sessionId && !bill.data)) return <><MHead title="Bill" /><Loading /></>;
  if (!sessionId) return <><MHead title={`Bill · Table ${t.data.table.code}`} /><Empty>This table has no open order.</Empty></>;
  const b = bill.data;
  const each = Math.ceil(b.total / split);
  const row = (l: string, v: string, big?: boolean) => <div className="row-flex" style={{ justifyContent: 'space-between', marginTop: big ? 4 : 0, fontSize: big ? 20 : 13.5, fontWeight: big ? 700 : 400, color: big ? 'var(--text)' : 'var(--muted)' }}><span>{l}</span><span>{v}</span></div>;
  return (
    <>
      <MHead title={`Bill · Table ${t.data.table.code}`} sub={`${t.data.session.guestCount} guests`} />
      <div className="mcard" style={{ padding: '6px 16px' }}>
        {b.lines.map((l: any) => <div key={l.name + l.unitPrice} className="mline" style={{ minHeight: 40 }}><span className="muted" style={{ width: 26 }}>{l.qty}×</span><span className="grow">{l.name}</span><span>{rupees(l.qty * l.unitPrice)}</span></div>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 4px' }}>
        {row('Subtotal', rupees(b.subtotal))}{row(`GST ${b.taxPercent}% (CGST + SGST)`, rupees(b.tax))}{row('Total', rupees(b.total), true)}
      </div>
      <MSec title="Split">
        <div className="row-flex" style={{ gap: 8 }}>{SPLITS.map((n) => <button key={n} className={'wchoice' + (split === n ? ' on' : '')} onClick={() => setSplit(n)}>{n === 1 ? 'One bill' : `${n} ways`}</button>)}</div>
        <div className="dim small" style={{ marginTop: 8 }}>{split === 1 ? 'Whole table pays together' : `${split} guests pay ${rupees(each)} each`}</div>
      </MSec>
      <MSec title="Payment"><div className="row-flex" style={{ gap: 8 }}>{METHODS.map(([k, l]) => <button key={k} className={'wchoice' + (method === k ? ' on' : '')} onClick={() => setMethod(k)}>{l}</button>)}</div></MSec>
      <div className="mfoot"><button className="wbtn" style={{ height: 52, borderRadius: 26, background: 'var(--blue2)', color: '#fff', opacity: pay.isPending ? 0.6 : 1 }} disabled={pay.isPending} onClick={() => pay.mutate()}>{pay.isPending ? 'Closing…' : `Collect ${rupees(b.total)} by ${METHODS.find((m) => m[0] === method)![1]}`}</button></div>
    </>
  );
}

// ---------- Profile (MW-Profile, waiter version) ----------
const START = 18 * 60, END = 23 * 60; // tonight's shift window shown in the design
export function WaiterProfilePage() {
  const me = useMe(); const nav = useNavigate();
  const w = useWaiter();
  const stats = useQuery({ queryKey: ['my-stats'], queryFn: () => api('/team/stats/me') });
  const { unread } = useNotifications();
  const logout = async () => { await api('/auth/logout', { body: {} }).catch(() => {}); session.clear(); nav({ to: '/login' }); };
  const now = new Date(); const m = now.getHours() * 60 + now.getMinutes();
  const pct = Math.max(0, Math.min(100, ((m - START) / (END - START)) * 100));
  const s = stats.data;
  const nums: [string, string][] = [['Tables served', s ? String(s.tablesServed) : '–'], ['Orders taken', s ? String(s.ordersTaken) : '–'], ['Avg serve time', s ? `${s.avgServeMin}m` : '–']];
  return (
    <>
      <div className="row-flex" style={{ gap: 14 }}>
        <span className="avatar" style={{ width: 64, height: 64, borderRadius: 32, fontSize: 24, fontWeight: 700 }}>{me.name[0]}</span>
        <div><div className="bb" style={{ fontSize: 20 }}>{me.name}</div><div className="muted" style={{ fontSize: 13 }}>Waiter · {w.sub}</div></div>
      </div>
      <div className="mcard" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row-flex" style={{ justifyContent: 'space-between' }}>
          <div><b>{w.onBreak ? 'On break' : 'On duty'}</b><div className="dim small">Evening shift · 6 PM to 11 PM</div></div>
          <b className="small" style={{ color: w.onBreak ? 'var(--amber)' : 'var(--green)' }}>{w.onBreak ? 'Break' : 'On duty'}</b>
        </div>
        <div className="bar" style={{ height: 4 }}><div style={{ background: 'var(--blue2)', width: `${pct}%` }} /></div>
        <button className="mpill chip" style={{ height: 42 }} onClick={w.toggleBreak}>{w.onBreak ? 'End break' : 'Take a break'}</button>
      </div>
      <div className="mcard" style={{ padding: '14px 4px', display: 'flex' }}>
        {nums.map(([l, v]) => <div key={l} style={{ flex: 1, textAlign: 'center' }}><div className="bb" style={{ fontSize: 20 }}>{v}</div><div className="dim small">{l}</div></div>)}
      </div>
      <div>
        <button className="mline" style={{ minHeight: 52, gap: 12 }} onClick={() => nav({ to: '/w/notifications' })}>
          <span style={{ color: 'var(--muted)', display: 'flex' }}><Icon name="bell" size={20} /></span><span className="grow" style={{ fontWeight: 500 }}>Notifications</span>{unread > 0 && <b className="blue small">{unread}</b>}<Icon name="chev" size={16} />
        </button>
        <button className="mline" style={{ minHeight: 52, color: 'var(--red)', fontWeight: 600 }} onClick={logout}>Sign out</button>
      </div>
    </>
  );
}

// ---------- Take order (MW-TakeOrder) ----------
type Mods = { spice: string; opts: string[]; note: string };
const DEFAULT: Mods = { spice: 'Medium', opts: [], note: '' };
const keyOf = (guest: number, dish: number) => `${guest}:${dish}`;

export function TakeOrderM() {
  const search = useSearch({ strict: false }) as { table?: number };
  const qc = useQueryClient(); const toast = useToast(); const nav = useNavigate();
  const tables = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables') });
  const menu = useQuery({ queryKey: ['menu'], queryFn: () => api('/floor/menu') });
  const [tableId, setTableId] = useState<number | null>(search.table ? Number(search.table) : null);
  const [guests, setGuests] = useState<number | null>(null);
  const [cat, setCat] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [who, setWho] = useState(1);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [mods, setMods] = useState<Record<number, Mods>>({});
  const [custom, setCustom] = useState<any | null>(null);
  const [review, setReview] = useState(false);
  const table = tables.data?.tables.find((t: any) => t.id === tableId);
  const g = guests ?? (table?.guests || 2);
  const cats: any[] = menu.data ?? [];
  const current = cat ?? cats[0]?.id;
  const all: any[] = useMemo(() => cats.flatMap((c: any) => c.dishes), [menu.data]);
  const dishes: any[] = q.trim() ? all.filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase())) : (cats.find((c) => c.id === current)?.dishes ?? []);

  const lines = Object.entries(qty).filter(([k, n]) => n > 0 && Number(k.split(':')[0]) <= g);
  const count = lines.reduce((a, [, n]) => a + n, 0);
  const dish = (id: number) => all.find((d) => d.id === id);
  const total = lines.reduce((a, [k, n]) => a + n * (dish(Number(k.split(':')[1]))?.price ?? 0), 0);
  const hasPrice = all.length > 0 && 'price' in all[0];
  const perGuest = (n: number) => lines.filter(([k]) => Number(k.split(':')[0]) === n).reduce((a, [, c]) => a + c, 0);
  const empty = Array.from({ length: g }, (_, i) => i + 1).filter((n) => perGuest(n) === 0).map((n) => `Guest ${n}`);
  const bump = (dishId: number, d: number, guest = who) => { const k = keyOf(guest, dishId); setQty({ ...qty, [k]: Math.max(0, (qty[k] ?? 0) + d) }); };
  const setMod = (dishId: number, patch: Partial<Mods>) => setMods({ ...mods, [dishId]: { ...DEFAULT, ...(mods[dishId] ?? {}), ...patch } });
  const summary = (dishId: number) => { const m = mods[dishId]; const d = dish(dishId); return m ? [...(d?.hasSpice ? [`${m.spice} spicy`] : []), ...m.opts, ...(m.note ? [`“${m.note}”`] : [])].join(' · ') : ''; };

  const send = useMutation({
    mutationFn: async () => {
      let sessionId = table.sessionId;
      if (!sessionId || guests) sessionId = (await api('/floor/sessions', { body: { tableId, guestCount: g } })).id;
      const items = lines.map(([k, n]) => {
        const [guestNo, dishId] = k.split(':').map(Number);
        const m = mods[dishId] ?? DEFAULT;
        return { dishId, qty: n, guestNo, spice: dish(dishId)?.hasSpice ? m.spice : null, options: m.opts, note: m.note };
      });
      return api('/floor/orders', { body: { sessionId, items } });
    },
    onSuccess: () => { qc.invalidateQueries(); toast('Sent to the kitchen'); setReview(false); nav({ to: '/w/table/$id', params: { id: String(tableId) }, replace: true }); },
    onError: (e) => toast((e as Error).message),
  });

  if (!tables.data || !menu.data) return <><MHead title="Take order" /><Loading /></>;
  const stepper = (
    <span className="mstep" style={{ height: 36 }} aria-label="Guests at table">
      <button aria-label="Fewer guests" style={{ width: 34, height: 34, fontSize: 17 }} onClick={() => { const n = Math.max(1, g - 1); setGuests(n); if (who > n) setWho(0); }}>−</button>
      <b style={{ fontSize: 13 }}>{g} guests</b>
      <button aria-label="More guests" style={{ width: 34, height: 34, fontSize: 17 }} onClick={() => setGuests(Math.min(12, g + 1))}>+</button>
    </span>
  );
  const sub = table ? `${table.area} · ${table.seats} seats${table.waiter ? ' · ' + table.waiter.split(' ')[0] : ''}` : 'Pick a table';
  const cartGuests = [...new Set(lines.map(([k]) => Number(k.split(':')[0])))].sort((a, b) => a - b);
  return (
    <>
      <MHead title={table ? `Table ${table.code}` : 'Take order'} sub={table ? `${table.sessionId ? 'Add items' : 'New order'} · ${sub}` : sub} right={table ? <span style={{ paddingTop: 4 }}>{stepper}</span> : undefined} />
      {!table && <Chips items={tables.data.tables.map((t: any) => [t.id, t.state === 'free' ? t.code : `${t.code} · ${t.guests}`] as [number, string])} value={tableId ?? -1} onChange={(v) => { setTableId(v); setGuests(null); setWho(1); }} />}
      {tables.data.tables.length === 0 && <Empty>No tables assigned to you yet. Ask the manager.</Empty>}
      <label className="wsearch"><Icon name="search" size={18} /><input aria-label="Search dishes" placeholder="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <div className="chips">{cats.map((c) => <button key={c.id} className={!q.trim() && c.id === current ? 'on' : ''} onClick={() => { setCat(c.id); setQ(''); }}>{c.name}</button>)}</div>
      <div className="row-flex" style={{ gap: 6 }}>
        <span className="dim small" style={{ marginRight: 2 }}>For</span>
        <div className="wfor">
          {Array.from({ length: g + 1 }, (_, n) => (n + 1) % (g + 1)).map((n) => { const c = n === 0 ? 0 : perGuest(n); return <button key={n} className={n === who ? 'on' : ''} onClick={() => setWho(n)}>{n === 0 ? 'Shared' : `Guest ${n}${c ? ' · ' + c : ''}`}</button>; })}
        </div>
      </div>

      {dishes.length === 0 && <Empty>No dishes found</Empty>}
      {dishes.map((d) => {
        const n = qty[keyOf(who, d.id)] ?? 0; const out = !d.available; const sum = summary(d.id);
        const others = Array.from({ length: g + 1 }, (_, k) => k).filter((k) => k !== who && (qty[keyOf(k, d.id)] ?? 0) > 0).map((k) => `${k === 0 ? 'Shared' : 'G' + k} ×${qty[keyOf(k, d.id)]}`);
        return (
          <div key={d.id} className={'wdish' + (out ? ' out' : '')}>
            <div className="row-flex" style={{ gap: 12, alignItems: 'stretch' }}>
              <span className="wthumb">{d.name[0]}</span>
              <div className="grow" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="row-flex" style={{ gap: 6 }}><span style={{ width: 10, height: 10, border: `1.5px solid ${d.veg ? 'var(--green)' : 'var(--red)'}`, borderRadius: 2, flex: 'none' }} /><b className="ellipsis">{d.name}</b></div>
                <div className="dim small">{'price' in d ? rupees(d.price) + ' · ' : ''}{d.prepMinutes} min{others.length > 0 && <span className="blue"> · {others.join(', ')}</span>}</div>
                <div className="row-flex" style={{ justifyContent: 'space-between', marginTop: 'auto' }}>
                  {n > 0 && !out ? <button className="link row-flex" style={{ height: 32, gap: 4, fontSize: 13 }} onClick={() => setCustom(d)}><Icon name="pen" size={14} sw={2} />{summary(d.id) ? 'Edit changes' : 'Customize'}</button> : <span />}
                  {out ? <b className="dim small">Sold out</b> : n === 0
                    ? <button className="wsmall" style={{ background: 'var(--chip)', color: 'var(--blue)', padding: '0 16px', opacity: table ? 1 : 0.45 }} disabled={!table} onClick={() => bump(d.id, 1)}>Add</button>
                    : <span className="wstep"><button aria-label={`Remove one ${d.name}`} onClick={() => bump(d.id, -1)}>−</button><b>{n}</b><button aria-label={`Add one ${d.name}`} onClick={() => bump(d.id, 1)}>+</button></span>}
                </div>
              </div>
            </div>
            {n > 0 && sum && <div style={{ fontSize: 12.5, color: '#f5c27a' }}>{sum}</div>}
          </div>
        );
      })}

      <div className="mfoot" style={{ flexDirection: 'column', gap: 8 }}>
        {count > 0 && empty.length > 0 && g > 1 && <div style={{ fontSize: 12.5, color: '#f5c27a' }}>{empty.join(' and ')} {empty.length > 1 ? 'have' : 'has'} nothing yet</div>}
        <button className="wsend" disabled={!count || !table} onClick={() => setReview(true)}><span>Review {count} item{count === 1 ? '' : 's'}{hasPrice ? ` · ${rupees(total)}` : ''}</span><span>Next</span></button>
      </div>

      {custom && (
        <Modal title={custom.name} onClose={() => setCustom(null)}>
          {custom.description && <div className="muted">{custom.description}</div>}
          {custom.hasSpice && <div><div className="muted small" style={{ marginBottom: 8 }}>Spice level</div><div className="row-flex" style={{ gap: 6 }}>{SPICE.map((x) => <button key={x} className={'wchoice' + ((mods[custom.id] ?? DEFAULT).spice === x ? ' on' : '')} style={{ height: 36, borderRadius: 18, fontSize: 12.5 }} onClick={() => setMod(custom.id, { spice: x })}>{x === 'Extra spicy' ? 'Extra' : x}</button>)}</div></div>}
          {custom.options?.length > 0 && <div><div className="muted small" style={{ marginBottom: 8 }}>Options</div><div className="row-flex wrap" style={{ gap: 6 }}>{custom.options.map((o: string) => { const m = mods[custom.id] ?? DEFAULT; const on = m.opts.includes(o); return <button key={o} className={'wchoice' + (on ? ' on' : '')} style={{ flex: 'none', height: 36, padding: '0 14px', borderRadius: 18, fontSize: 12.5 }} onClick={() => setMod(custom.id, { opts: on ? m.opts.filter((y) => y !== o) : [...m.opts, o] })}>{o}</button>; })}</div></div>}
          <label className="field">Note for the kitchen<textarea className="input" rows={2} maxLength={200} placeholder="e.g. less oil, sauce on the side" value={(mods[custom.id] ?? DEFAULT).note} onChange={(e) => setMod(custom.id, { note: e.target.value })} /></label>
          <button className="btn block" onClick={() => setCustom(null)}>Done</button>
        </Modal>
      )}

      {review && (
        <Modal title={`Order${table ? ' · ' + table.code : ''}`} onClose={() => setReview(false)}>
          {lines.length === 0 && <Empty>Nothing added yet</Empty>}
          {cartGuests.map((gn) => (
            <div key={gn}>
              <div className="dim small b" style={{ marginBottom: 2 }}>{gn ? `Guest ${gn}` : 'Shared'}</div>
              {lines.filter(([k]) => Number(k.split(':')[0]) === gn).map(([k, n]) => {
                const dishId = Number(k.split(':')[1]); const d = dish(dishId); const sum = summary(dishId);
                return (
                  <div key={k} className="row" style={{ padding: '10px 0', gap: 10 }}>
                    <div className="grow"><b>{d?.name}</b>{sum && <div className="taupe small">{sum}</div>}{d && 'price' in d && <div className="dim small">{rupees(d.price * n)}</div>}</div>
                    <span className="wstep"><button aria-label={`Remove one ${d?.name}`} onClick={() => bump(dishId, -1, gn)}>−</button><b>{n}</b><button aria-label={`Add one ${d?.name}`} onClick={() => bump(dishId, 1, gn)}>+</button></span>
                  </div>
                );
              })}
            </div>
          ))}
          {hasPrice && total > 0 && <div className="row-flex"><span className="muted grow">Total before tax</span><b style={{ fontSize: 18 }}>{rupees(total)}</b></div>}
          {send.error && <div className="err">{(send.error as Error).message}</div>}
          <button className="btn block" disabled={!count || !table || send.isPending} onClick={() => send.mutate()}>{send.isPending ? 'Sending…' : `Send to kitchen · ${count} item${count === 1 ? '' : 's'}`}</button>
        </Modal>
      )}
    </>
  );
}
