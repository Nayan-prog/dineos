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
const Empty = ({ children, center }: { children: ReactNode; center?: boolean }) => <div className="text-dim" style={{ padding: center ? '24px 0' : '4px 0', textAlign: center ? 'center' : undefined }}>{children}</div>;

// ---------- Home (MW-Waiter-Home) ----------
type Tab = 'serve' | 'calls' | 'bills' | 'done';
const TABS: [Tab, string, string][] = [['serve', 'To serve', '#5eb88a'], ['calls', 'Calls', 'var(--color-blue)'], ['bills', 'Bills', 'var(--color-taupe)'], ['done', 'Done', 'var(--color-blue2)']];
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
      <button className="flex items-center gap-2.5 w-full border-0 border-b border-b-line bg-transparent p-0 text-fg text-left last:border-b-0 min-h-11" onClick={() => nav({ to: '/w/alerts' })}>
        <span className="text-muted flex-1 min-w-0 text-[13px]">{open === 0 ? 'No alerts waiting' : `${open} alert${open > 1 ? 's' : ''} need someone`}</span>
        <b className="text-blue text-[13px]">Open alerts</b><span className="text-blue flex"><Icon name="chev" size={14} /></span>
      </button>
      <div className="flex border-b border-b-line [&_button]:flex-1 [&_button]:h-16 [&_button]:flex [&_button]:flex-col [&_button]:items-start [&_button]:justify-center [&_button]:border-0 [&_button]:border-b-2 [&_button]:border-b-transparent [&_button]:bg-transparent [&_button]:text-muted [&_button]:p-0 [&_button]:[transition:color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease)] [&_button.on]:text-fg [&_button.on]:border-b-blue [&_button.on_span]:font-bold">
        {TABS.map(([k, label, dot]) => (
          <button key={k} className={(k === tab) ? "on" : ""} onClick={() => setTab(k)}>
            <b className="text-[22px]">{count(k)}</b>
            <span className="flex items-center gap-1.25 text-[12.5px]"><span className="rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)] w-1.5 h-1.5" style={{ background: dot }} />{label}</span>
          </button>
        ))}
      </div>
      <div className="text-dim text-[12.5px] -mt-2">{NOTE[tab]}</div>
      {!tasks ? <Loading /> : tab === 'done' ? (
        <div>
          {done.length === 0 && <Empty center>Nothing finished yet.</Empty>}
          {done.map((t) => (
            <div key={t.id} className="flex items-center border-b border-b-line stagger last:border-b-0 min-h-13 p-0 gap-3">
              <span className="text-dim text-[12.5px] w-13">{new Date(t.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: false })}</span>
              <div className="flex-1 min-w-0"><b>{TASK_LABEL[t.kind as TaskKind]}</b><div className="text-dim text-[12.5px]">{t.table}</div></div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? <Empty center>All caught up.</Empty> : (
        <div className="flex flex-col gap-2.5">
          {list.map((t) => {
            const m = mins(t.createdAt); const late = m >= LATE_MIN; const [kind, kindFg] = KIND[t.kind as TaskKind]; const [label, style, press] = button(t);
            const origin = t.level === 0 ? '' : t.ownTable ? 'Your table' : `Passed on from ${t.assignedName?.split(' ')[0] ?? 'nobody'}`;
            return (
              <div key={t.id} className={(late) ? "bg-card rounded-[16px] p-3.5 border [animation:rise_var(--t-base)_var(--ease)_backwards] border-[rgba(245,180,84,.45)]" : "bg-card rounded-[16px] p-3.5 border border-transparent [animation:rise_var(--t-base)_var(--ease)_backwards]"}>
                <div className="flex items-center gap-2.5">
                  <b className="text-[20px]">{t.table}</b><b className="text-[12.5px]" style={{ color: kindFg }}>{kind}</b><span className="flex-1 min-w-0" />
                  <span className="flex items-center gap-1" style={{ color: late ? 'var(--color-amber)' : 'var(--color-dim)' }}><Icon name="clock" size={14} /><b className="text-[13px]">{m < 1 ? 'Now' : `${m} min`}</b></span>
                </div>
                <div className="flex gap-2.5 mt-2.5 mx-0 mb-3 items-start"><b className="flex-1 min-w-0 text-[15px]">{t.detail || TASK_LABEL[t.kind as TaskKind]}</b>{origin && <span className="text-dim text-[12.5px]">{origin}</span>}</div>
                <button className="w-full h-11.5 border-0 rounded-[23px] font-semibold text-[15px] [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.98)]" style={style === 'blue' ? { background: 'var(--color-blue2)', color: '#fff' } : { background: 'var(--color-fg)', color: 'var(--color-bg)' }} onClick={press}>{label}</button>
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
      <div className="flex items-center gap-6 pb-3 border-b border-b-line">
        <div><div><b className="text-[22px]">{busy}</b><span className="text-dim text-[14px]"> / {list.length}</span></div><div className="text-dim text-[12.5px]">Tables busy</div></div>
        <div><div><b className="text-[22px]">{guests}</b><span className="text-dim text-[14px]"> / {seats}</span></div><div className="text-dim text-[12.5px]">Guests seated</div></div>
      </div>
      {list.length === 0 ? <Empty>No tables assigned to you yet. Ask the manager.</Empty> : (
        <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-2.5">
          {list.map((t) => {
            const [label, fg, dot] = MTSTATE[t.state] ?? MTSTATE.free; const free = t.state === 'free';
            return (
              <button key={t.id} className={(t.state === 'ready') ? "min-h-26 py-3 px-3.5 border-0 rounded-[16px] bg-card flex flex-col gap-1 text-left text-fg [animation:rise_var(--t-base)_var(--ease)_backwards] [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.98)] shadow-[inset_0_0_0_1.5px_rgba(94,184,138,.6)]" : "min-h-26 py-3 px-3.5 border-0 rounded-[16px] bg-card flex flex-col gap-1 text-left text-fg [animation:rise_var(--t-base)_var(--ease)_backwards] [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.98)]"} aria-label={`Table ${t.code}, ${label}`}
                onClick={() => (free ? nav({ to: '/w/take-order', search: { table: t.id } as any }) : nav({ to: '/w/table/$id', params: { id: String(t.id) } }))}>
                <span className="flex items-center gap-2.5 justify-between">
                  <b className="text-[20px]" style={{ color: free ? 'var(--color-muted)' : 'var(--color-fg)' }}>{t.code}</b>
                  <span className="flex items-center gap-1.25"><span className="rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)] w-1.75 h-1.75" style={{ background: free ? 'transparent' : dot }} /><b className="text-[12px]" style={{ color: free ? 'var(--color-dim)' : fg }}>{label}</b></span>
                </span>
                <span className="text-muted text-[12.5px]">{free ? `${t.seats} seats · tap to seat guests` : `${t.guests} of ${t.seats} seats · ${HINT[t.state] ?? ''}`}</span>
                {!free && <span className="flex items-center gap-2.5 justify-between mt-auto"><b className="text-[13px]">{'amount' in t ? rupees(t.amount) : ''}</b><span className="text-dim text-[13px]">{mins(t.openedAt)}m</span></span>}
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
        <button key={r.t.id} className="flex min-h-12 w-full border-0 border-b border-b-line bg-transparent p-0 text-fg text-left last:border-b-0 flex-col items-stretch gap-2 py-3.5 px-0" onClick={() => nav({ to: '/w/table/$id', params: { id: String(r.t.id) } })}>
          <span className="flex items-center gap-2.5"><b className="text-[18px]">{r.t.code}</b><span className="text-dim text-[12.5px]">{r.orderId ? `#${r.orderId} · ` : ''}{r.t.guests} guests</span><span className="flex-1 min-w-0" /><b className="text-[12.5px]" style={{ color: r.fg }}>{r.state}</b></span>
          <span className="flex items-center gap-2.5"><span className="flex-1 min-w-0 flex rounded-[3px] overflow-hidden bg-chip2 h-1"><span className="bg-blue2" style={{ width: `${r.total ? Math.round((r.served / r.total) * 100) : 0}%` }} /></span><span className="text-muted text-[12.5px]">{r.served}/{r.total} served</span></span>
          <span className="text-dim text-[12.5px]">{r.latest}</span>
        </button>
      ))}
    </>
  );
}

// ---------- Table (MW-OrderDetail) ----------
const L: Record<string, [string, string]> = {
  served: ['Served', '#7fcfa3'], ready: ['Ready at the pass', '#9cc3fa'], cooking: ['Cooking', '#f5c27a'],
  waiting: ['Waiting · kitchen has not started', 'var(--color-muted)'], cancelled: ['Cancelled', 'var(--color-dim)'],
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
      <MHead title={`Table ${table.code}`} sub={sess ? `${sess.guestCount} guests · ${table.seats} seats · seated ${seated} min` : `${table.area} · ${table.seats} seats`} right={<b className="text-[12.5px] pt-2.5" style={{ color: textColor }}>{label}</b>} />
      {sess && (
        <div>
          <div className="flex gap-2.5 justify-between items-baseline"><b className="text-[15px]">{served} of {live.length} dishes served</b><b className="text-blue text-[18px]">{pct}%</b></div>
          <div className="flex rounded-[3px] overflow-hidden bg-chip2 h-1.25 mt-2"><div className="bg-blue2" style={{ width: `${pct}%` }} /></div>
        </div>
      )}
      {!sess && <Empty>Free table. Take an order to seat guests.</Empty>}
      <div>
        {items.map((it: any) => {
          const note = [it.spice, ...(it.options ?? []), it.note].filter(Boolean).join(' · ');
          return (
            <div key={it.id} className="flex items-center border-b border-b-line stagger last:border-b-0 gap-3 min-h-14.5 py-2.25 px-0" style={{ opacity: it.status === 'cancelled' ? 0.7 : 1 }}>
              <span className="text-muted font-semibold min-w-12 text-center text-[11px]">{it.guestNo ? 'G' + it.guestNo : 'Shared'}</span>
              <div className="flex-1 min-w-0">
                <b className="text-[14px]" style={{ textDecoration: it.status === 'cancelled' ? 'line-through' : undefined, color: it.status === 'cancelled' ? 'var(--color-dim)' : undefined }}>{it.qty} × {it.name}</b>
                <div className="text-[12.5px]" style={{ color: L[it.status][1] }}>{detail(it)}</div>
                {note && <div className="text-[12.5px] text-taupe">{note}</div>}
              </div>
              {it.status === 'ready' && <button className="py-0 px-3.5 border-0 rounded-[17px] font-semibold whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease)] bg-blue2 text-[#fff] active:[transform:scale(.97)] in-[.m-app]:min-h-11 h-8.5 text-[12.5px]" onClick={() => serve.mutate(it.id)}>Mark served</button>}
              {it.status === 'waiting' && <button className="border-0 bg-transparent p-0 font-semibold [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] text-red in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] text-[12.5px]" onClick={() => confirm(`Cancel ${it.name}?`) && cancel.mutate(it.id)}>Cancel</button>}
            </div>
          );
        })}
        {sess && items.length === 0 && <Empty>Nothing ordered yet</Empty>}
      </div>
      {sess && totals && 'total' in totals && <div className="flex items-center gap-2.5 justify-between"><span className="text-muted text-[13.5px]">Running total incl. GST</span><b>{rupees(totals.total)}</b></div>}
      <div className="sticky bottom-[calc(82px_+_env(safe-area-inset-bottom))] mt-auto flex gap-2.5 pt-3 px-0 pb-1.5 bg-bg z-5 print:hidden! in-[.m-app.nonav]:bottom-[env(safe-area-inset-bottom)]">
        <Link to="/w/take-order" search={{ table: table.id } as any} className="flex-1 h-12.5 border-0 rounded-[25px] flex items-center justify-center font-semibold text-[14px] text-fg bg-chip active:[transform:scale(.98)] in-[.m-app]:min-h-11">{sess ? 'Add items' : 'Take order'}</Link>
        {sess && <Link to="/w/bill/$table" params={{ table: String(table.id) }} className="flex-1 h-12.5 border-0 rounded-[25px] flex items-center justify-center font-semibold text-[14px] active:[transform:scale(.98)] in-[.m-app]:min-h-11 bg-fg text-bg">Bill</Link>}
      </div>
    </>
  );
}

// ---------- Alerts (MW-Waiter-Alerts) ----------
const KIND_DOT: Record<TaskKind, string> = { food_ready: '#5eb88a', call: 'var(--color-blue)', bill: 'var(--color-taupe)' };
export function WaiterAlertsM({ tasks, act, sub }: { tasks: any; act: (id: number, what: 'take' | 'done') => void; sub?: string }) {
  const nav = useNavigate();
  const all: any[] = tasks?.tasks ?? [];
  const open = all.filter((t) => t.status === 'open');
  const mine = all.filter((t) => t.status === 'taken' && t.mine);
  const others = all.filter((t) => t.status === 'taken' && !t.mine);
  const rules = tasks?.rules;
  const origin = (t: any): [string, string] => t.level === 0 ? ['Your table', '#8b8b93'] : t.ownTable ? ['Your table · now with the whole area', 'var(--color-amber)'] : [`Passed on from ${t.assignedName?.split(' ')[0] ?? 'nobody'}${t.level === 2 ? ' · manager alerted' : ' · no reply in time'}`, 'var(--color-amber)'];
  return (
    <>
      <MHead title="Alerts" sub={sub} />
      {!tasks ? <Loading /> : <>
        <MSec title="Needs someone" right={<b className="text-muted">{open.length}</b>}>
          {open.length === 0 && <Empty>All clear</Empty>}
          {open.map((t) => { const [o, c] = origin(t); return (
            <div key={t.id} className="flex items-center border-b border-b-line stagger last:border-b-0 gap-3 py-3 px-0">
              <StatusDot color={KIND_DOT[t.kind as TaskKind]} ready />
              <div className="flex-1 min-w-0">
                <b><b className="font-bold">{t.table}</b> · {TASK_LABEL[t.kind as TaskKind]}</b>
                <div className="text-muted text-[12.5px] whitespace-nowrap overflow-hidden text-ellipsis">{t.detail}</div>
                <div className="text-[12.5px]" style={{ color: c }}>{o}</div>
              </div>
              <button className="h-8.5 py-0 px-3.5 border-0 rounded-[17px] font-semibold text-[13px] bg-fg text-bg whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.97)] in-[.m-app]:min-h-11" onClick={() => act(t.id, 'take')}>On it</button>
            </div>
          ); })}
        </MSec>
        <MSec title="I'm handling" right={<b className="text-muted">{mine.length}</b>}>
          {mine.map((t) => (
            <div key={t.id} className="flex items-center border-b border-b-line stagger last:border-b-0 gap-3 py-3 px-0">
              <span className="w-2 h-2 rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)]" style={{ background: KIND_DOT[t.kind as TaskKind] }} />
              <b className="flex-1 min-w-0"><b className="font-bold">{t.table}</b> · {TASK_LABEL[t.kind as TaskKind]}</b>
              {t.kind === 'bill' ? <button className="h-8.5 py-0 px-3.5 rounded-[17px] font-semibold text-[13px] whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease)] bg-transparent border border-edge text-fg active:[transform:scale(.97)] in-[.m-app]:min-h-11" onClick={() => nav({ to: '/w/bill/$table', params: { table: String(t.tableId) } })}>Open bill</button> : <button className="h-8.5 py-0 px-3.5 rounded-[17px] font-semibold text-[13px] whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease)] bg-transparent border border-edge text-fg active:[transform:scale(.97)] in-[.m-app]:min-h-11" onClick={() => act(t.id, 'done')}>Done</button>}
            </div>
          ))}
          {others.map((t) => <div key={t.id} className="text-dim text-[13px] pt-3 pl-5">{t.table} · {TASK_LABEL[t.kind as TaskKind]} · {t.takenName?.split(' ')[0]} is on it</div>)}
        </MSec>
        {rules && <div className="text-dim text-[12.5px]">Not taken in {rules.areaSecs} s → all free waiters in the area. Not taken in {rules.managerSecs} s → manager.</div>}
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
  const row = (l: string, v: string, big?: boolean) => <div className="flex items-center gap-2.5 justify-between" style={{ marginTop: big ? 4 : 0, fontSize: big ? 20 : 13.5, fontWeight: big ? 700 : 400, color: big ? 'var(--color-fg)' : 'var(--color-muted)' }}><span>{l}</span><span>{v}</span></div>;
  return (
    <>
      <MHead title={`Bill · Table ${t.data.table.code}`} sub={`${t.data.session.guestCount} guests`} />
      <div className="bg-card rounded-[18px] py-1.5 px-4">
        {b.lines.map((l: any) => <div key={l.name + l.unitPrice} className="flex items-center gap-2.5 w-full border-0 border-b border-b-line bg-transparent p-0 text-fg text-left last:border-b-0 min-h-10"><span className="text-muted w-6.5">{l.qty}×</span><span className="flex-1 min-w-0">{l.name}</span><span>{rupees(l.qty * l.unitPrice)}</span></div>)}
      </div>
      <div className="flex flex-col gap-1.5 py-0 px-1">
        {row('Subtotal', rupees(b.subtotal))}{row(`GST ${b.taxPercent}% (CGST + SGST)`, rupees(b.tax))}{row('Total', rupees(b.total), true)}
      </div>
      <MSec title="Split">
        <div className="flex items-center gap-2">{SPLITS.map((n) => <button key={n} className={(split === n) ? "flex-1 border-0 rounded-[12px] font-semibold h-11 bg-fg text-bg in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] on" : "flex-1 border-0 rounded-[12px] bg-chip text-muted font-semibold h-11 in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]"} onClick={() => setSplit(n)}>{n === 1 ? 'One bill' : `${n} ways`}</button>)}</div>
        <div className="text-dim text-[12.5px] mt-2">{split === 1 ? 'Whole table pays together' : `${split} guests pay ${rupees(each)} each`}</div>
      </MSec>
      <MSec title="Payment"><div className="flex items-center gap-2">{METHODS.map(([k, l]) => <button key={k} className={(method === k) ? "flex-1 border-0 rounded-[12px] font-semibold h-11 bg-fg text-bg in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] on" : "flex-1 border-0 rounded-[12px] bg-chip text-muted font-semibold h-11 in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]"} onClick={() => setMethod(k)}>{l}</button>)}</div></MSec>
      <div className="sticky bottom-[calc(82px_+_env(safe-area-inset-bottom))] mt-auto flex gap-2.5 pt-3 px-0 pb-1.5 bg-bg z-5 print:hidden! in-[.m-app.nonav]:bottom-[env(safe-area-inset-bottom)]"><button className="w-full border-0 font-semibold text-[15px] [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.98)] h-13 rounded-[26px] bg-blue2 text-[#fff]" style={{ opacity: pay.isPending ? 0.6 : 1 }} disabled={pay.isPending} onClick={() => pay.mutate()}>{pay.isPending ? 'Closing…' : `Collect ${rupees(b.total)} by ${METHODS.find((m) => m[0] === method)![1]}`}</button></div>
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
      <div className="flex items-center gap-3.5">
        <span className="bg-chip2 flex items-center justify-center flex-none w-16 h-16 rounded-[32px] text-[24px] font-bold">{me.name[0]}</span>
        <div><div className="font-bold text-[20px]">{me.name}</div><div className="text-muted text-[13px]">Waiter · {w.sub}</div></div>
      </div>
      <div className="bg-card rounded-[18px] p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2.5 justify-between">
          <div><b>{w.onBreak ? 'On break' : 'On duty'}</b><div className="text-dim text-[12.5px]">Evening shift · 6 PM to 11 PM</div></div>
          <b className="text-[12.5px]" style={{ color: w.onBreak ? 'var(--color-amber)' : 'var(--color-green)' }}>{w.onBreak ? 'Break' : 'On duty'}</b>
        </div>
        <div className="flex rounded-[3px] overflow-hidden bg-chip2 h-1"><div className="bg-blue2" style={{ width: `${pct}%` }} /></div>
        <button className="border-0 rounded-[25px] flex items-center justify-center font-semibold text-[14px] text-fg bg-chip2 flex-none w-full active:[transform:scale(.98)] in-[.m-app]:min-h-11 h-10.5" onClick={w.toggleBreak}>{w.onBreak ? 'End break' : 'Take a break'}</button>
      </div>
      <div className="bg-card rounded-[18px] py-3.5 px-1 flex">
        {nums.map(([l, v]) => <div key={l} className="flex-1 text-center"><div className="font-bold text-[20px]">{v}</div><div className="text-dim text-[12.5px]">{l}</div></div>)}
      </div>
      <div>
        <button className="flex items-center w-full border-0 border-b border-b-line bg-transparent p-0 text-fg text-left last:border-b-0 min-h-13 gap-3" onClick={() => nav({ to: '/w/notifications' })}>
          <span className="text-muted flex"><Icon name="bell" size={20} /></span><span className="flex-1 min-w-0 font-medium">Notifications</span>{unread > 0 && <b className="text-[12.5px] text-blue">{unread}</b>}<Icon name="chev" size={16} />
        </button>
        <button className="flex items-center gap-2.5 w-full border-0 border-b border-b-line bg-transparent p-0 text-left last:border-b-0 min-h-13 text-red font-semibold" onClick={logout}>Sign out</button>
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
    <span className="inline-flex items-center h-11 rounded-[22px] bg-chip whitespace-nowrap flex-none [&_button]:w-11 [&_button]:h-11 [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-[22px] [&_button]:text-[#f5f5f5] mstep h-9!" aria-label="Guests at table">
      <button aria-label="Fewer guests" className="w-8.5! h-8.5! text-[17px]!" onClick={() => { const n = Math.max(1, g - 1); setGuests(n); if (who > n) setWho(0); }}>−</button>
      <b className="text-[13px]">{g} guests</b>
      <button aria-label="More guests" className="w-8.5! h-8.5! text-[17px]!" onClick={() => setGuests(Math.min(12, g + 1))}>+</button>
    </span>
  );
  const sub = table ? `${table.area} · ${table.seats} seats${table.waiter ? ' · ' + table.waiter.split(' ')[0] : ''}` : 'Pick a table';
  const cartGuests = [...new Set(lines.map(([k]) => Number(k.split(':')[0])))].sort((a, b) => a - b);
  return (
    <>
      <MHead title={table ? `Table ${table.code}` : 'Take order'} sub={table ? `${table.sessionId ? 'Add items' : 'New order'} · ${sub}` : sub} right={table ? <span className="pt-1">{stepper}</span> : undefined} />
      {!table && <Chips items={tables.data.tables.map((t: any) => [t.id, t.state === 'free' ? t.code : `${t.code} · ${t.guests}`] as [number, string])} value={tableId ?? -1} onChange={(v) => { setTableId(v); setGuests(null); setWho(1); }} />}
      {tables.data.tables.length === 0 && <Empty>No tables assigned to you yet. Ask the manager.</Empty>}
      <label className="flex items-center gap-2 h-11 py-0 px-3.5 rounded-[22px] bg-chip text-muted flex-none [&_input]:flex-1 [&_input]:min-w-0 [&_input]:border-0 [&_input]:[outline:0] [&_input]:bg-transparent [&_input]:text-[14px] wsearch"><Icon name="search" size={18} /><input aria-label="Search dishes" placeholder="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <div className="flex gap-2 overflow-x-auto flex-none [scrollbar-width:none] my-0 -mx-4 py-0 px-4 [&::-webkit-scrollbar]:hidden [&_button]:flex-none [&_button]:h-9 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[18px] [&_button]:border-0 [&_button]:bg-chip [&_button]:text-muted [&_button]:font-semibold [&_button]:text-[13px] [&_button]:whitespace-nowrap [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease)] [&_button.on]:bg-fg [&_button.on]:text-bg [&_button:active]:[transform:scale(.97)] in-[.m-app]:py-1 in-[.m-app]:px-4 in-[.m-app]:-my-1 in-[.m-app]:-mx-4 chips">{cats.map((c) => <button key={c.id} className={(!q.trim() && c.id === current) ? "on" : ""} onClick={() => { setCat(c.id); setQ(''); }}>{c.name}</button>)}</div>
      <div className="flex items-center gap-1.5">
        <span className="text-dim text-[12.5px] mr-0.5">For</span>
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&_button]:flex-none [&_button]:h-7.5 [&_button]:py-0 [&_button]:px-2.5 [&_button]:rounded-[15px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-semibold [&_button]:text-[12px] [&_button]:whitespace-nowrap [&_button.on]:bg-[rgba(59,130,246,.16)] [&_button.on]:border-blue2 [&_button.on]:text-[#9cc3fa] in-[.m-app]:py-1.75 in-[.m-app]:px-0 wfor">
          {Array.from({ length: g + 1 }, (_, n) => (n + 1) % (g + 1)).map((n) => { const c = n === 0 ? 0 : perGuest(n); return <button key={n} className={(n === who) ? "on" : ""} onClick={() => setWho(n)}>{n === 0 ? 'Shared' : `Guest ${n}${c ? ' · ' + c : ''}`}</button>; })}
        </div>
      </div>

      {dishes.length === 0 && <Empty>No dishes found</Empty>}
      {dishes.map((d) => {
        const n = qty[keyOf(who, d.id)] ?? 0; const out = !d.available; const sum = summary(d.id);
        const others = Array.from({ length: g + 1 }, (_, k) => k).filter((k) => k !== who && (qty[keyOf(k, d.id)] ?? 0) > 0).map((k) => `${k === 0 ? 'Shared' : 'G' + k} ×${qty[keyOf(k, d.id)]}`);
        return (
          <div key={d.id} className={(out) ? "bg-card rounded-[16px] p-3 flex flex-col gap-2.5 [animation:rise_var(--t-base)_var(--ease)_backwards] opacity-50" : "bg-card rounded-[16px] p-3 flex flex-col gap-2.5 [animation:rise_var(--t-base)_var(--ease)_backwards]"}>
            <div className="flex gap-3 items-stretch">
              <span className="w-16 h-16 rounded-[12px] bg-line flex items-center justify-center font-bold text-[20px] text-dim flex-none">{d.name[0]}</span>
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[2px] flex-none" style={{ border: `1.5px solid ${d.veg ? 'var(--color-green)' : 'var(--color-red)'}` }} /><b className="whitespace-nowrap overflow-hidden text-ellipsis">{d.name}</b></div>
                <div className="text-dim text-[12.5px]">{'price' in d ? rupees(d.price) + ' · ' : ''}{d.prepMinutes} min{others.length > 0 && <span className="text-blue"> · {others.join(', ')}</span>}</div>
                <div className="flex items-center gap-2.5 justify-between mt-auto">
                  {n > 0 && !out ? <button className="flex items-center border-0 bg-transparent p-0 text-blue font-semibold [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] h-8! gap-1 text-[13px]" onClick={() => setCustom(d)}><Icon name="pen" size={14} sw={2} />{summary(d.id) ? 'Edit changes' : 'Customize'}</button> : <span />}
                  {out ? <b className="text-dim text-[12.5px]">Sold out</b> : n === 0
                    ? <button className="h-8.5 border-0 rounded-[17px] font-semibold text-[13px] whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.97)] in-[.m-app]:min-h-11 bg-chip text-blue py-0 px-4" style={{ opacity: table ? 1 : 0.45 }} disabled={!table} onClick={() => bump(d.id, 1)}>Add</button>
                    : <span className="inline-flex items-center h-8.5 rounded-[17px] bg-chip2 [&_button]:w-8.5 [&_button]:h-8.5 [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-[17px] [&_button]:text-fg [&_b]:min-w-4 [&_b]:text-center wstep"><button aria-label={`Remove one ${d.name}`} onClick={() => bump(d.id, -1)}>−</button><b>{n}</b><button aria-label={`Add one ${d.name}`} onClick={() => bump(d.id, 1)}>+</button></span>}
                </div>
              </div>
            </div>
            {n > 0 && sum && <div className="text-[12.5px] text-[#f5c27a]">{sum}</div>}
          </div>
        );
      })}

      <div className="sticky bottom-[calc(82px_+_env(safe-area-inset-bottom))] mt-auto flex pt-3 px-0 pb-1.5 bg-bg z-5 print:hidden! in-[.m-app.nonav]:bottom-[env(safe-area-inset-bottom)] flex-col gap-2">
        {count > 0 && empty.length > 0 && g > 1 && <div className="text-[12.5px] text-[#f5c27a]">{empty.join(' and ')} {empty.length > 1 ? 'have' : 'has'} nothing yet</div>}
        <button className="w-full h-13 border-0 rounded-[26px] bg-blue2 text-[#fff] flex items-center justify-between py-0 px-5 font-semibold text-[15px] disabled:opacity-45" disabled={!count || !table} onClick={() => setReview(true)}><span>Review {count} item{count === 1 ? '' : 's'}{hasPrice ? ` · ${rupees(total)}` : ''}</span><span>Next</span></button>
      </div>

      {custom && (
        <Modal title={custom.name} onClose={() => setCustom(null)}>
          {custom.description && <div className="text-muted">{custom.description}</div>}
          {custom.hasSpice && <div><div className="text-muted text-[12.5px] mb-2">Spice level</div><div className="flex items-center gap-1.5">{SPICE.map((x) => <button key={x} className={((mods[custom.id] ?? DEFAULT).spice === x) ? "flex-1 border-0 font-semibold h-11 bg-fg text-bg in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] on h-9! rounded-[18px] text-[12.5px]" : "flex-1 border-0 bg-chip text-muted font-semibold h-11 in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] h-9! rounded-[18px] text-[12.5px]"} onClick={() => setMod(custom.id, { spice: x })}>{x === 'Extra spicy' ? 'Extra' : x}</button>)}</div></div>}
          {custom.options?.length > 0 && <div><div className="text-muted text-[12.5px] mb-2">Options</div><div className="flex items-center flex-wrap gap-1.5">{custom.options.map((o: string) => { const m = mods[custom.id] ?? DEFAULT; const on = m.opts.includes(o); return <button key={o} className={(on) ? "border-0 font-semibold h-11 bg-fg text-bg in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] on flex-none h-9! py-0 px-3.5 rounded-[18px] text-[12.5px]" : "border-0 bg-chip text-muted font-semibold h-11 in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] flex-none h-9! py-0 px-3.5 rounded-[18px] text-[12.5px]"} onClick={() => setMod(custom.id, { opts: on ? m.opts.filter((y) => y !== o) : [...m.opts, o] })}>{o}</button>; })}</div></div>}
          <label className="flex flex-col gap-1.5 text-[13px] text-muted">Note for the kitchen<textarea className="w-full rounded-[12px] border border-edge bg-chip text-fg [outline:0] h-auto py-3 px-3.5 resize-y focus:border-blue" rows={2} maxLength={200} placeholder="e.g. less oil, sauce on the side" value={(mods[custom.id] ?? DEFAULT).note} onChange={(e) => setMod(custom.id, { note: e.target.value })} /></label>
          <button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={() => setCustom(null)}>Done</button>
        </Modal>
      )}

      {review && (
        <Modal title={`Order${table ? ' · ' + table.code : ''}`} onClose={() => setReview(false)}>
          {lines.length === 0 && <Empty>Nothing added yet</Empty>}
          {cartGuests.map((gn) => (
            <div key={gn}>
              <div className="text-dim text-[12.5px] font-semibold mb-0.5">{gn ? `Guest ${gn}` : 'Shared'}</div>
              {lines.filter(([k]) => Number(k.split(':')[0]) === gn).map(([k, n]) => {
                const dishId = Number(k.split(':')[1]); const d = dish(dishId); const sum = summary(dishId);
                return (
                  <div key={k} className="flex items-center border-b border-b-line stagger last:border-b-0 py-2.5 px-0 gap-2.5">
                    <div className="flex-1 min-w-0"><b>{d?.name}</b>{sum && <div className="text-[12.5px] text-taupe">{sum}</div>}{d && 'price' in d && <div className="text-dim text-[12.5px]">{rupees(d.price * n)}</div>}</div>
                    <span className="inline-flex items-center h-8.5 rounded-[17px] bg-chip2 [&_button]:w-8.5 [&_button]:h-8.5 [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-[17px] [&_button]:text-fg [&_b]:min-w-4 [&_b]:text-center wstep"><button aria-label={`Remove one ${d?.name}`} onClick={() => bump(dishId, -1, gn)}>−</button><b>{n}</b><button aria-label={`Add one ${d?.name}`} onClick={() => bump(dishId, 1, gn)}>+</button></span>
                  </div>
                );
              })}
            </div>
          ))}
          {hasPrice && total > 0 && <div className="flex items-center gap-2.5"><span className="text-muted flex-1 min-w-0">Total before tax</span><b className="text-[18px]">{rupees(total)}</b></div>}
          {send.error && <div className="text-red text-[13.5px]">{(send.error as Error).message}</div>}
          <button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" disabled={!count || !table || send.isPending} onClick={() => send.mutate()}>{send.isPending ? 'Sending…' : `Send to kitchen · ${count} item${count === 1 ? '' : 's'}`}</button>
        </Modal>
      )}
    </>
  );
}
