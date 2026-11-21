import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { ITEM_LABEL, rupees, type ItemStatus } from '@dineos/shared';
import { api, session } from '../../api';
import { since, useNotifications } from '../../notify';
import { Icon, Loading, StatusDot, useIsMobile, useMe, useToast } from '../../ui';

/** Phone layouts for the manager / owner / admin pages. They mirror apps/mobile/app/manager/* and the MW-*.dc.html designs.
 *  Every component gets its data and handlers from the desktop page, so queries and mutations stay in one place. */

// ---------- small pieces ----------
export function useBack() {
  const nav = useNavigate();
  return () => (window.history.length > 1 ? window.history.back() : nav({ to: '/dashboard' }));
}
/** ← and the 26px heading on one line (sidebar pages have no top bar on phones) */
export function MHead({ title, sub, right, back = true }: { title: string; sub?: ReactNode; right?: ReactNode; back?: boolean }) {
  const goBack = useBack();
  const mobile = useIsMobile(); // on desktop the shell already has a Back button
  return (
    <div className="mh">
      <div className="mh-l">
        {back && mobile && <button className="mh-back" aria-label="Back" onClick={goBack}><Icon name="back" size={22} /></button>}
        <div style={{ minWidth: 0 }}><h1>{title}</h1>{sub !== undefined && <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{sub || ' '}</div>}</div>
      </div>
      {right}
    </div>
  );
}
export const MAction = ({ label, onClick, icon = 'plus' }: { label: string; onClick: () => void; icon?: string }) => <button className="mact" onClick={onClick}>{icon && <Icon name={icon} size={16} sw={2} />}{label}</button>;
export function MSec({ title, right, children }: { title: string; right?: ReactNode; children?: ReactNode }) {
  return <section><div className="msec-h"><span className="brand">{title}</span>{right}</div>{children}</section>;
}
export function Chips<K extends string | number>({ items, value, onChange }: { items: [K, string][]; value: K; onChange: (k: K) => void }) {
  return <div className="chips">{items.map(([k, l]) => <button key={String(k)} className={k === value ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>;
}
export function UTabs<K extends string | number>({ items, value, onChange }: { items: [K, string, (string | number)?][]; value: K; onChange: (k: K) => void }) {
  return <div className="tabs">{items.map(([k, l, n]) => <button key={String(k)} className={k === value ? 'on' : ''} onClick={() => onChange(k)}>{l}{n !== undefined && <span className="dim"> {n}</span>}</button>)}</div>;
}
const Empty = ({ children }: { children: ReactNode }) => <div className="dim" style={{ padding: '4px 0' }}>{children}</div>;
const Sub = ({ children, color }: { children: ReactNode; color?: string }) => <div className="small" style={{ color: color ?? 'var(--dim)' }}>{children}</div>;
const veg = (v: boolean) => <span style={{ width: 10, height: 10, border: `1.5px solid ${v ? 'var(--green)' : 'var(--red)'}`, borderRadius: 2, flex: 'none' }} />;
const MStep = ({ value, onMinus, onPlus, label }: { value: string; onMinus: () => void; onPlus: () => void; label: string }) => (
  <span className="stepper"><button type="button" aria-label={`Less ${label}`} onClick={onMinus}>−</button><span>{value}</span><button type="button" aria-label={`More ${label}`} onClick={onPlus}>+</button></span>
);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const mins = (d: string | null) => (d ? Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000)) : 0);

/** Table state colours as in the app: [label, text, dot] */
export const MTSTATE: Record<string, [string, string, string]> = {
  free: ['Free', '#a1a1a8', '#3a3a40'], seated: ['Ordering', '#f5c27a', '#f5b454'], eating: ['Dining', '#9cc3fa', '#7db0f9'], served: ['Dining', '#9cc3fa', '#7db0f9'],
  ready: ['Food ready', '#7fcfa3', '#5eb88a'], billing: ['Bill asked', '#d6c3ae', '#c9b29b'],
};
const MSTATUS: Record<string, string> = { waiting: 'var(--muted)', cooking: 'var(--amber)', ready: 'var(--green)', served: 'var(--blue)', cancelled: 'var(--red)' };

// ---------- Dashboard (MW-Dashboard, MW-Admin-Dashboard) ----------
const STAGES: [string, string, string][] = [['waiting', 'Placed', '#8b8b93'], ['cooking', 'Cooking', 'var(--amber)'], ['ready', 'Ready', 'var(--blue)'], ['served', 'Served', 'var(--green)'], ['billed', 'Billed', 'var(--blue2)']];
const KIND_COLOR: Record<string, string> = { Delay: 'var(--amber)', Stock: 'var(--red)', Load: 'var(--blue)', Alert: 'var(--red)' };
const up = (n: number) => (n > 0 ? '+' : '') + n;

export function DashboardM({ d, tasks, days, setDays }: { d: any; tasks: any[]; days: 1 | 7 | 28; setDays: (n: 1 | 7 | 28) => void }) {
  const me = useMe();
  const nav = useNavigate();
  const [section, setSection] = useState<'overview' | 'queues'>('overview');
  const [allChefs, setAllChefs] = useState(false);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const weekday = new Date().toLocaleDateString('en-IN', { weekday: 'short' });
  const head = <div className="muted" style={{ fontSize: 13 }}>{today}{me.role === 'admin' ? ' · Admin view' : ''}</div>;
  const tabs = <UTabs items={[['overview', 'Overview'], ['queues', 'Station queues']]} value={section} onChange={setSection} />;
  if (section === 'queues') return <>{head}{tabs}<StationQueuesM stations={d.stations ?? []} /></>;

  const k = d.kpis;
  const money = 'revenue' in k;
  const prepDelta = k.avgPrepMinutes - k.targetPrepMinutes;
  const kpis: { label: string; value: ReactNode; delta?: string; color?: string; note: string }[] = [
    money
      ? { label: 'Revenue', value: rupees(k.revenue), delta: k.revenueChangePct == null ? undefined : `${up(k.revenueChangePct)}%`, color: (k.revenueChangePct ?? 0) >= 0 ? 'var(--green)' : 'var(--amber)', note: days === 1 ? `vs last ${weekday}` : `vs prev ${days} days` }
      : { label: 'Guests now', value: k.guests, note: `of ${k.seats} seats` },
    { label: 'Orders', value: k.orders, delta: up(k.orders - k.prevOrders), color: k.orders - k.prevOrders >= 0 ? 'var(--green)' : 'var(--amber)', note: `${k.openOrders} open` },
    { label: 'Avg prep', value: k.avgPrepMinutes + ' min', delta: k.targetPrepMinutes ? up(prepDelta) + 'm' : undefined, color: prepDelta > 0 ? 'var(--amber)' : 'var(--green)', note: `Target ${k.targetPrepMinutes}m` },
    { label: 'Occupancy', value: (k.tables ? Math.round((k.occupied / k.tables) * 100) : 0) + '%', delta: `${k.occupied}/${k.tables}`, color: 'var(--blue)', note: 'tables' },
  ];
  const p = d.pipeline ?? {};
  const stages = STAGES.map(([key, label, color]) => ({ key, label, color, n: (p[key] ?? 0) as number }));
  const total = stages.reduce((a, x) => a + x.n, 0);
  const completed = p.billed ?? 0;
  const unanswered = tasks.filter((x: any) => x.status === 'open' && x.level >= 1).map((x: any) => ({ kind: 'Alert', text: `${x.table} · ${x.detail || 'nobody took this alert'}` }));
  const attention: { kind: string; text: string }[] = [...unanswered, ...(d.attention ?? [])];
  const chefs = allChefs ? d.chefs : d.chefs.slice(0, 5);
  const queue = (stationId: number) => d.queues?.find((q: any) => q.stationId === stationId)?.n ?? 0;
  return (
    <>
      <div>
        {head}
        <div style={{ marginTop: 12 }}>{tabs}</div>
        <div className="row-flex" style={{ gap: 16, marginTop: 12 }}>
          {([[1, 'Today'], [7, '7 days'], [28, '28 days']] as [1 | 7 | 28, string][]).map(([n, l]) => <button key={n} className="link" style={{ fontSize: 14.5, fontWeight: days === n ? 700 : 500, color: days === n ? 'var(--blue)' : 'var(--muted)' }} onClick={() => setDays(n)}>{l}</button>)}
        </div>
      </div>

      <div className="mkpis">
        {kpis.map((x) => (
          <div key={x.label}>
            <div className="muted small">{x.label}</div>
            <div className="mv">{x.value}</div>
            <div className="row-flex" style={{ gap: 6, marginTop: 4, fontSize: 11.5 }}>{x.delta && <b style={{ color: x.color }}>{x.delta}</b>}<span className="dim">{x.note}</span></div>
          </div>
        ))}
      </div>

      <MSec title="Order pipeline">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row-flex" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}><b>{completed} of {total} completed</b><b className="blue" style={{ fontSize: 20 }}>{total ? Math.round((completed / total) * 100) : 0}%</b></div>
          <div className="bar" style={{ height: 8, gap: 2 }}>{stages.map((x) => x.n > 0 && <div key={x.key} style={{ flex: x.n, background: x.color }} />)}</div>
          <div className="row-flex" style={{ gap: 4 }}>
            {stages.map((x) => <div key={x.key} style={{ flex: 1, textAlign: 'center' }}><div className="bb" style={{ fontSize: 16 }}>{x.n}</div><div className="dim row-flex" style={{ gap: 4, justifyContent: 'center', fontSize: 11 }}><span className="dot" style={{ width: 6, height: 6, background: x.color }} />{x.label}</div></div>)}
          </div>
        </div>
      </MSec>

      <MSec title="Kitchen" right={<button className="link" onClick={() => setSection('queues')}>Queue</button>}>
        <div>
          {chefs.map((c: any) => (
            <div key={c.id} className="row" style={{ gap: 12, padding: '11px 0' }}>
              <span className="avatar" style={{ width: 34, height: 34, fontSize: 13 }}>{c.name[0]}</span>
              <div className="grow">
                <div className="row-flex" style={{ gap: 6, alignItems: 'baseline' }}><b style={{ fontSize: 13.5 }}>{c.name}</b><span className="dim small">{c.onBreak ? 'On break' : c.station}</span></div>
                <div className="bar" style={{ height: 4, marginTop: 6 }}><div style={{ background: c.load >= 85 ? 'var(--amber)' : 'var(--blue2)', width: `${Math.min(100, c.load)}%` }} /></div>
              </div>
              <div style={{ width: 56, textAlign: 'right' }}><div className="bb">{c.done}</div><div className="dim" style={{ fontSize: 11 }}>{queue(c.stationId)} in queue</div></div>
            </div>
          ))}
          {d.chefs.length > 5 && <button className="link" style={{ marginTop: 8 }} onClick={() => setAllChefs(!allChefs)}>{allChefs ? 'Show less' : 'See all'}</button>}
        </div>
      </MSec>

      <MSec title="Dish Progress">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {d.dishes.length === 0 && <Empty>No dishes ordered yet</Empty>}
          {d.dishes.slice(0, 5).map((x: any) => (
            <div key={x.name}>
              <div className="row-flex" style={{ gap: 8 }}>{veg(!!x.veg)}<b style={{ fontSize: 13.5 }}>{x.name}</b><span className="grow" /><b style={{ fontSize: 13 }}>{x.done ?? 0}<span className="dim" style={{ fontWeight: 500 }}> / {x.total}</span></b></div>
              <div className="bar" style={{ height: 5, marginTop: 7 }}><div style={{ background: 'var(--blue2)', width: `${((x.done ?? 0) / x.total) * 100}%` }} /><div style={{ background: 'var(--amber)', width: `${(x.cooking / x.total) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </MSec>

      <MSec title="Needs attention">
        <div className="mcard" style={{ padding: '4px 16px' }}>
          {attention.length === 0 && <div className="dim small" style={{ minHeight: 48, display: 'flex', alignItems: 'center' }}>All clear</div>}
          {attention.map((a, i) => (
            <button key={i} className="mline" onClick={() => nav({ to: '/notifications' })}>
              <b className="small" style={{ color: KIND_COLOR[a.kind] ?? 'var(--muted)' }}>{a.kind}</b>
              <span className="grow ellipsis" style={{ fontSize: 13, textAlign: 'left' }}>{a.text}</span>
              <Icon name="chev" size={16} />
            </button>
          ))}
        </div>
      </MSec>
    </>
  );
}

/** Station queues tab on the dashboard: waiting / cooking / at the pass per station */
export function StationQueuesM({ stations }: { stations: any[] }) {
  return (
    <div>
      {stations.map((st, idx) => (
        <div key={st.id} style={{ padding: '12px 0', borderTop: idx ? '1px solid var(--line2)' : 0 }}>
          <b>{st.name}</b>
          <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>Waiting {st.waiting} · Cooking {st.cooking} · Pass {st.ready}</div>
          <Sub color={st.late > 0 ? 'var(--amber)' : undefined}>Oldest {st.oldestWaitMin} min · {st.late} late</Sub>
          <Sub color={st.chefsOnDuty === 0 && st.waiting > 0 ? 'var(--amber)' : undefined}>{st.chefsOnDuty} of {st.chefsTotal} chefs on duty</Sub>
          {st.next.slice(0, 2).map((i: any, k: number) => (
            <div key={k} className="row-flex" style={{ gap: 8, marginTop: 4, fontSize: 13 }}><b>{i.table}</b><span className="grow ellipsis">{i.qty} × {i.name}</span>{i.remake && <b className="red small">Remake</b>}<span className="dim small">{i.minutes} min</span></div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- Orders (MW-Orders) ----------
export function OrdersM({ data, tab, setTab, q, setQ, cancel, tabs }: { data: any[]; tab: string; setTab: (k: any) => void; q: string; setQ: (v: string) => void; cancel: (id: number) => void; tabs: [string, string][] }) {
  const nav = useNavigate();
  const list = data.filter((x) => (tab === 'all' || x.status === tab) && (!q || `${x.table} ${x.name} ${x.station}`.toLowerCase().includes(q.toLowerCase())));
  const count = (k: string) => (k === 'all' ? data.length : data.filter((x) => x.status === k).length);
  return (
    <>
      <MHead title="Orders" sub={`${data.filter((x) => x.status === 'waiting' || x.status === 'cooking').length} dishes in progress`} />
      <input className="input" placeholder="Search table or dish" value={q} onChange={(e) => setQ(e.target.value)} />
      <Chips items={tabs.map(([k, l]) => [k, `${l} ${count(k)}`] as [string, string])} value={tab} onChange={setTab} />
      <div>
        {list.length === 0 && <Empty>Nothing here</Empty>}
        {list.map((x) => (
          <div key={x.id} className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <button className="mbtn bb" style={{ width: 44, fontSize: 16 }} onClick={() => nav({ to: '/tables/$id', params: { id: String(x.tableId) } })}>{x.table}</button>
            <div className="grow">
              <b>{x.qty} × {x.name}</b>
              <div className="row-flex small" style={{ gap: 6, flexWrap: 'wrap' }}><StatusDot color={MSTATUS[x.status]} ready={x.status === 'ready'} /><span style={{ color: MSTATUS[x.status] }}>{ITEM_LABEL[x.status as ItemStatus]}</span><span className="dim">· {x.station}{x.chef ? ' · ' + x.chef.split(' ')[0] : ''} · {since(new Date(x.createdAt).getTime())}</span></div>
              {(x.note || x.spice) && <div className="taupe small">{[x.spice, x.note].filter(Boolean).join(' · ')}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              {'unitPrice' in x && <div className="b" style={{ fontSize: 13 }}>{rupees(x.unitPrice * x.qty)}</div>}
              {(x.status === 'waiting' || x.status === 'cooking') && <button className="link red" style={{ fontSize: 12.5 }} onClick={() => confirm(`Cancel ${x.qty} × ${x.name} for ${x.table}?`) && cancel(x.id)}>Cancel</button>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- Kitchen Display (MW-Kitchen) ----------
export function KitchenM({ stations, current, setSid, q, release }: { stations: any[]; current: number | undefined; setSid: (id: number) => void; q: any; release: (id: number) => void }) {
  const list = (items: any[], right?: (i: any) => ReactNode) => items.map((i) => {
    const late = i.status !== 'ready' && mins(i.createdAt) > i.prepMinutes;
    const note = [i.spice, ...(i.options ?? []), i.note].filter(Boolean).join(' · ');
    return (
      <div key={i.id} className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 52, flex: 'none' }}><div className="bb" style={{ fontSize: 16 }}>{i.table}</div><div className="small" style={{ color: late ? 'var(--amber)' : 'var(--dim)' }}>{mins(i.status === 'cooking' ? i.claimedAt : i.status === 'ready' ? i.readyAt : i.createdAt)} min</div></div>
        <div className="grow">
          <b>{i.qty} × {i.name}</b>
          <Sub>{i.guestNo ? 'G' + i.guestNo : 'Shared'}{i.chef && i.status !== 'waiting' ? ' · ' + i.chef.split(' ')[0] : ''}{i.waiter && i.status === 'ready' ? ' · ' + i.waiter.split(' ')[0] + ' alerted' : ''}</Sub>
          {note && <div className="taupe small">{note}</div>}
          {i.remake && <b className="red small">Remake</b>}
        </div>
        {right?.(i)}
      </div>
    );
  });
  return (
    <>
      <MHead title="Kitchen Display" sub="Shared station queues · urgent and oldest first" />
      {stations.length > 0 && <UTabs items={stations.map((x) => [x.id, x.name] as [number, string])} value={current as number} onChange={setSid} />}
      {!q.data ? <Loading /> : <>
        <div className="dim small">{q.data.chefs.map((x: any) => `${x.name.split(' ')[0]} ${x.onBreak ? 'on break' : `${x.cooking}/${x.maxParallel} cooking`}`).join(' · ')}</div>
        <MSec title="Waiting" right={<b className="muted">{q.data.waiting.length}</b>}>{list(q.data.waiting)}{q.data.waiting.length === 0 && <Empty>Queue is clear</Empty>}</MSec>
        <MSec title="Cooking" right={<b className="muted">{q.data.cooking.length}</b>}>{list(q.data.cooking, (i) => <button className="link" onClick={() => release(i.id)}>Release</button>)}</MSec>
        <MSec title="At the pass" right={<b className="muted">{q.data.ready.length}</b>}>{list(q.data.ready)}</MSec>
      </>}
    </>
  );
}

// ---------- Tables (MW-Tables) ----------
const LEGEND: [string, string][] = [['Order', '#f5b454'], ['Dining', '#7db0f9'], ['Ready', '#5eb88a'], ['Bill', '#c9b29b']];
export function TablesM({ data, areas, area, setArea }: { data: any; areas: any[]; area: number | 'all'; setArea: (a: number) => void }) {
  const nav = useNavigate();
  const sum = data.summary;
  const current = area === 'all' ? areas[0]?.id : area;
  const list: any[] = data.tables.filter((x: any) => x.areaId === current);
  const busy = list.filter((x) => x.state !== 'free').length;
  const guests = list.reduce((a, x) => a + x.guests, 0);
  const seats = list.reduce((a, x) => a + x.seats, 0);
  const bar = (pct: number) => <div className="bar" style={{ height: 3, marginTop: 6 }}><div style={{ background: 'var(--blue2)', width: `${Math.min(100, pct)}%` }} /></div>;
  return (
    <>
      <MHead title="Tables" sub={`${sum.tables} tables · ${sum.seats} seats`} right={<MAction label="Add table" onClick={() => nav({ to: '/tables/new' })} />} />
      <div className="row-flex" style={{ gap: 16, alignItems: 'stretch' }}>
        <div className="grow"><div className="muted small">Tables in use</div><div style={{ marginTop: 2 }}><span className="bb" style={{ fontSize: 20 }}>{sum.occupied}</span><span className="dim" style={{ fontSize: 13 }}> / {sum.tables}</span></div>{bar(sum.tables ? (sum.occupied / sum.tables) * 100 : 0)}</div>
        <div className="grow"><div className="muted small">Seats occupied</div><div style={{ marginTop: 2 }}><span className="bb" style={{ fontSize: 20 }}>{sum.guests}</span><span className="dim" style={{ fontSize: 13 }}> / {sum.seats}</span></div>{bar(sum.seats ? (sum.guests / sum.seats) * 100 : 0)}</div>
      </div>
      <div>
        <UTabs items={areas.map((z) => [z.id, z.name] as [number, string])} value={current} onChange={setArea} />
        <div className="row-flex" style={{ justifyContent: 'space-between', marginTop: 10 }}>
          <span className="dim" style={{ fontSize: 12 }}>{busy} of {list.length} busy · {guests}/{seats} seats</span>
          <span className="row-flex" style={{ gap: 10 }}>{LEGEND.map(([l, c]) => <span key={l} className="row-flex dim" style={{ gap: 4, fontSize: 12 }}><span className="dot" style={{ width: 6, height: 6, background: c }} />{l}</span>)}</span>
        </div>
      </div>
      {list.length === 0 && <Empty>No tables in this area yet</Empty>}
      <div className="mtiles">
        {list.map((x) => {
          const [label, , dot] = MTSTATE[x.state] ?? MTSTATE.free; const free = x.state === 'free';
          return (
            <button key={x.id} className={'mtile' + (x.state === 'ready' ? ' ring' : '')} aria-label={`Table ${x.code}, ${label}, ${x.guests} of ${x.seats} seats`} onClick={() => nav({ to: '/tables/$id', params: { id: String(x.id) } })}>
              <span className="row-flex" style={{ justifyContent: 'space-between' }}><b style={{ fontSize: 15, color: free ? 'var(--dim)' : 'var(--text)' }}>{x.code}</b><span className="dot" style={{ width: 7, height: 7, background: free ? 'transparent' : dot }} /></span>
              <span style={{ fontSize: 11.5, color: free ? '#6f6f78' : 'var(--muted)' }}>{free ? `${x.seats} seats` : `${x.guests}/${x.seats} seats`}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ---------- Table detail (MW-TableDetail) ----------
function useShare() {
  const toast = useToast();
  return (t: { code: string; qrUrl: string }) => {
    if (navigator.share) navigator.share({ title: `Table ${t.code}`, url: t.qrUrl }).catch(() => {});
    else navigator.clipboard?.writeText(t.qrUrl).then(() => toast('Link copied')).catch(() => {});
  };
}
export function TableDetailM({ data, onBill, onNewQr }: { data: any; onBill: () => void; onNewQr: () => void }) {
  const me = useMe();
  const share = useShare();
  const { table, session: sess, items, totals } = data;
  const live = items.filter((i: any) => i.status !== 'cancelled');
  const served = live.filter((i: any) => i.status === 'served').length;
  const state = !sess ? 'free' : sess.status === 'billing' ? 'billing' : !live.length ? 'seated' : live.some((i: any) => i.status === 'ready') ? 'ready' : live.some((i: any) => i.status === 'waiting' || i.status === 'cooking') ? 'eating' : 'served';
  const [label, textColor] = MTSTATE[state];
  const seated = sess ? mins(sess.openedAt) : 0;
  const canOrder = me.role !== 'admin';
  const money = totals && 'total' in totals;
  const turns = data.today;
  const kpis: [string, string, string][] = [
    ['Guests', String(sess?.guestCount ?? 0), `/ ${table.seats} seats`], ['Seated for', String(seated), 'min'],
    ['Items served', String(served), `/ ${live.length}`], ['Turns today', String(turns?.turns ?? 0), turns && 'amount' in turns ? `· ${rupees(turns.amount)}` : ''],
  ];
  return (
    <>
      <MHead title={`Table ${table.code}`} sub={`${table.area} · ${table.seats} seats${table.waiter ? ' · ' + table.waiter.split(' ')[0] : ''}`} right={<b className="small" style={{ color: textColor, paddingTop: 10 }}>{label}</b>} />
      <div className="mcard row-flex" style={{ padding: 14, gap: 14 }}>
        <div style={{ padding: 6, background: '#fff', borderRadius: 12, lineHeight: 0 }}><QRCodeSVG value={table.qrUrl} size={112} bgColor="#ffffff" fgColor="#0b0b0c" /></div>
        <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b>Table QR code</b><Sub>Guests scan to order.</Sub>
          <div className="row-flex" style={{ gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
            <button className="mchip" onClick={() => share(table)}>Share</button>
            <button className="mchip" onClick={() => window.print()}>Print</button>
            {me.role !== 'waiter' && <button className="mchip" style={{ color: 'var(--amber)' }} onClick={onNewQr}>New QR</button>}
          </div>
        </div>
      </div>
      <div className="mkpis" style={{ gap: 10 }}>
        {kpis.map(([l, v, of]) => <div key={l} className="mcard" style={{ padding: '12px 14px' }}><div className="muted small">{l}</div><div><b style={{ fontSize: 19 }}>{v}</b>{of && <span className="dim" style={{ fontSize: 12 }}> {of}</span>}</div></div>)}
      </div>
      <MSec title="Current order">
        {items.length === 0 && <Empty>Nothing ordered yet</Empty>}
        {items.map((it: any) => {
          const note = [it.spice, ...(it.options ?? []), it.note].filter(Boolean).join(' · ');
          return (
            <div key={it.id} className="row" style={{ gap: 12, minHeight: 50, padding: '9px 0', opacity: it.status === 'cancelled' ? 0.45 : 1 }}>
              <span className="b muted" style={{ minWidth: 44, textAlign: 'center', fontSize: 11 }}>{it.guestNo ? 'G' + it.guestNo : 'Shared'}</span>
              <div className="grow"><b style={{ fontSize: 13.5 }}>{it.qty} × {it.name}</b>{note && <div style={{ fontSize: 11.5, color: '#f5c27a' }}>{note}</div>}</div>
              <b className="small" style={{ color: MSTATUS[it.status] }}>{ITEM_LABEL[it.status as ItemStatus]}</b>
            </div>
          );
        })}
      </MSec>
      {canOrder && (
        <div className="mfoot">
          <Link to="/w/take-order" search={{ table: table.id } as any} className="mpill ghost">{sess ? 'Add items' : 'Take order'}</Link>
          {sess && money && <button className="mpill blue" onClick={onBill}>Bill · {rupees(totals.total)}</button>}
        </div>
      )}
    </>
  );
}

// ---------- Add table (MW-AddTable) and Table added (MW-TableAdded) ----------
export function AddTableM() {
  const qc = useQueryClient(); const nav = useNavigate(); const toast = useToast();
  const areas = useQuery({ queryKey: ['areas'], queryFn: () => api('/floor/areas') });
  const tables = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables') });
  const [areaId, setAreaId] = useState<number | null>(null);
  const [code, setCode] = useState(''); const [touched, setTouched] = useState(false);
  const [seats, setSeats] = useState(4);
  const [shape, setShape] = useState<'square' | 'round' | 'long'>('square');
  const [newArea, setNewArea] = useState<string | null>(null);
  const list: { id: number; name: string }[] = areas.data ?? [];
  const area = areaId ?? list[0]?.id ?? null;
  // suggested number: same letters as the last table in the area, next number after the highest
  useEffect(() => {
    if (touched || !tables.data || area == null) return;
    const here: string[] = tables.data.tables.filter((x: any) => x.areaId === area).map((x: any) => x.code);
    const last = here[here.length - 1] ?? 'T';
    const prefix = (last.match(/^[A-Za-z]+/) ?? ['T'])[0];
    const max = Math.max(0, ...here.filter((c) => c.startsWith(prefix)).map((c) => parseInt(c.slice(prefix.length), 10) || 0));
    setCode(`${prefix}${max + 1}`);
  }, [area, tables.data, touched]);
  const save = useMutation({
    mutationFn: () => api('/floor/tables', { body: { areaId: area, code: code.trim().toUpperCase(), seats, shape } }),
    onSuccess: (t: any) => { qc.invalidateQueries(); nav({ to: '/tables/added/$id', params: { id: String(t.id) }, replace: true }); },
    onError: (e) => toast((e as Error).message),
  });
  const addArea = useMutation({
    mutationFn: () => api('/floor/areas', { body: { name: (newArea ?? '').trim() } }),
    onSuccess: (a: any) => { qc.invalidateQueries({ queryKey: ['areas'] }); setAreaId(a.id); setNewArea(null); setTouched(false); },
    onError: (e) => toast((e as Error).message),
  });
  // preview geometry: offsets from the centre of a 176px high box
  const [tw, th, tr] = shape === 'round' ? [96, 96, 48] : shape === 'long' ? [Math.max(120, Math.ceil(seats / 2) * 34), 64, 14] : [seats > 4 ? 110 : 84, 84, 14];
  const chairs: { x: number; y: number }[] = [];
  if (shape === 'round') {
    for (let i = 0; i < seats; i++) { const a = (i / seats) * Math.PI * 2 - Math.PI / 2; chairs.push({ x: Math.cos(a) * 64 - 11, y: Math.sin(a) * 64 - 11 }); }
  } else {
    const top = Math.ceil(seats / 2), bottom = seats - top;
    const row = (n: number, y: number) => { for (let i = 0; i < n; i++) chairs.push({ x: -tw / 2 + ((i + 0.5) * tw) / n - 11, y }); };
    row(top, -th / 2 - 28); row(bottom, th / 2 + 6);
  }
  return (
    <>
      <MHead title="Add table" sub="Spice Garden" />
      <div style={{ position: 'relative', height: 176, borderRadius: 20, background: 'var(--card)', overflow: 'hidden', flex: 'none' }} aria-label="Preview">
        <div style={{ position: 'absolute', left: `calc(50% - ${tw / 2}px)`, top: 88 - th / 2, width: tw, height: th, borderRadius: tr, background: 'var(--chip2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, transition: 'all 200ms var(--ease)' }}>{code || '—'}</div>
        {chairs.map((c, i) => <div key={i} style={{ position: 'absolute', left: `calc(50% + ${c.x}px)`, top: 88 + c.y, width: 22, height: 22, borderRadius: 7, background: 'var(--blue2)', opacity: 0.85, transition: 'all 200ms var(--ease)' }} />)}
        <span className="dim small" style={{ position: 'absolute', right: 14, bottom: 12 }}>Preview</span>
      </div>
      <label className="ma-field" style={{ margin: 0, gap: 12, paddingTop: 4 }}><span className="b" style={{ width: 110 }}>Table number</span><input aria-label="Table number" autoCapitalize="characters" maxLength={10} value={code} style={{ fontWeight: 600 }} onChange={(e) => { setCode(e.target.value); setTouched(true); }} /></label>
      <div>
        <div className="b" style={{ color: '#b3b3b3', marginBottom: 10 }}>Area</div>
        <div className="row-flex wrap" style={{ gap: 8 }}>
          {list.map((a) => <button key={a.id} className={'mchip lg' + (a.id === area ? ' on' : '')} onClick={() => { setAreaId(a.id); setTouched(false); }}>{a.name}</button>)}
          <button className="mchip lg outline" onClick={() => setNewArea(newArea === null ? '' : null)}>+ New area</button>
        </div>
        {newArea !== null && (
          <div className="row-flex" style={{ marginTop: 10 }}>
            <input className="input grow" placeholder="Area name" maxLength={40} value={newArea} onChange={(e) => setNewArea(e.target.value)} />
            <button className="btn" disabled={!newArea.trim() || addArea.isPending} onClick={() => addArea.mutate()}>Add</button>
          </div>
        )}
      </div>
      <div className="row-flex" style={{ justifyContent: 'space-between' }}>
        <div><b style={{ fontSize: 16 }}>Seats</b><Sub>Guests that fit at this table</Sub></div>
        <span className="mstep"><button aria-label="Fewer seats" onClick={() => setSeats(Math.max(1, seats - 1))}>−</button><b style={{ minWidth: 28, textAlign: 'center', fontSize: 18 }}>{seats}</b><button aria-label="More seats" onClick={() => setSeats(Math.min(30, seats + 1))}>+</button></span>
      </div>
      <div>
        <div className="b" style={{ color: '#b3b3b3', marginBottom: 10 }}>Shape</div>
        <div className="row-flex" style={{ gap: 8 }}>{(['square', 'round', 'long'] as const).map((s) => <button key={s} className={'mseg' + (shape === s ? ' on' : '')} onClick={() => setShape(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
      </div>
      <div className="mfoot"><button className="ma-pill" style={{ flex: 1 }} disabled={!code.trim() || area == null || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save and create QR code'}</button></div>
    </>
  );
}

export function TableAddedM({ id }: { id: string }) {
  const nav = useNavigate();
  const share = useShare();
  const q = useQuery({ queryKey: ['table', id], queryFn: () => api(`/floor/tables/${id}`) });
  if (!q.data) return <Loading />;
  const t = q.data.table;
  const shape = t.shape[0].toUpperCase() + t.shape.slice(1);
  return (
    <>
      <button className="ma-back" aria-label="Close" style={{ color: 'var(--text)' }} onClick={() => nav({ to: '/tables' })}><Icon name="x" size={22} sw={1.9} /></button>
      <div>
        <div className="row-flex" style={{ gap: 8 }}><span className="dot" style={{ background: 'var(--green)' }} /><b style={{ color: '#7fcfa3' }}>QR code created</b></div>
        <h1 style={{ margin: '10px 0 6px', fontSize: 34, lineHeight: '40px', letterSpacing: -0.5 }}>Table {t.code} is ready</h1>
        <div style={{ fontSize: 15, color: '#b3b3b3', lineHeight: '21px' }}>{t.area} · {t.seats} seats · {shape}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ padding: 12, background: '#fff', borderRadius: 18, lineHeight: 0 }}><QRCodeSVG value={t.qrUrl} size={216} bgColor="#ffffff" fgColor="#0b0b0c" /></div>
        <div className="dim ellipsis" style={{ fontSize: 13, maxWidth: '100%' }}>{t.qrUrl.replace(/^https?:\/\//, '')}</div>
        <div className="row-flex" style={{ gap: 8 }}>{[['Download', () => share(t)], ['Print', () => window.print()], ['Share', () => share(t)]].map(([l, f]) => <button key={l as string} className="mchip lg" onClick={f as () => void}>{l as string}</button>)}</div>
      </div>
      <div className="mfoot" style={{ flexDirection: 'column', gap: 0 }}>
        <button className="ma-pill" onClick={() => nav({ to: '/tables/$id', params: { id: String(t.id) }, replace: true })}>Open table</button>
        <button className="mbtn b" style={{ marginTop: 12, minHeight: 44, width: '100%', fontWeight: 700 }} onClick={() => nav({ to: '/tables/new', replace: true })}>Add another table</button>
      </div>
    </>
  );
}

// ---------- Billing (MW-Billing) ----------
export function BillingM({ tables, bills }: { tables: any[]; bills: any[] }) {
  const nav = useNavigate();
  const open = tables.filter((t) => t.state !== 'free');
  const today = bills.filter((b) => new Date(b.paidAt).toDateString() === new Date().toDateString());
  const sum = (m?: string) => today.filter((b) => !m || b.method === m).reduce((a, b) => a + b.total, 0);
  const kpis: [string, number][] = [['Collected today', sum()], ['UPI', sum('upi')], ['Card', sum('card')], ['Cash', sum('cash')]];
  return (
    <>
      <MHead title="Billing" sub={`${today.length} bills today`} />
      <div className="mkpis" style={{ rowGap: 18 }}>{kpis.map(([l, v]) => <div key={l}><div className="muted small">{l}</div><div className="mv">{rupees(v)}</div></div>)}</div>
      <MSec title="Open tables" right={<b className="muted">{open.length}</b>}>
        {open.length === 0 && <Empty>No open tables</Empty>}
        {open.map((t) => (
          <button key={t.id} className="row mline" style={{ width: '100%', padding: '14px 0' }} onClick={() => nav({ to: '/tables/$id', params: { id: String(t.id) } })}>
            <b style={{ width: 44, fontSize: 16, textAlign: 'left' }}>{t.code}</b>
            <span className="grow muted" style={{ fontSize: 13, textAlign: 'left' }}>{t.guests} guests · {t.items} dishes · {since(new Date(t.openedAt).getTime())}</span>
            {t.state === 'billing' && <b className="red small">Bill asked</b>}<b>{rupees(t.amount)}</b>
          </button>
        ))}
      </MSec>
      <MSec title="Paid">
        {bills.length === 0 && <Empty>No bills yet</Empty>}
        {bills.slice(0, 20).map((b) => (
          <div key={b.id} className="row" style={{ gap: 12 }}>
            <b style={{ width: 44, fontSize: 16 }}>{b.table}</b>
            <span className="grow muted" style={{ fontSize: 13 }}>{b.method.toUpperCase()} · {since(new Date(b.paidAt).getTime())} ago</span>
            {b.discount > 0 && <span className="amber small">−{rupees(b.discount)}</span>}<b>{rupees(b.total)}</b>
          </div>
        ))}
      </MSec>
    </>
  );
}

// ---------- Menu & Dishes (MW-Dishes) ----------
export function MenuM({ cats, dishes, cat, setCat, stationName, canAdd, onAdd, onEdit, toggleStock }: { cats: any[]; dishes: any[]; cat: number | 'all'; setCat: (c: any) => void; stationName: (id: number) => string; canAdd: boolean; onAdd: () => void; onEdit: (d: any) => void; toggleStock: (d: any) => void }) {
  const list = dishes.filter((d) => cat === 'all' || d.categoryId === cat);
  return (
    <>
      <MHead title="Menu & Dishes" sub={`${dishes.length} dishes · ${dishes.filter((d) => !d.available).length} out of stock`} right={canAdd ? <MAction label="Add dish" onClick={onAdd} /> : undefined} />
      <Chips items={[['all', 'All'] as [any, string], ...cats.map((c) => [c.id, c.name] as [any, string])]} value={cat} onChange={setCat} />
      <div>
        {list.map((d) => (
          <div key={d.id} className="row" style={{ gap: 12, opacity: d.available ? 1 : 0.7 }}>
            {veg(!!d.veg)}
            <div className="grow">
              <b>{d.name}</b>
              <Sub>{d.category} · {stationName(d.stationId)} · {d.prepMinutes} min{'price' in d ? ' · ' + rupees(d.price) : ''}</Sub>
              {d.options?.length > 0 && <div className="taupe small">{d.options.join(' · ')}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <button className={'link ' + (d.available ? 'green' : 'red')} style={{ fontSize: 12.5 }} onClick={() => toggleStock(d)}>{d.available ? 'In stock' : 'Out of stock'}</button>
              <button className="link" style={{ fontSize: 12.5 }} onClick={() => onEdit(d)}>Edit</button>
            </div>
          </div>
        ))}
        {list.length === 0 && <Empty>No dishes here</Empty>}
      </div>
    </>
  );
}

// ---------- Team (MW-Mgr-Staff) ----------
const ROLE_LABEL: Record<string, string> = { owner: 'Owner', manager: 'Manager', admin: 'Admin', waiter: 'Waiter', chef: 'Chef' };
const MGR = ['owner', 'manager', 'admin'];
export function StaffM({ data, onAdd }: { data: any; onAdd: () => void }) {
  const [role, setRole] = useState<'all' | 'waiter' | 'chef' | 'mgr'>('all');
  const all: any[] = data.staff;
  const onDuty = all.filter((p) => p.onDuty && !p.onBreak).length;
  const hour = new Date().getHours();
  const shift = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const list = all.filter((p) => role === 'all' || (role === 'mgr' ? MGR.includes(p.role) : p.role === role));
  const where = (p: any) => p.role === 'chef' ? data.stations.find((x: any) => x.id === p.stationId)?.name ?? 'No station' : p.role === 'waiter' ? data.areas.find((x: any) => x.id === p.areaId)?.name ?? 'No area' : 'Management';
  const status = (p: any): [string, string] => p.onBreak ? ['On break', 'var(--amber)'] : p.onDuty ? ['On duty', 'var(--green)'] : ['Off', '#6f6f78'];
  const today = (p: any) => p.role === 'waiter' ? `${p.ordersToday} orders` : p.role === 'chef' ? `${p.doneToday} items` : '—';
  return (
    <>
      <MHead title="Team" sub={`${onDuty} of ${all.length} on duty · ${shift} shift`} right={<MAction label="Add staff" onClick={onAdd} />} />
      <UTabs items={[['all', 'All'], ['waiter', 'Waiters'], ['chef', 'Chefs'], ['mgr', 'Managers']]} value={role} onChange={setRole} />
      <div>
        {list.map((p) => { const [st, sc] = status(p); return (
          <div key={p.id} className="row" style={{ gap: 12, minHeight: 60, padding: 0 }}>
            <span className="avatar" style={{ width: 40, height: 40, fontSize: 15, position: 'relative', overflow: 'visible' }}>{p.name[0]}<span style={{ position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: 6, background: sc, border: '2px solid var(--bg)' }} /></span>
            <div className="grow"><b className="ellipsis" style={{ display: 'block' }}>{p.name}</b><Sub>{ROLE_LABEL[p.role]} · {where(p)}</Sub></div>
            <div style={{ textAlign: 'right' }}><div className="b" style={{ fontSize: 13.5 }}>{today(p)}</div><div className="small" style={{ color: sc }}>{st}</div></div>
          </div>
        ); })}
        {list.length === 0 && <Empty>Nobody here yet</Empty>}
      </div>
    </>
  );
}

// ---------- Shifts & Sections (MW-Shifts) ----------
function range(codes: string[]) {
  if (!codes.length) return 'No tables';
  const m = codes.map((c) => c.match(/^([A-Za-z]*)(\d+)$/));
  if (codes.length > 1 && m.every(Boolean) && m.every((x) => x![1] === m[0]![1])) {
    const n = m.map((x) => Number(x![2])).sort((a, b) => a - b);
    if (n.every((v, i) => i === 0 || v === n[i - 1] + 1)) return `${m[0]![1]}${n[0]} to ${m[0]![1]}${n[n.length - 1]}`;
  }
  return codes.join(', ');
}
export function ShiftsM({ data, waiting, patch, rules, saveRules, onSections }: { data: any; waiting: (stationId: number) => number; patch: (id: number, body: object) => void; rules: { areaSecs: number; managerSecs: number }; saveRules: (r: { areaSecs: number; managerSecs: number }) => void; onSections: (w: any) => void }) {
  const [tab, setTab] = useState<'kitchen' | 'floor'>('kitchen');
  const chefs = data.staff.filter((p: any) => p.role === 'chef');
  const waiters = data.staff.filter((p: any) => p.role === 'waiter');
  const setRule = (key: 'areaSecs' | 'managerSecs', v: number) => saveRules({ areaSecs: key === 'areaSecs' ? clamp(v, 30, 300) : rules.areaSecs, managerSecs: key === 'managerSecs' ? clamp(v, 30, 300) : rules.managerSecs });
  return (
    <>
      <MHead title="Shifts & Sections" sub="Tonight · 6:00 PM to 11:30 PM" />
      <UTabs items={[['kitchen', 'Kitchen', `${chefs.length} chefs`], ['floor', 'Floor', `${waiters.length} waiters`]]} value={tab} onChange={setTab} />
      {tab === 'kitchen' && data.stations.map((st: any) => {
        const here = chefs.filter((c: any) => c.stationId === st.id);
        return (
          <div key={st.id}>
            <div className="row-flex" style={{ gap: 10, alignItems: 'baseline', paddingBottom: 2 }}><b>{st.name}</b><span className="dim small">{waiting(st.id)} waiting</span></div>
            {here.length === 0 && <div className="dim small" style={{ padding: '10px 0' }}>No chefs on this station</div>}
            {here.map((c: any) => (
              <div key={c.id} className="row" style={{ padding: '10px 0' }}>
                <div className="grow">
                  <b>{c.name}</b>
                  <div className="row-flex small" style={{ gap: 10 }}><span style={{ color: c.onBreak || c.cooking >= c.maxParallel ? 'var(--amber)' : 'var(--muted)' }}>{c.onBreak ? 'On break' : `${c.cooking} of ${c.maxParallel} cooking`}</span><button className="link" style={{ fontSize: 12 }} onClick={() => patch(c.id, { onBreak: !c.onBreak })}>{c.onBreak ? 'Back on duty' : 'Send on break'}</button></div>
                </div>
                <MStep label="limit" value={String(c.maxParallel)} onMinus={() => patch(c.id, { maxParallel: clamp(c.maxParallel - 1, 1, 8) })} onPlus={() => patch(c.id, { maxParallel: clamp(c.maxParallel + 1, 1, 8) })} />
              </div>
            ))}
          </div>
        );
      })}
      {tab === 'floor' && <>
        <div>
          {waiters.map((w: any) => (
            <div key={w.id} className="row" style={{ padding: '10px 0' }}>
              <div className="grow"><b>{w.name} <span className="dim" style={{ fontWeight: 500 }}>· {data.areas.find((a: any) => a.id === w.areaId)?.name ?? 'No area'}</span></b><div className="small" style={{ color: w.onBreak ? 'var(--amber)' : 'var(--green)' }}>{w.onBreak ? 'On break' : w.onDuty ? 'On duty' : 'Off'}</div></div>
              <div style={{ textAlign: 'right' }}>
                <div className="b">{range(w.tables.map((x: any) => x.code))}</div>
                <div className="row-flex" style={{ gap: 10, justifyContent: 'flex-end' }}><button className="link" style={{ fontSize: 12 }} onClick={() => onSections(w)}>Tables</button><button className="link" style={{ fontSize: 12 }} onClick={() => patch(w.id, { onBreak: !w.onBreak })}>{w.onBreak ? 'Back on duty' : 'Send on break'}</button></div>
              </div>
            </div>
          ))}
        </div>
        <MSec title="Alert rules">
          {([['Pass to free waiters in the area after', 'areaSecs', rules.areaSecs], ['Pass to the manager after', 'managerSecs', rules.managerSecs]] as const).map(([label, key, val]) => (
            <div key={key} className="row" style={{ minHeight: 52, padding: 0 }}>
              <span className="grow muted" style={{ fontSize: 13 }}>{label}</span>
              <MStep label={label} value={`${val} s`} onMinus={() => setRule(key, val - 15)} onPlus={() => setRule(key, val + 15)} />
            </div>
          ))}
        </MSec>
      </>}
    </>
  );
}

// ---------- Analytics (MW-Analytics) ----------
export function AnalyticsM({ data }: { data: any }) {
  const max = Math.max(1, ...data.days.map((d: any) => d.revenue));
  return (
    <>
      <MHead title="Analytics" sub="Last 7 days" />
      <MSec title="Revenue by day">
        {data.days.length === 0 ? <Empty>No bills yet</Empty> : (
          <div className="row-flex" style={{ alignItems: 'flex-end', gap: 8, height: 190 }}>
            {data.days.map((d: any) => (
              <div key={d.d} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                <b className="ellipsis" style={{ fontSize: 10.5, maxWidth: '100%' }}>{rupees(d.revenue).replace('.00', '')}</b>
                <div style={{ width: '100%', maxWidth: 34, height: Math.max(4, (d.revenue / max) * 130), background: 'var(--blue2)', borderRadius: 6 }} />
                <span className="dim" style={{ fontSize: 10.5 }}>{d.day}</span>
              </div>
            ))}
          </div>
        )}
      </MSec>
      <MSec title="Top dishes">
        {data.top.map((t: any, i: number) => <div key={t.name} className="row" style={{ gap: 12 }}><span className="dim" style={{ width: 20 }}>{i + 1}</span><b className="grow">{t.name}</b><span className="muted small">{t.qty} sold</span><span style={{ width: 80, textAlign: 'right' }}>{rupees(t.revenue)}</span></div>)}
        {data.top.length === 0 && <Empty>Nothing sold yet</Empty>}
      </MSec>
      <MSec title="Payment methods">
        {data.methods.map((m: any) => <div key={m.method} className="row" style={{ gap: 12 }}><b className="grow">{m.method.toUpperCase()}</b><span className="muted small">{m.n} bills</span><span style={{ width: 80, textAlign: 'right' }}>{rupees(m.revenue)}</span></div>)}
        {data.methods.length === 0 && <Empty>No payments yet</Empty>}
      </MSec>
    </>
  );
}

// ---------- Settings (MW-Settings) ----------
export function SettingsM({ f, setF, can, save, saving }: { f: any; setF: (f: any) => void; can: boolean; save: () => void; saving: boolean }) {
  const field = (label: string, key: string, numeric?: boolean) => (
    <label className="field" style={{ fontSize: 13 }}>{label}<input className="input" style={{ opacity: can ? 1 : 0.6 }} disabled={!can} inputMode={numeric ? 'decimal' : undefined} value={f[key]} onChange={(e) => setF({ ...f, [key]: numeric ? Number(e.target.value.replace(/[^0-9.]/g, '')) : e.target.value })} /></label>
  );
  return (
    <>
      <MHead title="Settings" sub="Restaurant details" />
      {field('Restaurant name', 'name')}{field('Address', 'address')}{field('City', 'city')}{field('Tax (GST %)', 'taxPercent', true)}
      {can ? <button className="btn block" disabled={!f.name.trim() || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button> : <div className="dim small">Only the owner or manager can change these.</div>}
    </>
  );
}

// ---------- Notifications (MW-Notifications) ----------
const FILTERS = ['All', 'Orders', 'Kitchen', 'Alerts'] as const;
export function NotificationsPage() {
  const nav = useNavigate();
  const me = useMe();
  const [f, setF] = useState<(typeof FILTERS)[number]>('All');
  const { items, unread, markAll, loading } = useNotifications();
  const list = items.filter((n) => f === 'All' || n.cat === f).slice(0, 40);
  return (
    <>
      <MHead title="Notifications" sub={`${unread} new`} right={<button className="link" style={{ height: 44, padding: '0 8px', fontSize: 13 }} onClick={markAll}>Mark all read</button>} />
      <Chips items={FILTERS.map((x) => [x, x] as [typeof f, string])} value={f} onChange={setF} />
      {loading ? <Loading /> : (
        <div>
          {list.length === 0 && <Empty>Nothing here</Empty>}
          {list.map((n) => (
            <button key={n.id} className="row mline" style={{ width: '100%', alignItems: 'flex-start', padding: '12px 0', gap: 12 }} onClick={() => n.tableId && me.role !== 'chef' && nav({ to: me.role === 'waiter' ? '/w/table/$id' : '/tables/$id', params: { id: String(n.tableId) } })}>
              <span style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--chip)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontWeight: 700, fontSize: 12.5, color: n.color }}>{n.tag}</span>
              <span className="grow" style={{ textAlign: 'left' }}><span style={{ display: 'block', fontWeight: n.unread ? 600 : 500 }}>{n.title}</span><span className="dim small">{n.sub}</span></span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}><span className="dim small">{since(n.at)}</span><span className="dot" style={{ background: n.unread ? 'var(--blue2)' : 'transparent' }} /></span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ---------- Profile (MW-Profile) ----------
const START = 18 * 60, END = 23 * 60 + 30; // tonight's shift window shown in the design
export function ProfilePage() {
  const me = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  const meQ = useQuery({ queryKey: ['me'], queryFn: () => api('/auth/me') });
  const d = useQuery({ queryKey: ['dashboard', 1], queryFn: () => api('/manage/dashboard?days=1') });
  const { unread } = useNotifications();
  const brk = useMutation({ mutationFn: (onBreak: boolean) => api(`/team/staff/${me.id}`, { method: 'PATCH', body: { onBreak } }), onSuccess: () => qc.invalidateQueries() });
  const logout = async () => { await api('/auth/logout', { body: {} }).catch(() => {}); session.clear(); nav({ to: '/login' }); };
  if (!meQ.data) return <><MHead title="Profile" /><Loading /></>;
  const onBreak = meQ.data.staff.onBreak ?? false;
  const now = new Date(); const m = now.getHours() * 60 + now.getMinutes();
  const pct = clamp(((m - START) / (END - START)) * 100, 0, 100);
  const k = d.data?.kpis;
  const stats: [string, string][] = [['Orders today', String(k?.orders ?? '–')], ['Tables in use', k ? `${k.occupied}/${k.tables}` : '–'], ['Avg prep', k ? `${k.avgPrepMinutes}m` : '–']];
  return (
    <>
      <MHead title="Profile" />
      <div className="row-flex" style={{ gap: 14 }}>
        <span className="avatar" style={{ width: 64, height: 64, borderRadius: 32, fontSize: 24, fontWeight: 700 }}>{me.name[0]}</span>
        <div><div className="bb" style={{ fontSize: 20 }}>{me.name}</div><div className="muted" style={{ fontSize: 13 }}>{ROLE_LABEL[me.role] ?? me.role} · Spice Garden</div></div>
      </div>
      <div className="mcard" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row-flex" style={{ justifyContent: 'space-between' }}>
          <div><b>{onBreak ? 'On break' : 'On duty'}</b><Sub>Evening shift · 6 PM to 11:30 PM</Sub></div>
          <b className="small" style={{ color: onBreak ? 'var(--amber)' : 'var(--green)' }}>{onBreak ? 'Break' : 'On duty'}</b>
        </div>
        <div className="bar" style={{ height: 4 }}><div style={{ background: 'var(--blue2)', width: `${pct}%` }} /></div>
        <button className="mpill chip" style={{ height: 42 }} onClick={() => brk.mutate(!onBreak)}>{onBreak ? 'End break' : 'Take a break'}</button>
      </div>
      <div className="mcard" style={{ padding: '14px 4px', display: 'flex' }}>
        {stats.map(([l, v]) => <div key={l} style={{ flex: 1, textAlign: 'center' }}><div className="bb" style={{ fontSize: 20 }}>{v}</div><div className="dim small">{l}</div></div>)}
      </div>
      <div>
        <button className="mline" style={{ width: '100%', minHeight: 52, borderBottom: '1px solid var(--line)', gap: 12 }} onClick={() => nav({ to: '/notifications' })}>
          <span style={{ color: 'var(--muted)', display: 'flex' }}><Icon name="bell" size={20} /></span><span className="grow" style={{ textAlign: 'left', fontWeight: 500 }}>Notifications</span>{unread > 0 && <b className="blue small">{unread}</b>}<Icon name="chev" size={16} />
        </button>
        <button className="mline red b" style={{ minHeight: 52, color: 'var(--red)', fontWeight: 600 }} onClick={logout}>Sign out</button>
      </div>
    </>
  );
}
