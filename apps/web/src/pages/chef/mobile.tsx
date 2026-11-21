import { useEffect, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, session } from '../../api';
import { useNotifications } from '../../notify';
import { Icon, Loading, useChef, useToast } from '../../ui';
import { MHead, MSec } from '../manager/mobile';

/** Phone layouts for the chef pages. They mirror apps/mobile/app/chef/* and the MW-Chef*.dc.html designs. */

// ---------- shared helpers (same as apps/mobile/lib/chef-ui.tsx) ----------
type Ticket = { tableId: number; table: string; orderId: number; waiter: string | null; area: string; guests: number; items: any[]; oldest: string; target: number };
/** A ticket = every dish of one table in the same state. */
function tickets(items: any[]): Ticket[] {
  const by = new Map<number, Ticket>();
  for (const i of items) {
    const t = by.get(i.tableId);
    if (!t) by.set(i.tableId, { tableId: i.tableId, table: i.table, orderId: i.orderId, waiter: i.waiter, area: i.area, guests: i.guests, items: [i], oldest: i.createdAt, target: i.prepMinutes });
    else { t.items.push(i); if (new Date(i.createdAt) < new Date(t.oldest)) t.oldest = i.createdAt; t.target = Math.max(t.target, i.prepMinutes); }
  }
  return [...by.values()];
}
const minsSince = (d: string | null) => (d ? Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000)) : 0);
const pad = (n: number) => String(n).padStart(2, '0');
const noteOf = (i: any) => [i.spice, ...(i.options ?? []), i.note].filter(Boolean).join(' · ');
const Empty = ({ children, center }: { children: React.ReactNode; center?: boolean }) => <div className="dim" style={{ padding: center ? '24px 0' : '4px 0', textAlign: center ? 'center' : undefined }}>{children}</div>;

function doneStats(rows: any[]) {
  const prep = (r: any) => (r.claimedAt && r.readyAt ? Math.max(0, Math.round((new Date(r.readyAt).getTime() - new Date(r.claimedAt).getTime()) / 60000)) : 0);
  const made = rows.reduce((a, r) => a + r.qty, 0);
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + prep(r), 0) / rows.length) : 0;
  const onTime = rows.length ? Math.round((rows.filter((r) => prep(r) <= r.prepMinutes).length / rows.length) * 100) : 0;
  return { made, avg, onTime, prep };
}

/** Start / Ready that update the queue on screen straight away (rolled back if the server refuses). */
function useQueueActions() {
  const qc = useQueryClient(); const toast = useToast();
  const me = session.get()!.staff;
  const opt = (update: (old: any, ids: number[]) => any) => ({
    onMutate: async (ids: number[]) => {
      await qc.cancelQueries({ queryKey: ['queue'] });
      const prev = qc.getQueryData(['queue']);
      if (prev) qc.setQueryData(['queue'], update(prev, ids));
      return { prev };
    },
    onError: (e: Error, _ids: number[], ctx: any) => { if (ctx?.prev) qc.setQueryData(['queue'], ctx.prev); toast(e.message); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['queue'] }),
  });
  const claim = useMutation({
    mutationFn: (ids: number[]) => api('/kitchen/claim', { body: { ids: ids.slice(0, 10) } }),
    ...opt((old, ids) => {
      const moved = old.waiting.filter((i: any) => ids.includes(i.id)).map((i: any) => ({ ...i, status: 'cooking', claimedBy: me.id, claimedAt: new Date().toISOString(), chef: me.name }));
      return { ...old, waiting: old.waiting.filter((i: any) => !ids.includes(i.id)), cooking: [...old.cooking, ...moved] };
    }),
  });
  const ready = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => api(`/kitchen/items/${id}/ready`, { body: {} }))),
    ...opt((old, ids) => {
      const moved = old.cooking.filter((i: any) => ids.includes(i.id)).map((i: any) => ({ ...i, status: 'ready', readyAt: new Date().toISOString() }));
      return { ...old, cooking: old.cooking.filter((i: any) => !ids.includes(i.id)), ready: [...old.ready, ...moved] };
    }),
  });
  return { claim: (ids: number[]) => claim.mutate(ids), ready: (ids: number[]) => ready.mutate(ids) };
}

// ---------- Home (MW-Chef) ----------
type Tab = 'queue' | 'cooking' | 'ready' | 'done';
const TABS: [Tab, string, string][] = [['queue', 'Queue', 'var(--muted)'], ['cooking', 'Cooking', 'var(--amber)'], ['ready', 'Ready', '#5eb88a'], ['done', 'Done', 'var(--blue2)']];
const NOTE: Record<Tab, string> = { queue: 'Waiting to start', cooking: 'On the fire now', ready: 'Waiting for the waiter to pick up', done: 'Finished today' };
let ackedStop = 0; // the cancel notice the chef already dismissed

export function ChefHomeM() {
  const nav = useNavigate();
  const c = useChef();
  const [tab, setTab] = useState<Tab>('queue');
  const [, rerender] = useState(0);
  const done = useQuery({ queryKey: ['done'], queryFn: () => api('/kitchen/done') });
  const activity = useQuery({ queryKey: ['activity'], queryFn: () => api('/team/activity') });
  const qa = useQueueActions();
  const d = c.d;
  if (!d) return <Loading />;
  const mineCooking = d.cooking.filter((i: any) => i.claimedBy === c.me.id);
  const list = { queue: tickets(d.waiting), cooking: tickets(mineCooking), ready: tickets(d.ready), done: [] as Ticket[] }[tab];
  const st = doneStats(done.data ?? []);
  const counts: Record<Tab, number> = { queue: tickets(d.waiting).length, cooking: tickets(mineCooking).length, ready: tickets(d.ready).length, done: st.made };
  const mates = d.chefs.filter((x: any) => x.id !== c.me.id).map((x: any) => x.name.split(' ')[0]);
  const stop = (activity.data ?? []).find((a: any) => a.kind === 'void' && a.id > ackedStop && Date.now() - new Date(a.createdAt).getTime() < 10 * 60000);
  return (
    <>
      <button className="mline" style={{ minHeight: 44 }} onClick={() => nav({ to: '/c/station' })}>
        <span className="grow muted" style={{ fontSize: 13 }}>{mates.length ? `Shared with ${mates.join(' and ')} · ` : ''}{d.waiting.length} waiting</span>
        <b className="blue" style={{ fontSize: 13 }}>Station queue</b><span className="blue" style={{ display: 'flex' }}><Icon name="chev" size={14} /></span>
      </button>
      <div className="wtabs">
        {TABS.map(([k, label, dot]) => (
          <button key={k} className={k === tab ? 'on' : ''} onClick={() => setTab(k)}>
            <b style={{ fontSize: 22 }}>{counts[k]}</b>
            <span className="row-flex" style={{ gap: 5, fontSize: 12.5 }}><span className="dot" style={{ width: 6, height: 6, background: dot }} />{label}</span>
          </button>
        ))}
      </div>
      {stop && (
        <div role="alert" className="row-flex" style={{ gap: 10, padding: '10px 12px', borderRadius: 14, background: 'rgba(224,112,92,.12)' }}>
          <div className="grow"><b style={{ color: '#f09a88' }}>Stop: a dish was cancelled</b><div className="muted small">{stop.text}</div></div>
          <button className="wsmall" onClick={() => { ackedStop = stop.id; rerender((n) => n + 1); }}>Got it</button>
        </div>
      )}
      <div className="row-flex dim small" style={{ justifyContent: 'space-between' }}><span>{NOTE[tab]}</span><span>Oldest first</span></div>

      {tab === 'done' && (
        <button className="wcard row-flex" style={{ justifyContent: 'space-between', padding: 16, border: 0, color: 'var(--text)', textAlign: 'left' }} onClick={() => nav({ to: '/c/done' })}>
          <span><b>{st.made} dishes made today</b><span className="dim small" style={{ display: 'block' }}>Avg {st.avg} min · {st.onTime}% on time</span></span>
          <b className="blue">See all</b>
        </button>
      )}
      {tab !== 'done' && list.length === 0 && <Empty center>Nothing here right now.</Empty>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.map((k) => {
          const age = minsSince(k.oldest); const late = tab !== 'ready' && age > k.target;
          const time = tab === 'ready' ? `Ready ${minsSince(k.items[0].readyAt)}m ago` : age === 0 ? 'Just now' : `${age} min${late ? ' · late' : ''}`;
          const blocked = c.onBreak || c.mine + k.items.length > c.limit;
          return (
            <div key={`${tab}-${k.tableId}`} className={'wcard' + (late ? ' late' : '')}>
              <button className="mbtn row-flex" style={{ width: '100%', gap: 10, minHeight: 44 }} onClick={() => nav({ to: '/c/ticket/$table', params: { table: String(k.tableId) } })}>
                <b style={{ fontSize: 20 }}>{k.table}</b>
                <span className="dim small">#{k.orderId}{k.waiter ? ` · ${k.waiter.split(' ')[0]}` : ''}</span>
                <span className="grow" />
                <span className="row-flex" style={{ gap: 4, color: late ? 'var(--amber)' : 'var(--dim)' }}><Icon name="clock" size={14} /><b style={{ fontSize: 13 }}>{time}</b></span>
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '8px 0 12px' }}>
                {k.items.map((i) => (
                  <div key={i.id} className="row-flex" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <b className="blue" style={{ minWidth: 26, fontSize: 16 }}>{i.qty}×</b>
                    <div className="grow"><b style={{ fontSize: 15 }}>{i.name}</b>{noteOf(i) && <div style={{ fontSize: 12.5, color: '#f5c27a' }}>{noteOf(i)}</div>}{i.remake && <b className="red small">Remake</b>}</div>
                    <b className="muted" style={{ fontSize: 11 }}>{i.guestNo ? 'G' + i.guestNo : 'Shared'}</b>
                  </div>
                ))}
              </div>
              {tab === 'queue' && <button className="wbtn" disabled={blocked} style={{ background: 'var(--text)', color: 'var(--bg)', opacity: blocked ? 0.45 : 1 }} onClick={() => qa.claim(k.items.map((i) => i.id))}>{c.onBreak ? 'On break' : blocked ? 'At limit' : 'Start cooking'}</button>}
              {tab === 'cooking' && <button className="wbtn" style={{ background: 'var(--blue2)', color: '#fff' }} onClick={() => qa.ready(k.items.map((i) => i.id))}>Mark ready</button>}
              {tab === 'ready' && <div className="row-flex" style={{ height: 46, borderRadius: 23, justifyContent: 'center', gap: 8, background: 'rgba(94,184,138,.12)', color: '#7fcfa3', fontWeight: 600 }}><span className="dot" style={{ width: 7, height: 7, background: 'var(--green)' }} />At the pass{k.waiter ? ` · ${k.waiter.split(' ')[0]} notified` : ''}</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------- Station queue (MW-Station-Queue) ----------
export function StationQueuePage() {
  const c = useChef();
  const qa = useQueueActions();
  const d = c.d;
  if (!d) return <><MHead title="Station queue" /><Loading /></>;
  const waiting: any[] = d.waiting;
  const flag = (i: any): [string, string] => i.remake ? ['Remake', 'var(--red)'] : minsSince(i.createdAt) > i.prepMinutes * 0.7 ? ['Late soon', 'var(--amber)'] : ['', 'var(--dim)'];
  const by = new Map<string, any[]>();
  for (const i of waiting) by.set(i.name, [...(by.get(i.name) ?? []), i]);
  const batches = [...by.entries()].filter(([, l]) => new Set(l.map((x) => x.tableId)).size > 1);
  return (
    <>
      <MHead title={`${d.station.name} station`} sub={`Shared queue · ${d.chefs.length} chef${d.chefs.length === 1 ? '' : 's'}`} />
      <div className="row-flex" style={{ alignItems: 'stretch' }}>
        {d.chefs.map((x: any, i: number) => (
          <div key={x.id} style={{ flex: 1, minWidth: 0, paddingLeft: i ? 20 : 0, borderLeft: i ? '1px solid var(--chip2)' : 0 }}>
            <b className="ellipsis" style={{ display: 'block', fontSize: 13 }}>{x.id === c.me.id ? 'You' : x.name.split(' ')[0]}</b>
            <div className="row-flex" style={{ gap: 3, marginTop: 6 }}>{Array.from({ length: x.maxParallel }, (_, k) => <span key={k} style={{ width: 14, height: 4, borderRadius: 2, background: k < x.cooking ? 'var(--amber)' : 'var(--border)' }} />)}</div>
            {x.onBreak && <div className="amber" style={{ fontSize: 11.5 }}>On break</div>}
          </div>
        ))}
      </div>
      {c.full && <div style={{ fontSize: 12.5, color: '#f5c27a' }}>You are cooking {c.limit} dishes. Finish one to take the next.</div>}

      <MSec title="Cooking" right={<b className="muted">{d.cooking.length}</b>}>
        {d.cooking.length === 0 && <Empty>Nothing on the fire</Empty>}
        {d.cooking.map((i: any) => { const mine = i.claimedBy === c.me.id; const m = minsSince(i.claimedAt ?? i.createdAt); const late = m > i.prepMinutes; return (
          <div key={i.id} className="row" style={{ gap: 12, padding: '10px 0' }}>
            <div className="grow">
              <b><b className="bb">{i.table}</b> · {i.qty} × {i.name}</b>
              <div className="row-flex small" style={{ gap: 8 }}><b style={{ color: mine ? 'var(--blue)' : 'var(--muted)' }}>{mine ? 'You' : i.chef?.split(' ')[0]}</b><span style={{ color: late ? 'var(--amber)' : 'var(--dim)' }}>{m} / {i.prepMinutes} min</span></div>
            </div>
            {mine && <button className="wsmall blue" onClick={() => qa.ready([i.id])}>Ready</button>}
          </div>
        ); })}
      </MSec>

      {batches.length > 0 && (
        <MSec title="Start together">
          {batches.map(([name, l]) => { const fits = !c.onBreak && c.mine + l.length <= c.limit; return (
            <div key={name} className="row" style={{ gap: 12, padding: '10px 0' }}>
              <div className="grow"><b>{l.reduce((a, x) => a + x.qty, 0)} × {name}</b><div className="dim small">{l.map((x) => x.table).join(', ')}</div></div>
              {fits ? <button className="wsmall" onClick={() => qa.claim(l.map((x) => x.id))}>Start all</button> : <span className="dim small">At limit</span>}
            </div>
          ); })}
        </MSec>
      )}

      <MSec title="Waiting" right={<b className="muted">{waiting.length}</b>}>
        {waiting.length === 0 && <Empty>Queue is clear</Empty>}
        {waiting.map((i) => { const [f, fc] = flag(i); const blocked = c.onBreak || c.full; return (
          <div key={i.id} className="row" style={{ gap: 12, padding: '10px 0' }}>
            <div className="grow">
              <b><b className="bb">{i.table}</b> · {i.qty} × {i.name}</b>
              <div className="row-flex small" style={{ gap: 8 }}>
                <span style={{ color: f ? fc : 'var(--dim)' }}>{minsSince(i.createdAt)} min</span>{f && <b style={{ color: fc }}>{f}</b>}
                {noteOf(i) && <span className="taupe ellipsis grow">{noteOf(i)}</span>}
              </div>
            </div>
            {blocked ? <span className="dim small">{c.onBreak ? 'On break' : 'At limit'}</span> : <button className="wsmall" onClick={() => qa.claim([i.id])}>Start</button>}
          </div>
        ); })}
      </MSec>
    </>
  );
}

// ---------- Ticket (MW-Chef-Ticket) ----------
export function TicketPage() {
  const { table } = useParams({ strict: false }) as { table: string };
  const nav = useNavigate();
  const c = useChef();
  const qa = useQueueActions();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const d = c.d;
  if (!d) return <><MHead title="Ticket" /><Loading /></>;
  const all: any[] = [...d.waiting, ...d.cooking, ...d.ready].filter((i) => i.tableId === Number(table));
  if (all.length === 0) return <><MHead title="Ticket" /><Empty>Nothing left on this ticket.</Empty></>;
  const first = all[0];
  const active = all.filter((i) => i.status !== 'ready');
  const target = Math.max(...all.map((i) => i.prepMinutes));
  const placed = new Date(Math.min(...all.map((i) => new Date(i.createdAt).getTime())));
  const secs = Math.max(0, Math.round((Date.now() - placed.getTime()) / 1000));
  const late = Math.floor(secs / 60) - target;
  const over = active.length > 0 && late > 0;
  const others: any[] = (d.others ?? []).filter((o: any) => o.tableId === Number(table));
  const mineActive = active.filter((i) => i.status === 'cooking' && i.claimedBy === c.me.id);
  const look = (i: any): [string, string, string, () => void] | null => {
    if (i.status === 'ready') return ['✓ Ready', 'rgba(94,184,138,.14)', '#7fcfa3', () => {}];
    if (i.status === 'waiting') return ['Start', 'var(--text)', 'var(--bg)', () => qa.claim([i.id])];
    return i.claimedBy === c.me.id ? ['Mark ready', 'var(--blue2)', '#fff', () => qa.ready([i.id])] : null;
  };
  return (
    <>
      <MHead title={`Table ${first.table} · #${first.orderId}`} sub={`${first.area} · ${first.guests} guests${first.waiter ? ' · Waiter ' + first.waiter.split(' ')[0] : ''}`} />
      <div className="row-flex" style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div><div className="muted small">Time since order</div><div style={{ fontSize: 40, letterSpacing: -0.5, fontWeight: 700, lineHeight: 1.15, color: over ? '#f5c27a' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{pad(Math.floor(secs / 60))}:{pad(secs % 60)}</div></div>
        <div style={{ textAlign: 'right' }}>
          <b className="small" style={{ color: over ? '#f5c27a' : 'var(--muted)' }}>{over ? `Late by ${late} min` : 'On time'}</b>
          <div className="dim small">Target {target} min · placed {placed.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</div>
        </div>
      </div>
      <div className="bar" style={{ height: 4 }}><div style={{ background: over ? 'var(--amber)' : 'var(--blue2)', width: `${Math.min(100, (secs / 60 / target) * 100)}%` }} /></div>
      <MSec title="Dishes for your station">
        {all.map((i) => { const l = look(i); const done = i.status === 'ready'; return (
          <div key={i.id} className="row" style={{ gap: 12, alignItems: 'center' }}>
            <b className="blue" style={{ minWidth: 30, fontSize: 18 }}>{i.qty}×</b>
            <div className="grow">
              <b style={{ fontSize: 16, color: done ? 'var(--dim)' : undefined, textDecoration: done ? 'line-through' : undefined }}>{i.name}</b>
              {noteOf(i) && <div style={{ fontSize: 13, color: '#f5c27a' }}>{noteOf(i)}</div>}
              <div className="dim" style={{ fontSize: 12 }}>{i.guestNo ? 'Guest ' + i.guestNo : 'Shared'}{i.status === 'cooking' && i.chef ? ' · ' + (i.claimedBy === c.me.id ? 'You' : i.chef.split(' ')[0]) : ''}</div>
            </div>
            {l && <button className="wsmall" disabled={done} style={{ height: 44, padding: '0 16px', background: l[1], color: l[2] }} onClick={l[3]}>{l[0]}</button>}
          </div>
        ); })}
      </MSec>
      {others.length > 0 && (
        <div className="row-flex" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <span className="muted" style={{ fontSize: 13 }}>Other stations on this order</span>
          <span className="grow" style={{ fontSize: 13, textAlign: 'right' }}>{others.map((o) => `${o.station} · ${o.n} dish${o.n > 1 ? 'es' : ''} ${o.status === 'cooking' ? 'cooking' : 'waiting'}`).join(', ')}</span>
        </div>
      )}
      <div className="mfoot" style={{ flexDirection: 'column' }}>
        <button className="wbtn" style={{ height: 54, borderRadius: 27, background: 'var(--blue2)', color: '#fff', opacity: mineActive.length ? 1 : 0.6 }} disabled={mineActive.length === 0} onClick={() => qa.ready(mineActive.map((i) => i.id))}>{active.length ? `Mark all ready (${mineActive.length} left)` : `All ready${first.waiter ? ' · ' + first.waiter.split(' ')[0] + ' notified' : ''}`}</button>
        <button className="wbtn" style={{ height: 44, borderRadius: 22, background: 'var(--chip)', color: '#f09a88', fontSize: 13.5 }} onClick={() => nav({ to: '/c/stock', replace: true })}>Can't make a dish</button>
      </div>
    </>
  );
}

// ---------- Done today (MW-Chef-Done) ----------
export function ChefDoneM() {
  const q = useQuery({ queryKey: ['done'], queryFn: () => api('/kitchen/done') });
  const rows: any[] = q.data ?? [];
  const st = doneStats(rows);
  const now = new Date();
  const hours = Array.from({ length: 6 }, (_, i) => (now.getHours() - 5 + i + 24) % 24);
  const per = hours.map((h) => rows.filter((r) => r.readyAt && new Date(r.readyAt).getHours() === h).reduce((a, r) => a + r.qty, 0));
  const max = Math.max(1, ...per);
  const label = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;
  return !q.data ? <Loading /> : (
    <>
      <div className="row-flex" style={{ gap: 12, paddingBottom: 14, borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
        <div className="grow"><div className="bb" style={{ fontSize: 24 }}>{st.made}</div><div className="dim small">Dishes made</div></div>
        <div className="grow"><div className="bb" style={{ fontSize: 24 }}>{st.avg}m</div><div className="dim small">Avg prep time</div></div>
        <div className="grow"><div className="bb" style={{ fontSize: 24, color: '#7fcfa3' }}>{st.onTime}%</div><div className="dim small">On time</div></div>
      </div>
      <MSec title="Dishes per hour">
        <div className="row-flex" style={{ alignItems: 'flex-end', gap: 6, height: 90 }}>
          {per.map((v, i) => (
            <div key={i} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
              <span className="muted" style={{ fontSize: 11 }}>{v}</span>
              <div style={{ width: '100%', borderRadius: 3, background: 'var(--blue2)', opacity: i === per.length - 1 ? 1 : 0.55, height: `${Math.round((v / max) * 80)}%` }} />
            </div>
          ))}
        </div>
        <div className="row-flex" style={{ gap: 6, marginTop: 6 }}>{hours.map((h) => <span key={h} className="dim" style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>{label(h)}</span>)}</div>
      </MSec>
      <MSec title="Recent">
        {rows.length === 0 && <Empty>Nothing finished yet today</Empty>}
        {rows.slice(0, 10).map((r) => { const m = st.prep(r); return (
          <div key={r.id} className="row" style={{ gap: 12, minHeight: 52, padding: 0 }}>
            <span className="dim small" style={{ width: 52 }}>{new Date(r.readyAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: false })}</span>
            <div className="grow"><b>{r.qty} × {r.name}</b><div className="dim small">{r.table}{r.waiter ? ` · ${r.waiter.split(' ')[0]}` : ''}</div></div>
            <b style={{ fontSize: 13, color: m > r.prepMinutes ? '#f5c27a' : '#7fcfa3' }}>{m} min</b>
          </div>
        ); })}
      </MSec>
    </>
  );
}

// ---------- Stock (MW-Chef-Stock) ----------
export function ChefStockM() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['stock'], queryFn: () => api('/kitchen/stock') });
  const m = useMutation({ mutationFn: ([id, available]: [number, boolean]) => api(`/kitchen/dishes/${id}/stock`, { method: 'PATCH', body: { available } }), onSuccess: () => qc.invalidateQueries() });
  const d = q.data;
  return (
    <>
      <MHead back={false} title="Stock" sub={d ? `${d.station.name} station · turn off anything you can't make` : ''} />
      {!d ? <Loading /> : (
        <div>
          {d.dishes.map((x: any) => (
            <div key={x.id} className="row" style={{ gap: 12, minHeight: 60, padding: 0 }}>
              <div className="grow"><b style={{ color: x.available ? 'var(--text)' : 'var(--dim)' }}>{x.name}</b><div className="small" style={{ color: x.available ? 'var(--dim)' : 'var(--red)' }}>{x.available ? `${x.made} made today` : 'Sold out · hidden from menu'}</div></div>
              <button role="switch" aria-checked={x.available} aria-label={`${x.name} available`} className="mswitch" onClick={() => m.mutate([x.id, !x.available])}><span className={x.available ? 'on' : ''}><i /></span></button>
            </div>
          ))}
          {d.dishes.length === 0 && <Empty>No dishes on this station</Empty>}
        </div>
      )}
      <div className="dim small">Turning a dish off hides it from waiters and the guest QR menu straight away.</div>
    </>
  );
}

// ---------- Profile (MW-Profile, chef version) ----------
const START = 18 * 60, END = 23 * 60; // tonight's shift window shown in the design
export function ChefProfilePage() {
  const nav = useNavigate();
  const c = useChef();
  const done = useQuery({ queryKey: ['done'], queryFn: () => api('/kitchen/done') });
  const { unread } = useNotifications();
  const logout = async () => { await api('/auth/logout', { body: {} }).catch(() => {}); session.clear(); nav({ to: '/login' }); };
  const now = new Date(); const m = now.getHours() * 60 + now.getMinutes();
  const pct = Math.max(0, Math.min(100, ((m - START) / (END - START)) * 100));
  const st = doneStats(done.data ?? []);
  const have = !!done.data;
  const nums: [string, string][] = [['Dishes made', have ? String(st.made) : '–'], ['Avg prep time', have ? `${st.avg}m` : '–'], ['On time', have ? `${st.onTime}%` : '–']];
  return (
    <>
      <div className="row-flex" style={{ gap: 14 }}>
        <span className="avatar" style={{ width: 64, height: 64, borderRadius: 32, fontSize: 24, fontWeight: 700 }}>{c.me.name[0]}</span>
        <div><div className="bb" style={{ fontSize: 20 }}>{c.me.name}</div><div className="muted" style={{ fontSize: 13 }}>Chef · {c.sub}</div></div>
      </div>
      <div className="mcard" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row-flex" style={{ justifyContent: 'space-between' }}>
          <div><b>{c.onBreak ? 'On break' : 'On duty'}</b><div className="dim small">Evening shift · 6 PM to 11 PM</div></div>
          <b className="small" style={{ color: c.onBreak ? 'var(--amber)' : 'var(--green)' }}>{c.onBreak ? 'Break' : 'On duty'}</b>
        </div>
        <div className="bar" style={{ height: 4 }}><div style={{ background: 'var(--blue2)', width: `${pct}%` }} /></div>
        <button className="mpill chip" style={{ height: 44 }} onClick={c.toggleBreak}>{c.onBreak ? 'End break' : 'Take a break'}</button>
      </div>
      <div className="mcard" style={{ padding: '14px 4px', display: 'flex' }}>
        {nums.map(([l, v]) => <div key={l} style={{ flex: 1, textAlign: 'center' }}><div className="bb" style={{ fontSize: 20 }}>{v}</div><div className="dim small">{l}</div></div>)}
      </div>
      <div>
        <button className="mline" style={{ minHeight: 52, gap: 12 }} onClick={() => nav({ to: '/c/notifications' })}>
          <span style={{ color: 'var(--muted)', display: 'flex' }}><Icon name="bell" size={20} /></span><span className="grow" style={{ fontWeight: 500 }}>Notifications</span>{unread > 0 && <b className="blue small">{unread}</b>}<Icon name="chev" size={16} />
        </button>
        <button className="mline" style={{ minHeight: 52, color: 'var(--red)', fontWeight: 600 }} onClick={logout}>Sign out</button>
      </div>
    </>
  );
}

