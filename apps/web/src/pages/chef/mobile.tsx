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
const Empty = ({ children, center }: { children: React.ReactNode; center?: boolean }) => <div className="text-dim" style={{ padding: center ? '24px 0' : '4px 0', textAlign: center ? 'center' : undefined }}>{children}</div>;

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
const TABS: [Tab, string, string][] = [['queue', 'Queue', 'var(--color-muted)'], ['cooking', 'Cooking', 'var(--color-amber)'], ['ready', 'Ready', '#5eb88a'], ['done', 'Done', 'var(--color-blue2)']];
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
      <button className="flex items-center gap-2.5 w-full border-0 border-b border-b-line bg-transparent p-0 text-fg text-left last:border-b-0 min-h-11" onClick={() => nav({ to: '/c/station' })}>
        <span className="text-muted flex-1 min-w-0 text-[13px]">{mates.length ? `Shared with ${mates.join(' and ')} · ` : ''}{d.waiting.length} waiting</span>
        <b className="text-blue text-[13px]">Station queue</b><span className="text-blue flex"><Icon name="chev" size={14} /></span>
      </button>
      <div className="flex border-b border-b-line [&_button]:flex-1 [&_button]:h-16 [&_button]:flex [&_button]:flex-col [&_button]:items-start [&_button]:justify-center [&_button]:border-0 [&_button]:border-b-2 [&_button]:border-b-transparent [&_button]:bg-transparent [&_button]:text-muted [&_button]:p-0 [&_button]:[transition:color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease)] [&_button.on]:text-fg [&_button.on]:border-b-blue [&_button.on_span]:font-bold">
        {TABS.map(([k, label, dot]) => (
          <button key={k} className={(k === tab) ? "on" : ""} onClick={() => setTab(k)}>
            <b className="text-[22px]">{counts[k]}</b>
            <span className="flex items-center gap-1.25 text-[12.5px]"><span className="rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)] w-1.5 h-1.5" style={{ background: dot }} />{label}</span>
          </button>
        ))}
      </div>
      {stop && (
        <div role="alert" className="flex items-center gap-2.5 py-2.5 px-3 rounded-[14px] bg-[rgba(224,112,92,.12)]">
          <div className="flex-1 min-w-0"><b className="text-[#f09a88]">Stop: a dish was cancelled</b><div className="text-muted text-[12.5px]">{stop.text}</div></div>
          <button className="h-8.5 py-0 px-3.5 border-0 rounded-[17px] font-semibold text-[13px] bg-fg text-bg whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.97)] in-[.m-app]:min-h-11" onClick={() => { ackedStop = stop.id; rerender((n) => n + 1); }}>Got it</button>
        </div>
      )}
      <div className="text-dim text-[12.5px] flex items-center gap-2.5 justify-between"><span>{NOTE[tab]}</span><span>Oldest first</span></div>

      {tab === 'done' && (
        <button className="flex items-center gap-2.5 bg-card rounded-[16px] border-transparent [animation:rise_var(--t-base)_var(--ease)_backwards] justify-between p-4 border-0 text-fg text-left" onClick={() => nav({ to: '/c/done' })}>
          <span><b>{st.made} dishes made today</b><span className="text-dim text-[12.5px] block">Avg {st.avg} min · {st.onTime}% on time</span></span>
          <b className="text-blue">See all</b>
        </button>
      )}
      {tab !== 'done' && list.length === 0 && <Empty center>Nothing here right now.</Empty>}
      <div className="flex flex-col gap-2.5">
        {list.map((k) => {
          const age = minsSince(k.oldest); const late = tab !== 'ready' && age > k.target;
          const time = tab === 'ready' ? `Ready ${minsSince(k.items[0].readyAt)}m ago` : age === 0 ? 'Just now' : `${age} min${late ? ' · late' : ''}`;
          const blocked = c.onBreak || c.mine + k.items.length > c.limit;
          return (
            <div key={`${tab}-${k.tableId}`} className={(late) ? "bg-card rounded-[16px] p-3.5 border [animation:rise_var(--t-base)_var(--ease)_backwards] border-[rgba(245,180,84,.45)]" : "bg-card rounded-[16px] p-3.5 border border-transparent [animation:rise_var(--t-base)_var(--ease)_backwards]"}>
              <button className="flex items-center border-0 bg-transparent p-0 text-fg text-left in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] w-full! gap-2.5 min-h-11" onClick={() => nav({ to: '/c/ticket/$table', params: { table: String(k.tableId) } })}>
                <b className="text-[20px]">{k.table}</b>
                <span className="text-dim text-[12.5px]">#{k.orderId}{k.waiter ? ` · ${k.waiter.split(' ')[0]}` : ''}</span>
                <span className="flex-1 min-w-0" />
                <span className="flex items-center gap-1" style={{ color: late ? 'var(--color-amber)' : 'var(--color-dim)' }}><Icon name="clock" size={14} /><b className="text-[13px]">{time}</b></span>
              </button>
              <div className="flex flex-col gap-2 mt-2 mx-0 mb-3">
                {k.items.map((i) => (
                  <div key={i.id} className="flex gap-2.5 items-start">
                    <b className="text-blue min-w-6.5 text-[16px]">{i.qty}×</b>
                    <div className="flex-1 min-w-0"><b className="text-[15px]">{i.name}</b>{noteOf(i) && <div className="text-[12.5px] text-[#f5c27a]">{noteOf(i)}</div>}{i.remake && <b className="text-[12.5px] text-red">Remake</b>}</div>
                    <b className="text-muted text-[11px]">{i.guestNo ? 'G' + i.guestNo : 'Shared'}</b>
                  </div>
                ))}
              </div>
              {tab === 'queue' && <button className="w-full h-11.5 border-0 rounded-[23px] font-semibold text-[15px] [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.98)] bg-fg text-bg" disabled={blocked} style={{ opacity: blocked ? 0.45 : 1 }} onClick={() => qa.claim(k.items.map((i) => i.id))}>{c.onBreak ? 'On break' : blocked ? 'At limit' : 'Start cooking'}</button>}
              {tab === 'cooking' && <button className="w-full h-11.5 border-0 rounded-[23px] font-semibold text-[15px] [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.98)] bg-blue2 text-[#fff]" onClick={() => qa.ready(k.items.map((i) => i.id))}>Mark ready</button>}
              {tab === 'ready' && <div className="flex items-center h-11.5 rounded-[23px] justify-center gap-2 bg-[rgba(94,184,138,.12)] text-[#7fcfa3] font-semibold"><span className="rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)] w-1.75 h-1.75 bg-green" />At the pass{k.waiter ? ` · ${k.waiter.split(' ')[0]} notified` : ''}</div>}
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
  const flag = (i: any): [string, string] => i.remake ? ['Remake', 'var(--color-red)'] : minsSince(i.createdAt) > i.prepMinutes * 0.7 ? ['Late soon', 'var(--color-amber)'] : ['', 'var(--color-dim)'];
  const by = new Map<string, any[]>();
  for (const i of waiting) by.set(i.name, [...(by.get(i.name) ?? []), i]);
  const batches = [...by.entries()].filter(([, l]) => new Set(l.map((x) => x.tableId)).size > 1);
  return (
    <>
      <MHead title={`${d.station.name} station`} sub={`Shared queue · ${d.chefs.length} chef${d.chefs.length === 1 ? '' : 's'}`} />
      <div className="flex gap-2.5 items-stretch">
        {d.chefs.map((x: any, i: number) => (
          <div key={x.id} className="flex-1 min-w-0" style={{ paddingLeft: i ? 20 : 0, borderLeft: i ? '1px solid var(--color-chip2)' : 0 }}>
            <b className="whitespace-nowrap overflow-hidden text-ellipsis block text-[13px]">{x.id === c.me.id ? 'You' : x.name.split(' ')[0]}</b>
            <div className="flex items-center gap-0.75 mt-1.5">{Array.from({ length: x.maxParallel }, (_, k) => <span key={k} className="w-3.5 h-1 rounded-[2px]" style={{ background: k < x.cooking ? 'var(--color-amber)' : 'var(--color-edge)' }} />)}</div>
            {x.onBreak && <div className="text-amber text-[11.5px]">On break</div>}
          </div>
        ))}
      </div>
      {c.full && <div className="text-[12.5px] text-[#f5c27a]">You are cooking {c.limit} dishes. Finish one to take the next.</div>}

      <MSec title="Cooking" right={<b className="text-muted">{d.cooking.length}</b>}>
        {d.cooking.length === 0 && <Empty>Nothing on the fire</Empty>}
        {d.cooking.map((i: any) => { const mine = i.claimedBy === c.me.id; const m = minsSince(i.claimedAt ?? i.createdAt); const late = m > i.prepMinutes; return (
          <div key={i.id} className="flex items-center border-b border-b-line stagger last:border-b-0 gap-3 py-2.5 px-0">
            <div className="flex-1 min-w-0">
              <b><b className="font-bold">{i.table}</b> · {i.qty} × {i.name}</b>
              <div className="text-[12.5px] flex items-center gap-2"><b style={{ color: mine ? 'var(--color-blue)' : 'var(--color-muted)' }}>{mine ? 'You' : i.chef?.split(' ')[0]}</b><span style={{ color: late ? 'var(--color-amber)' : 'var(--color-dim)' }}>{m} / {i.prepMinutes} min</span></div>
            </div>
            {mine && <button className="h-8.5 py-0 px-3.5 border-0 rounded-[17px] font-semibold text-[13px] whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease)] bg-blue2 text-[#fff] active:[transform:scale(.97)] in-[.m-app]:min-h-11" onClick={() => qa.ready([i.id])}>Ready</button>}
          </div>
        ); })}
      </MSec>

      {batches.length > 0 && (
        <MSec title="Start together">
          {batches.map(([name, l]) => { const fits = !c.onBreak && c.mine + l.length <= c.limit; return (
            <div key={name} className="flex items-center border-b border-b-line stagger last:border-b-0 gap-3 py-2.5 px-0">
              <div className="flex-1 min-w-0"><b>{l.reduce((a, x) => a + x.qty, 0)} × {name}</b><div className="text-dim text-[12.5px]">{l.map((x) => x.table).join(', ')}</div></div>
              {fits ? <button className="h-8.5 py-0 px-3.5 border-0 rounded-[17px] font-semibold text-[13px] bg-fg text-bg whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.97)] in-[.m-app]:min-h-11" onClick={() => qa.claim(l.map((x) => x.id))}>Start all</button> : <span className="text-dim text-[12.5px]">At limit</span>}
            </div>
          ); })}
        </MSec>
      )}

      <MSec title="Waiting" right={<b className="text-muted">{waiting.length}</b>}>
        {waiting.length === 0 && <Empty>Queue is clear</Empty>}
        {waiting.map((i) => { const [f, fc] = flag(i); const blocked = c.onBreak || c.full; return (
          <div key={i.id} className="flex items-center border-b border-b-line stagger last:border-b-0 gap-3 py-2.5 px-0">
            <div className="flex-1 min-w-0">
              <b><b className="font-bold">{i.table}</b> · {i.qty} × {i.name}</b>
              <div className="text-[12.5px] flex items-center gap-2">
                <span style={{ color: f ? fc : 'var(--color-dim)' }}>{minsSince(i.createdAt)} min</span>{f && <b style={{ color: fc }}>{f}</b>}
                {noteOf(i) && <span className="text-taupe flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">{noteOf(i)}</span>}
              </div>
            </div>
            {blocked ? <span className="text-dim text-[12.5px]">{c.onBreak ? 'On break' : 'At limit'}</span> : <button className="h-8.5 py-0 px-3.5 border-0 rounded-[17px] font-semibold text-[13px] bg-fg text-bg whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.97)] in-[.m-app]:min-h-11" onClick={() => qa.claim([i.id])}>Start</button>}
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
    if (i.status === 'waiting') return ['Start', 'var(--color-fg)', 'var(--color-bg)', () => qa.claim([i.id])];
    return i.claimedBy === c.me.id ? ['Mark ready', 'var(--color-blue2)', '#fff', () => qa.ready([i.id])] : null;
  };
  return (
    <>
      <MHead title={`Table ${first.table} · #${first.orderId}`} sub={`${first.area} · ${first.guests} guests${first.waiter ? ' · Waiter ' + first.waiter.split(' ')[0] : ''}`} />
      <div className="flex gap-2.5 items-end justify-between">
        <div><div className="text-muted text-[12.5px]">Time since order</div><div className="text-[40px] tracking-[-0.5px] font-bold leading-[1.15] tabular-nums" style={{ color: over ? '#f5c27a' : 'var(--color-fg)' }}>{pad(Math.floor(secs / 60))}:{pad(secs % 60)}</div></div>
        <div className="text-right">
          <b className="text-[12.5px]" style={{ color: over ? '#f5c27a' : 'var(--color-muted)' }}>{over ? `Late by ${late} min` : 'On time'}</b>
          <div className="text-dim text-[12.5px]">Target {target} min · placed {placed.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</div>
        </div>
      </div>
      <div className="flex rounded-[3px] overflow-hidden bg-chip2 h-1"><div style={{ background: over ? 'var(--color-amber)' : 'var(--color-blue2)', width: `${Math.min(100, (secs / 60 / target) * 100)}%` }} /></div>
      <MSec title="Dishes for your station">
        {all.map((i) => { const l = look(i); const done = i.status === 'ready'; return (
          <div key={i.id} className="flex py-3.5 px-0 border-b border-b-line stagger last:border-b-0 gap-3 items-center">
            <b className="text-blue min-w-7.5 text-[18px]">{i.qty}×</b>
            <div className="flex-1 min-w-0">
              <b className="text-[16px]" style={{ color: done ? 'var(--color-dim)' : undefined, textDecoration: done ? 'line-through' : undefined }}>{i.name}</b>
              {noteOf(i) && <div className="text-[13px] text-[#f5c27a]">{noteOf(i)}</div>}
              <div className="text-dim text-[12px]">{i.guestNo ? 'Guest ' + i.guestNo : 'Shared'}{i.status === 'cooking' && i.chef ? ' · ' + (i.claimedBy === c.me.id ? 'You' : i.chef.split(' ')[0]) : ''}</div>
            </div>
            {l && <button className="border-0 rounded-[17px] font-semibold text-[13px] bg-fg text-bg whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.97)] in-[.m-app]:min-h-11 h-11 py-0 px-4" disabled={done} style={{ background: l[1], color: l[2] }} onClick={l[3]}>{l[0]}</button>}
          </div>
        ); })}
      </MSec>
      {others.length > 0 && (
        <div className="flex justify-between gap-3 items-start">
          <span className="text-muted text-[13px]">Other stations on this order</span>
          <span className="flex-1 min-w-0 text-[13px] text-right">{others.map((o) => `${o.station} · ${o.n} dish${o.n > 1 ? 'es' : ''} ${o.status === 'cooking' ? 'cooking' : 'waiting'}`).join(', ')}</span>
        </div>
      )}
      <div className="sticky bottom-[calc(82px_+_env(safe-area-inset-bottom))] mt-auto flex gap-2.5 pt-3 px-0 pb-1.5 bg-bg z-5 print:hidden! in-[.m-app.nonav]:bottom-[env(safe-area-inset-bottom)] flex-col">
        <button className="w-full border-0 font-semibold text-[15px] [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.98)] h-13.5 rounded-[27px] bg-blue2 text-[#fff]" style={{ opacity: mineActive.length ? 1 : 0.6 }} disabled={mineActive.length === 0} onClick={() => qa.ready(mineActive.map((i) => i.id))}>{active.length ? `Mark all ready (${mineActive.length} left)` : `All ready${first.waiter ? ' · ' + first.waiter.split(' ')[0] + ' notified' : ''}`}</button>
        <button className="w-full border-0 font-semibold [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.98)] h-11 rounded-[22px] bg-chip text-[#f09a88] text-[13.5px]" onClick={() => nav({ to: '/c/stock', replace: true })}>Can't make a dish</button>
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
      <div className="flex gap-3 pb-3.5 border-b border-b-line items-start">
        <div className="flex-1 min-w-0"><div className="font-bold text-[24px]">{st.made}</div><div className="text-dim text-[12.5px]">Dishes made</div></div>
        <div className="flex-1 min-w-0"><div className="font-bold text-[24px]">{st.avg}m</div><div className="text-dim text-[12.5px]">Avg prep time</div></div>
        <div className="flex-1 min-w-0"><div className="font-bold text-[24px] text-[#7fcfa3]">{st.onTime}%</div><div className="text-dim text-[12.5px]">On time</div></div>
      </div>
      <MSec title="Dishes per hour">
        <div className="flex items-end gap-1.5 h-22.5">
          {per.map((v, i) => (
            <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-1">
              <span className="text-muted text-[11px]">{v}</span>
              <div className="w-full rounded-[3px] bg-blue2" style={{ opacity: i === per.length - 1 ? 1 : 0.55, height: `${Math.round((v / max) * 80)}%` }} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">{hours.map((h) => <span key={h} className="text-dim flex-1 text-center text-[11px]">{label(h)}</span>)}</div>
      </MSec>
      <MSec title="Recent">
        {rows.length === 0 && <Empty>Nothing finished yet today</Empty>}
        {rows.slice(0, 10).map((r) => { const m = st.prep(r); return (
          <div key={r.id} className="flex items-center border-b border-b-line stagger last:border-b-0 gap-3 min-h-13 p-0">
            <span className="text-dim text-[12.5px] w-13">{new Date(r.readyAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: false })}</span>
            <div className="flex-1 min-w-0"><b>{r.qty} × {r.name}</b><div className="text-dim text-[12.5px]">{r.table}{r.waiter ? ` · ${r.waiter.split(' ')[0]}` : ''}</div></div>
            <b className="text-[13px]" style={{ color: m > r.prepMinutes ? '#f5c27a' : '#7fcfa3' }}>{m} min</b>
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
            <div key={x.id} className="flex items-center border-b border-b-line stagger last:border-b-0 gap-3 min-h-15 p-0">
              <div className="flex-1 min-w-0"><b style={{ color: x.available ? 'var(--color-fg)' : 'var(--color-dim)' }}>{x.name}</b><div className="text-[12.5px]" style={{ color: x.available ? 'var(--color-dim)' : 'var(--color-red)' }}>{x.available ? `${x.made} made today` : 'Sold out · hidden from menu'}</div></div>
              <button role="switch" aria-checked={x.available} aria-label={`${x.name} available`} className="w-13 h-11 border-0 bg-transparent p-0 flex items-center justify-end [&>span]:w-11 [&>span]:h-6.5 [&>span]:rounded-[13px] [&>span]:p-0.75 [&>span]:bg-[#3a3a40] [&>span]:flex [&>span]:items-center [&>span]:justify-start [&>span]:[transition:background-color_var(--t-base)_var(--ease)] [&>span.on]:bg-blue2 [&>span.on]:justify-end [&_i]:w-5 [&_i]:h-5 [&_i]:rounded-[10px] [&_i]:bg-fg" onClick={() => m.mutate([x.id, !x.available])}><span className={(x.available) ? "on" : ""}><i /></span></button>
            </div>
          ))}
          {d.dishes.length === 0 && <Empty>No dishes on this station</Empty>}
        </div>
      )}
      <div className="text-dim text-[12.5px]">Turning a dish off hides it from waiters and the guest QR menu straight away.</div>
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
      <div className="flex items-center gap-3.5">
        <span className="bg-chip2 flex items-center justify-center flex-none w-16 h-16 rounded-[32px] text-[24px] font-bold">{c.me.name[0]}</span>
        <div><div className="font-bold text-[20px]">{c.me.name}</div><div className="text-muted text-[13px]">Chef · {c.sub}</div></div>
      </div>
      <div className="bg-card rounded-[18px] p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2.5 justify-between">
          <div><b>{c.onBreak ? 'On break' : 'On duty'}</b><div className="text-dim text-[12.5px]">Evening shift · 6 PM to 11 PM</div></div>
          <b className="text-[12.5px]" style={{ color: c.onBreak ? 'var(--color-amber)' : 'var(--color-green)' }}>{c.onBreak ? 'Break' : 'On duty'}</b>
        </div>
        <div className="flex rounded-[3px] overflow-hidden bg-chip2 h-1"><div className="bg-blue2" style={{ width: `${pct}%` }} /></div>
        <button className="border-0 rounded-[25px] flex items-center justify-center font-semibold text-[14px] text-fg bg-chip2 flex-none w-full active:[transform:scale(.98)] in-[.m-app]:min-h-11 h-11" onClick={c.toggleBreak}>{c.onBreak ? 'End break' : 'Take a break'}</button>
      </div>
      <div className="bg-card rounded-[18px] py-3.5 px-1 flex">
        {nums.map(([l, v]) => <div key={l} className="flex-1 text-center"><div className="font-bold text-[20px]">{v}</div><div className="text-dim text-[12.5px]">{l}</div></div>)}
      </div>
      <div>
        <button className="flex items-center w-full border-0 border-b border-b-line bg-transparent p-0 text-fg text-left last:border-b-0 min-h-13 gap-3" onClick={() => nav({ to: '/c/notifications' })}>
          <span className="text-muted flex"><Icon name="bell" size={20} /></span><span className="flex-1 min-w-0 font-medium">Notifications</span>{unread > 0 && <b className="text-[12.5px] text-blue">{unread}</b>}<Icon name="chev" size={16} />
        </button>
        <button className="flex items-center gap-2.5 w-full border-0 border-b border-b-line bg-transparent p-0 text-left last:border-b-0 min-h-13 text-red font-semibold" onClick={logout}>Sign out</button>
      </div>
    </>
  );
}

