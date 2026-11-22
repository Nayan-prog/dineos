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
    <div className="flex items-start justify-between gap-2 print:hidden! [&_h1]:m-0 [&_h1]:pt-1.25 [&_h1]:text-[26px] [&_h1]:leading-[34px] [&_h1]:font-bold [&_h1]:tracking-[-.3px]">
      <div className="flex items-start gap-1 min-w-0">
        {back && mobile && <button className="w-11 h-11 -ml-3 flex-none flex items-center justify-center border-0 bg-transparent text-fg [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.92)]" aria-label="Back" onClick={goBack}><Icon name="back" size={22} /></button>}
        <div className="min-w-0"><h1>{title}</h1>{sub !== undefined && <div className="text-muted text-[13px] mt-0.5">{sub || ' '}</div>}</div>
      </div>
      {right}
    </div>
  );
}
export const MAction = ({ label, onClick, icon = 'plus' }: { label: string; onClick: () => void; icon?: string }) => <button className="h-10 mt-0.5 inline-flex items-center gap-1 border-0 bg-transparent p-0 text-blue font-semibold whitespace-nowrap in-[.m-app]:min-h-11 in-[.m-app]:mt-0" onClick={onClick}>{icon && <Icon name={icon} size={16} sw={2} />}{label}</button>;
export function MSec({ title, right, children }: { title: string; right?: ReactNode; children?: ReactNode }) {
  return <section><div className="flex items-baseline justify-between mb-2.5 text-[15px] text-muted"><span className="font-brand font-bold in-[.top]:text-[22px]">{title}</span>{right}</div>{children}</section>;
}
export function Chips<K extends string | number>({ items, value, onChange }: { items: [K, string][]; value: K; onChange: (k: K) => void }) {
  return <div className="flex gap-2 overflow-x-auto flex-none [scrollbar-width:none] my-0 -mx-4 py-0 px-4 [&::-webkit-scrollbar]:hidden [&_button]:flex-none [&_button]:h-9 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[18px] [&_button]:border-0 [&_button]:bg-chip [&_button]:text-muted [&_button]:font-semibold [&_button]:text-[13px] [&_button]:whitespace-nowrap [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease)] [&_button.on]:bg-fg [&_button.on]:text-bg [&_button:active]:[transform:scale(.97)] in-[.m-app]:py-1 in-[.m-app]:px-4 in-[.m-app]:-my-1 in-[.m-app]:-mx-4 chips">{items.map(([k, l]) => <button key={String(k)} className={(k === value) ? "on" : ""} onClick={() => onChange(k)}>{l}</button>)}</div>;
}
export function UTabs<K extends string | number>({ items, value, onChange }: { items: [K, string, (string | number)?][]; value: K; onChange: (k: K) => void }) {
  return <div className="flex gap-5.5 border-b border-b-line overflow-x-auto [&_button]:h-11 [&_button]:p-0 [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button]:text-[14.5px] [&_button]:shadow-[inset_0_-2px_0_transparent] [&_button]:whitespace-nowrap [&_button.on]:text-fg [&_button.on]:font-bold [&_button.on]:shadow-[inset_0_-2px_0_var(--color-blue)] [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] tabs">{items.map(([k, l, n]) => <button key={String(k)} className={(k === value) ? "on" : ""} onClick={() => onChange(k)}>{l}{n !== undefined && <span className="text-dim"> {n}</span>}</button>)}</div>;
}
const Empty = ({ children }: { children: ReactNode }) => <div className="text-dim py-1 px-0">{children}</div>;
const Sub = ({ children, color }: { children: ReactNode; color?: string }) => <div className="text-[12.5px]" style={{ color: color ?? 'var(--color-dim)' }}>{children}</div>;
const veg = (v: boolean) => <span className="w-2.5 h-2.5 rounded-[2px] flex-none" style={{ border: `1.5px solid ${v ? 'var(--color-green)' : 'var(--color-red)'}` }} />;
const MStep = ({ value, onMinus, onPlus, label }: { value: string; onMinus: () => void; onPlus: () => void; label: string }) => (
  <span className="inline-flex items-center gap-0.5 [&_button]:w-8 [&_button]:h-8 [&_button]:rounded-[16px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-[16px] [&_span]:min-w-10 [&_span]:text-center [&_span]:font-bold [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)] stepper"><button type="button" aria-label={`Less ${label}`} onClick={onMinus}>−</button><span>{value}</span><button type="button" aria-label={`More ${label}`} onClick={onPlus}>+</button></span>
);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const mins = (d: string | null) => (d ? Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000)) : 0);

/** Table state colours as in the app: [label, text, dot] */
export const MTSTATE: Record<string, [string, string, string]> = {
  free: ['Free', '#a1a1a8', '#3a3a40'], seated: ['Ordering', '#f5c27a', '#f5b454'], eating: ['Dining', '#9cc3fa', '#7db0f9'], served: ['Dining', '#9cc3fa', '#7db0f9'],
  ready: ['Food ready', '#7fcfa3', '#5eb88a'], billing: ['Bill asked', '#d6c3ae', '#c9b29b'],
};
const MSTATUS: Record<string, string> = { waiting: 'var(--color-muted)', cooking: 'var(--color-amber)', ready: 'var(--color-green)', served: 'var(--color-blue)', cancelled: 'var(--color-red)' };

// ---------- Dashboard (MW-Dashboard, MW-Admin-Dashboard) ----------
const STAGES: [string, string, string][] = [['waiting', 'Placed', '#8b8b93'], ['cooking', 'Cooking', 'var(--color-amber)'], ['ready', 'Ready', 'var(--color-blue)'], ['served', 'Served', 'var(--color-green)'], ['billed', 'Billed', 'var(--color-blue2)']];
const KIND_COLOR: Record<string, string> = { Delay: 'var(--color-amber)', Stock: 'var(--color-red)', Load: 'var(--color-blue)', Alert: 'var(--color-red)' };
const up = (n: number) => (n > 0 ? '+' : '') + n;

export function DashboardM({ d, tasks, days, setDays }: { d: any; tasks: any[]; days: 1 | 7 | 28; setDays: (n: 1 | 7 | 28) => void }) {
  const me = useMe();
  const nav = useNavigate();
  const [section, setSection] = useState<'overview' | 'queues'>('overview');
  const [allChefs, setAllChefs] = useState(false);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const weekday = new Date().toLocaleDateString('en-IN', { weekday: 'short' });
  const head = <div className="text-muted text-[13px]">{today}{me.role === 'admin' ? ' · Admin view' : ''}</div>;
  const tabs = <UTabs items={[['overview', 'Overview'], ['queues', 'Station queues']]} value={section} onChange={setSection} />;
  if (section === 'queues') return <>{head}{tabs}<StationQueuesM stations={d.stations ?? []} /></>;

  const k = d.kpis;
  const money = 'revenue' in k;
  const prepDelta = k.avgPrepMinutes - k.targetPrepMinutes;
  const kpis: { label: string; value: ReactNode; delta?: string; color?: string; note: string }[] = [
    money
      ? { label: 'Revenue', value: rupees(k.revenue), delta: k.revenueChangePct == null ? undefined : `${up(k.revenueChangePct)}%`, color: (k.revenueChangePct ?? 0) >= 0 ? 'var(--color-green)' : 'var(--color-amber)', note: days === 1 ? `vs last ${weekday}` : `vs prev ${days} days` }
      : { label: 'Guests now', value: k.guests, note: `of ${k.seats} seats` },
    { label: 'Orders', value: k.orders, delta: up(k.orders - k.prevOrders), color: k.orders - k.prevOrders >= 0 ? 'var(--color-green)' : 'var(--color-amber)', note: `${k.openOrders} open` },
    { label: 'Avg prep', value: k.avgPrepMinutes + ' min', delta: k.targetPrepMinutes ? up(prepDelta) + 'm' : undefined, color: prepDelta > 0 ? 'var(--color-amber)' : 'var(--color-green)', note: `Target ${k.targetPrepMinutes}m` },
    { label: 'Occupancy', value: (k.tables ? Math.round((k.occupied / k.tables) * 100) : 0) + '%', delta: `${k.occupied}/${k.tables}`, color: 'var(--color-blue)', note: 'tables' },
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
        <div className="mt-3">{tabs}</div>
        <div className="flex items-center gap-4 mt-3">
          {([[1, 'Today'], [7, '7 days'], [28, '28 days']] as [1 | 7 | 28, string][]).map(([n, l]) => <button key={n} className="border-0 bg-transparent p-0 text-blue font-semibold [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] text-[14.5px]" style={{ fontWeight: days === n ? 700 : 500, color: days === n ? 'var(--color-blue)' : 'var(--color-muted)' }} onClick={() => setDays(n)}>{l}</button>)}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-y-5 gap-x-4 [&>div]:[animation:rise_var(--t-base)_var(--ease)_backwards]">
        {kpis.map((x) => (
          <div key={x.label}>
            <div className="text-muted text-[12.5px]">{x.label}</div>
            <div className="text-[22px] font-bold tracking-[-.3px] mt-1">{x.value}</div>
            <div className="flex items-center gap-1.5 mt-1 text-[11.5px]">{x.delta && <b style={{ color: x.color }}>{x.delta}</b>}<span className="text-dim">{x.note}</span></div>
          </div>
        ))}
      </div>

      <MSec title="Order pipeline">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2.5 justify-between items-baseline"><b>{completed} of {total} completed</b><b className="text-blue text-[20px]">{total ? Math.round((completed / total) * 100) : 0}%</b></div>
          <div className="flex rounded-[3px] overflow-hidden bg-chip2 h-2 gap-0.5">{stages.map((x) => x.n > 0 && <div key={x.key} style={{ flex: x.n, background: x.color }} />)}</div>
          <div className="flex items-center gap-1">
            {stages.map((x) => <div key={x.key} className="flex-1 text-center"><div className="font-bold text-[16px]">{x.n}</div><div className="text-dim flex items-center gap-1 justify-center text-[11px]"><span className="rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)] w-1.5 h-1.5" style={{ background: x.color }} />{x.label}</div></div>)}
          </div>
        </div>
      </MSec>

      <MSec title="Kitchen" right={<button className="border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]" onClick={() => setSection('queues')}>Queue</button>}>
        <div>
          {chefs.map((c: any) => (
            <div key={c.id} className="flex items-center border-b border-b-line stagger last:border-b-0 gap-3 py-2.75 px-0">
              <span className="rounded-[18px] bg-chip2 flex items-center justify-center font-semibold flex-none w-8.5 h-8.5 text-[13px]">{c.name[0]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex gap-1.5 items-baseline"><b className="text-[13.5px]">{c.name}</b><span className="text-dim text-[12.5px]">{c.onBreak ? 'On break' : c.station}</span></div>
                <div className="flex rounded-[3px] overflow-hidden bg-chip2 h-1 mt-1.5"><div style={{ background: c.load >= 85 ? 'var(--color-amber)' : 'var(--color-blue2)', width: `${Math.min(100, c.load)}%` }} /></div>
              </div>
              <div className="w-14 text-right"><div className="font-bold">{c.done}</div><div className="text-dim text-[11px]">{queue(c.stationId)} in queue</div></div>
            </div>
          ))}
          {d.chefs.length > 5 && <button className="border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] mt-2" onClick={() => setAllChefs(!allChefs)}>{allChefs ? 'Show less' : 'See all'}</button>}
        </div>
      </MSec>

      <MSec title="Dish Progress">
        <div className="flex flex-col gap-3.25">
          {d.dishes.length === 0 && <Empty>No dishes ordered yet</Empty>}
          {d.dishes.slice(0, 5).map((x: any) => (
            <div key={x.name}>
              <div className="flex items-center gap-2">{veg(!!x.veg)}<b className="text-[13.5px]">{x.name}</b><span className="flex-1 min-w-0" /><b className="text-[13px]">{x.done ?? 0}<span className="text-dim font-medium"> / {x.total}</span></b></div>
              <div className="flex rounded-[3px] overflow-hidden bg-chip2 h-1.25 mt-1.75"><div className="bg-blue2" style={{ width: `${((x.done ?? 0) / x.total) * 100}%` }} /><div className="bg-amber" style={{ width: `${(x.cooking / x.total) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </MSec>

      <MSec title="Needs attention">
        <div className="bg-card rounded-[18px] py-1 px-4">
          {attention.length === 0 && <div className="text-dim text-[12.5px] min-h-12 flex items-center">All clear</div>}
          {attention.map((a, i) => (
            <button key={i} className="flex items-center gap-2.5 min-h-12 w-full border-0 border-b border-b-line bg-transparent p-0 text-fg text-left last:border-b-0" onClick={() => nav({ to: '/notifications' })}>
              <b className="text-[12.5px]" style={{ color: KIND_COLOR[a.kind] ?? 'var(--color-muted)' }}>{a.kind}</b>
              <span className="flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis text-[13px] text-left">{a.text}</span>
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
        <div key={st.id} className="py-3 px-0" style={{ borderTop: idx ? '1px solid var(--color-line2)' : 0 }}>
          <b>{st.name}</b>
          <div className="text-muted text-[13.5px] mt-1">Waiting {st.waiting} · Cooking {st.cooking} · Pass {st.ready}</div>
          <Sub color={st.late > 0 ? 'var(--color-amber)' : undefined}>Oldest {st.oldestWaitMin} min · {st.late} late</Sub>
          <Sub color={st.chefsOnDuty === 0 && st.waiting > 0 ? 'var(--color-amber)' : undefined}>{st.chefsOnDuty} of {st.chefsTotal} chefs on duty</Sub>
          {st.next.slice(0, 2).map((i: any, k: number) => (
            <div key={k} className="flex items-center gap-2 mt-1 text-[13px]"><b>{i.table}</b><span className="flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">{i.qty} × {i.name}</span>{i.remake && <b className="text-[12.5px] text-red">Remake</b>}<span className="text-dim text-[12.5px]">{i.minutes} min</span></div>
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
      <input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" placeholder="Search table or dish" value={q} onChange={(e) => setQ(e.target.value)} />
      <Chips items={tabs.map(([k, l]) => [k, `${l} ${count(k)}`] as [string, string])} value={tab} onChange={setTab} />
      <div>
        {list.length === 0 && <Empty>Nothing here</Empty>}
        {list.map((x) => (
          <div key={x.id} className="flex py-3.5 px-0 border-b border-b-line stagger last:border-b-0 gap-3 items-start">
            <button className="font-bold border-0 bg-transparent p-0 text-fg text-left in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] w-11! text-[16px]" onClick={() => nav({ to: '/tables/$id', params: { id: String(x.tableId) } })}>{x.table}</button>
            <div className="flex-1 min-w-0">
              <b>{x.qty} × {x.name}</b>
              <div className="text-[12.5px] flex items-center gap-1.5 flex-wrap"><StatusDot color={MSTATUS[x.status]} ready={x.status === 'ready'} /><span style={{ color: MSTATUS[x.status] }}>{ITEM_LABEL[x.status as ItemStatus]}</span><span className="text-dim">· {x.station}{x.chef ? ' · ' + x.chef.split(' ')[0] : ''} · {since(new Date(x.createdAt).getTime())}</span></div>
              {(x.note || x.spice) && <div className="text-[12.5px] text-taupe">{[x.spice, x.note].filter(Boolean).join(' · ')}</div>}
            </div>
            <div className="text-right">
              {'unitPrice' in x && <div className="font-semibold text-[13px]">{rupees(x.unitPrice * x.qty)}</div>}
              {(x.status === 'waiting' || x.status === 'cooking') && <button className="border-0 bg-transparent p-0 font-semibold [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] text-red in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] text-[12.5px]" onClick={() => confirm(`Cancel ${x.qty} × ${x.name} for ${x.table}?`) && cancel(x.id)}>Cancel</button>}
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
      <div key={i.id} className="flex py-3.5 px-0 border-b border-b-line stagger last:border-b-0 gap-3 items-start">
        <div className="w-13 flex-none"><div className="font-bold text-[16px]">{i.table}</div><div className="text-[12.5px]" style={{ color: late ? 'var(--color-amber)' : 'var(--color-dim)' }}>{mins(i.status === 'cooking' ? i.claimedAt : i.status === 'ready' ? i.readyAt : i.createdAt)} min</div></div>
        <div className="flex-1 min-w-0">
          <b>{i.qty} × {i.name}</b>
          <Sub>{i.guestNo ? 'G' + i.guestNo : 'Shared'}{i.chef && i.status !== 'waiting' ? ' · ' + i.chef.split(' ')[0] : ''}{i.waiter && i.status === 'ready' ? ' · ' + i.waiter.split(' ')[0] + ' alerted' : ''}</Sub>
          {note && <div className="text-[12.5px] text-taupe">{note}</div>}
          {i.remake && <b className="text-[12.5px] text-red">Remake</b>}
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
        <div className="text-dim text-[12.5px]">{q.data.chefs.map((x: any) => `${x.name.split(' ')[0]} ${x.onBreak ? 'on break' : `${x.cooking}/${x.maxParallel} cooking`}`).join(' · ')}</div>
        <MSec title="Waiting" right={<b className="text-muted">{q.data.waiting.length}</b>}>{list(q.data.waiting)}{q.data.waiting.length === 0 && <Empty>Queue is clear</Empty>}</MSec>
        <MSec title="Cooking" right={<b className="text-muted">{q.data.cooking.length}</b>}>{list(q.data.cooking, (i) => <button className="border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]" onClick={() => release(i.id)}>Release</button>)}</MSec>
        <MSec title="At the pass" right={<b className="text-muted">{q.data.ready.length}</b>}>{list(q.data.ready)}</MSec>
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
  const bar = (pct: number) => <div className="flex rounded-[3px] overflow-hidden bg-chip2 h-0.75 mt-1.5"><div className="bg-blue2" style={{ width: `${Math.min(100, pct)}%` }} /></div>;
  return (
    <>
      <MHead title="Tables" sub={`${sum.tables} tables · ${sum.seats} seats`} right={<MAction label="Add table" onClick={() => nav({ to: '/tables/new' })} />} />
      <div className="flex gap-4 items-stretch">
        <div className="flex-1 min-w-0"><div className="text-muted text-[12.5px]">Tables in use</div><div className="mt-0.5"><span className="font-bold text-[20px]">{sum.occupied}</span><span className="text-dim text-[13px]"> / {sum.tables}</span></div>{bar(sum.tables ? (sum.occupied / sum.tables) * 100 : 0)}</div>
        <div className="flex-1 min-w-0"><div className="text-muted text-[12.5px]">Seats occupied</div><div className="mt-0.5"><span className="font-bold text-[20px]">{sum.guests}</span><span className="text-dim text-[13px]"> / {sum.seats}</span></div>{bar(sum.seats ? (sum.guests / sum.seats) * 100 : 0)}</div>
      </div>
      <div>
        <UTabs items={areas.map((z) => [z.id, z.name] as [number, string])} value={current} onChange={setArea} />
        <div className="flex items-center gap-2.5 justify-between mt-2.5">
          <span className="text-dim text-[12px]">{busy} of {list.length} busy · {guests}/{seats} seats</span>
          <span className="flex items-center gap-2.5">{LEGEND.map(([l, c]) => <span key={l} className="text-dim flex items-center gap-1 text-[12px]"><span className="rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)] w-1.5 h-1.5" style={{ background: c }} />{l}</span>)}</span>
        </div>
      </div>
      {list.length === 0 && <Empty>No tables in this area yet</Empty>}
      <div className="grid grid-cols-[repeat(4,_minmax(0,_1fr))] gap-2">
        {list.map((x) => {
          const [label, , dot] = MTSTATE[x.state] ?? MTSTATE.free; const free = x.state === 'free';
          return (
            <button key={x.id} className={(x.state === 'ready') ? "h-17 py-2.25 px-2.5 border-0 rounded-[14px] bg-card flex flex-col justify-between text-left text-fg relative [animation:rise_var(--t-base)_var(--ease)_backwards] [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.97)] shadow-[inset_0_0_0_1.5px_rgba(94,184,138,.6)]" : "h-17 py-2.25 px-2.5 border-0 rounded-[14px] bg-card flex flex-col justify-between text-left text-fg relative [animation:rise_var(--t-base)_var(--ease)_backwards] [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.97)]"} aria-label={`Table ${x.code}, ${label}, ${x.guests} of ${x.seats} seats`} onClick={() => nav({ to: '/tables/$id', params: { id: String(x.id) } })}>
              <span className="flex items-center gap-2.5 justify-between"><b className="text-[15px]" style={{ color: free ? 'var(--color-dim)' : 'var(--color-fg)' }}>{x.code}</b><span className="rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)] w-1.75 h-1.75" style={{ background: free ? 'transparent' : dot }} /></span>
              <span className="text-[11.5px]" style={{ color: free ? '#6f6f78' : 'var(--color-muted)' }}>{free ? `${x.seats} seats` : `${x.guests}/${x.seats} seats`}</span>
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
      <MHead title={`Table ${table.code}`} sub={`${table.area} · ${table.seats} seats${table.waiter ? ' · ' + table.waiter.split(' ')[0] : ''}`} right={<b className="text-[12.5px] pt-2.5" style={{ color: textColor }}>{label}</b>} />
      <div className="flex items-center bg-card rounded-[18px] p-3.5 gap-3.5">
        <div className="p-1.5 bg-[#fff] rounded-[12px] leading-[0]"><QRCodeSVG value={table.qrUrl} size={112} bgColor="#ffffff" fgColor="#0b0b0c" /></div>
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <b>Table QR code</b><Sub>Guests scan to order.</Sub>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <button className="h-8.5 py-0 px-3 border-0 rounded-[17px] bg-chip2 text-fg font-semibold text-[12.5px] inline-flex items-center in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] mchip" onClick={() => share(table)}>Share</button>
            <button className="h-8.5 py-0 px-3 border-0 rounded-[17px] bg-chip2 text-fg font-semibold text-[12.5px] inline-flex items-center in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] mchip" onClick={() => window.print()}>Print</button>
            {me.role !== 'waiter' && <button className="h-8.5 py-0 px-3 border-0 rounded-[17px] bg-chip2 font-semibold text-[12.5px] inline-flex items-center in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] mchip text-amber" onClick={onNewQr}>New QR</button>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] [&>div]:[animation:rise_var(--t-base)_var(--ease)_backwards] gap-2.5">
        {kpis.map(([l, v, of]) => <div key={l} className="bg-card rounded-[18px] py-3 px-3.5"><div className="text-muted text-[12.5px]">{l}</div><div><b className="text-[19px]">{v}</b>{of && <span className="text-dim text-[12px]"> {of}</span>}</div></div>)}
      </div>
      <MSec title="Current order">
        {items.length === 0 && <Empty>Nothing ordered yet</Empty>}
        {items.map((it: any) => {
          const note = [it.spice, ...(it.options ?? []), it.note].filter(Boolean).join(' · ');
          return (
            <div key={it.id} className="flex items-center border-b border-b-line stagger last:border-b-0 gap-3 min-h-12.5 py-2.25 px-0" style={{ opacity: it.status === 'cancelled' ? 0.45 : 1 }}>
              <span className="text-muted font-semibold min-w-11 text-center text-[11px]">{it.guestNo ? 'G' + it.guestNo : 'Shared'}</span>
              <div className="flex-1 min-w-0"><b className="text-[13.5px]">{it.qty} × {it.name}</b>{note && <div className="text-[11.5px] text-[#f5c27a]">{note}</div>}</div>
              <b className="text-[12.5px]" style={{ color: MSTATUS[it.status] }}>{ITEM_LABEL[it.status as ItemStatus]}</b>
            </div>
          );
        })}
      </MSec>
      {canOrder && (
        <div className="sticky bottom-[calc(82px_+_env(safe-area-inset-bottom))] mt-auto flex gap-2.5 pt-3 px-0 pb-1.5 bg-bg z-5 print:hidden! in-[.m-app.nonav]:bottom-[env(safe-area-inset-bottom)]">
          <Link to="/w/take-order" search={{ table: table.id } as any} className="flex-1 h-12.5 border-0 rounded-[25px] flex items-center justify-center font-semibold text-[14px] text-fg bg-chip active:[transform:scale(.98)] in-[.m-app]:min-h-11">{sess ? 'Add items' : 'Take order'}</Link>
          {sess && money && <button className="flex-1 h-12.5 border-0 rounded-[25px] flex items-center justify-center font-semibold text-[14px] bg-blue2 text-[#fff] active:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={onBill}>Bill · {rupees(totals.total)}</button>}
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
      <div className="relative h-44 rounded-[20px] bg-card overflow-hidden flex-none" aria-label="Preview">
        <div className="absolute bg-chip2 flex items-center justify-center font-bold text-[15px] [transition:all_200ms_var(--ease)]" style={{ left: `calc(50% - ${tw / 2}px)`, top: 88 - th / 2, width: tw, height: th, borderRadius: tr }}>{code || '—'}</div>
        {chairs.map((c, i) => <div key={i} className="absolute w-5.5 h-5.5 rounded-[7px] bg-blue2 opacity-85 [transition:all_200ms_var(--ease)]" style={{ left: `calc(50% + ${c.x}px)`, top: 88 + c.y }} />)}
        <span className="text-dim text-[12.5px] absolute right-3.5 bottom-3">Preview</span>
      </div>
      <label className="flex items-center border-b border-b-[#232327] py-1 px-0 [&_span]:text-[#b3b3b3] [&_span]:text-[15px] [&_input]:flex-1 [&_input]:min-w-0 [&_input]:p-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-[#f5f5f5] [&_input]:text-[20px] [&_input]:[outline:0] [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-[#b3b3b3] [&_button]:font-semibold [&_button]:text-[14px] [&_button]:h-9 [&_input]:min-h-11 m-0 gap-3 pt-1!"><span className="font-semibold w-27.5">Table number</span><input aria-label="Table number" autoCapitalize="characters" maxLength={10} value={code} className="font-semibold" onChange={(e) => { setCode(e.target.value); setTouched(true); }} /></label>
      <div>
        <div className="font-semibold text-[#b3b3b3] mb-2.5">Area</div>
        <div className="flex items-center flex-wrap gap-2">
          {list.map((a) => <button key={a.id} className={(a.id === area) ? "border-0 rounded-[17px] font-semibold inline-flex items-center h-10 py-0 px-4 text-[14px] bg-fg text-bg in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] mchip lg on" : "border-0 rounded-[17px] font-semibold inline-flex items-center h-10 py-0 px-4 text-[14px] bg-chip text-muted in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] mchip lg"} onClick={() => { setAreaId(a.id); setTouched(false); }}>{a.name}</button>)}
          <button className="rounded-[17px] font-semibold inline-flex items-center h-10 py-0 px-4 text-[14px] bg-transparent border border-edge text-[#b3b3b3] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] mchip lg" onClick={() => setNewArea(newArea === null ? '' : null)}>+ New area</button>
        </div>
        {newArea !== null && (
          <div className="flex items-center gap-2.5 mt-2.5">
            <input className="flex-1 min-w-0 w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" placeholder="Area name" maxLength={40} value={newArea} onChange={(e) => setNewArea(e.target.value)} />
            <button className="h-10 py-0 px-4.5 rounded-[20px] border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" disabled={!newArea.trim() || addArea.isPending} onClick={() => addArea.mutate()}>Add</button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2.5 justify-between">
        <div><b className="text-[16px]">Seats</b><Sub>Guests that fit at this table</Sub></div>
        <span className="inline-flex items-center h-11 rounded-[22px] bg-chip whitespace-nowrap flex-none [&_button]:w-11 [&_button]:h-11 [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-[22px] [&_button]:text-[#f5f5f5] mstep"><button aria-label="Fewer seats" onClick={() => setSeats(Math.max(1, seats - 1))}>−</button><b className="min-w-7 text-center text-[18px]">{seats}</b><button aria-label="More seats" onClick={() => setSeats(Math.min(30, seats + 1))}>+</button></span>
      </div>
      <div>
        <div className="font-semibold text-[#b3b3b3] mb-2.5">Shape</div>
        <div className="flex items-center gap-2">{(['square', 'round', 'long'] as const).map((s) => <button key={s} className={(shape === s) ? "flex-1 h-10 border-0 rounded-[12px] font-semibold bg-[#f5f5f5] text-bg in-[.m-app]:min-h-11 on" : "flex-1 h-10 border-0 rounded-[12px] bg-chip text-[#b3b3b3] font-semibold in-[.m-app]:min-h-11"} onClick={() => setShape(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
      </div>
      <div className="sticky bottom-[calc(82px_+_env(safe-area-inset-bottom))] mt-auto flex gap-2.5 pt-3 px-0 pb-1.5 bg-bg z-5 print:hidden! in-[.m-app.nonav]:bottom-[env(safe-area-inset-bottom)]"><button className="w-full h-14 border-0 rounded-[999px] bg-[#f5f5f5] text-bg text-[16px] font-semibold [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease)] disabled:bg-[#232327] disabled:text-[#8b8b93] disabled:opacity-100 active:enabled:[transform:scale(.98)] flex-1" disabled={!code.trim() || area == null || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save and create QR code'}</button></div>
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
      <button className="w-12 h-12 -ml-3 flex items-center justify-center border-0 bg-transparent text-fg" aria-label="Close" onClick={() => nav({ to: '/tables' })}><Icon name="x" size={22} sw={1.9} /></button>
      <div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)] bg-green" /><b className="text-[#7fcfa3]">QR code created</b></div>
        <h1 className="mt-2.5 mx-0 mb-1.5 text-[34px] leading-[40px] tracking-[-0.5px]">Table {t.code} is ready</h1>
        <div className="text-[15px] text-[#b3b3b3] leading-[21px]">{t.area} · {t.seats} seats · {shape}</div>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="p-3 bg-[#fff] rounded-[18px] leading-[0]"><QRCodeSVG value={t.qrUrl} size={216} bgColor="#ffffff" fgColor="#0b0b0c" /></div>
        <div className="text-dim whitespace-nowrap overflow-hidden text-ellipsis text-[13px] max-w-full">{t.qrUrl.replace(/^https?:\/\//, '')}</div>
        <div className="flex items-center gap-2">{[['Download', () => share(t)], ['Print', () => window.print()], ['Share', () => share(t)]].map(([l, f]) => <button key={l as string} className="border-0 rounded-[17px] font-semibold inline-flex items-center h-10 py-0 px-4 text-[14px] bg-chip text-muted in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] mchip lg" onClick={f as () => void}>{l as string}</button>)}</div>
      </div>
      <div className="sticky bottom-[calc(82px_+_env(safe-area-inset-bottom))] mt-auto flex pt-3 px-0 pb-1.5 bg-bg z-5 print:hidden! in-[.m-app.nonav]:bottom-[env(safe-area-inset-bottom)] flex-col gap-0">
        <button className="w-full h-14 border-0 rounded-[999px] bg-[#f5f5f5] text-bg text-[16px] font-semibold [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease)] disabled:bg-[#232327] disabled:text-[#8b8b93] disabled:opacity-100 active:enabled:[transform:scale(.98)]" onClick={() => nav({ to: '/tables/$id', params: { id: String(t.id) }, replace: true })}>Open table</button>
        <button className="border-0 bg-transparent p-0 text-fg text-left in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] mt-3 min-h-11 w-full! font-bold" onClick={() => nav({ to: '/tables/new', replace: true })}>Add another table</button>
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
      <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-x-4 [&>div]:[animation:rise_var(--t-base)_var(--ease)_backwards] gap-y-4.5">{kpis.map(([l, v]) => <div key={l}><div className="text-muted text-[12.5px]">{l}</div><div className="text-[22px] font-bold tracking-[-.3px] mt-1">{rupees(v)}</div></div>)}</div>
      <MSec title="Open tables" right={<b className="text-muted">{open.length}</b>}>
        {open.length === 0 && <Empty>No open tables</Empty>}
        {open.map((t) => (
          <button key={t.id} className="stagger flex items-center gap-2.5 min-h-12 border-0 border-b border-b-line bg-transparent p-0 text-fg text-left last:border-b-0 w-full py-3.5 px-0" onClick={() => nav({ to: '/tables/$id', params: { id: String(t.id) } })}>
            <b className="w-11 text-[16px] text-left">{t.code}</b>
            <span className="text-muted flex-1 min-w-0 text-[13px] text-left">{t.guests} guests · {t.items} dishes · {since(new Date(t.openedAt).getTime())}</span>
            {t.state === 'billing' && <b className="text-[12.5px] text-red">Bill asked</b>}<b>{rupees(t.amount)}</b>
          </button>
        ))}
      </MSec>
      <MSec title="Paid">
        {bills.length === 0 && <Empty>No bills yet</Empty>}
        {bills.slice(0, 20).map((b) => (
          <div key={b.id} className="flex items-center py-3.5 px-0 border-b border-b-line stagger last:border-b-0 gap-3">
            <b className="w-11 text-[16px]">{b.table}</b>
            <span className="text-muted flex-1 min-w-0 text-[13px]">{b.method.toUpperCase()} · {since(new Date(b.paidAt).getTime())} ago</span>
            {b.discount > 0 && <span className="text-[12.5px] text-amber">−{rupees(b.discount)}</span>}<b>{rupees(b.total)}</b>
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
          <div key={d.id} className="flex items-center py-3.5 px-0 border-b border-b-line stagger last:border-b-0 gap-3" style={{ opacity: d.available ? 1 : 0.7 }}>
            {veg(!!d.veg)}
            <div className="flex-1 min-w-0">
              <b>{d.name}</b>
              <Sub>{d.category} · {stationName(d.stationId)} · {d.prepMinutes} min{'price' in d ? ' · ' + rupees(d.price) : ''}</Sub>
              {d.options?.length > 0 && <div className="text-[12.5px] text-taupe">{d.options.join(' · ')}</div>}
            </div>
            <div className="flex flex-col items-end gap-1">
              <button className={(d.available) ? "border-0 bg-transparent p-0 font-semibold [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] text-green in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] text-[12.5px]" : "border-0 bg-transparent p-0 font-semibold [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] text-red in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] text-[12.5px]"} onClick={() => toggleStock(d)}>{d.available ? 'In stock' : 'Out of stock'}</button>
              <button className="border-0 bg-transparent p-0 text-blue font-semibold [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] text-[12.5px]" onClick={() => onEdit(d)}>Edit</button>
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
  const status = (p: any): [string, string] => p.onBreak ? ['On break', 'var(--color-amber)'] : p.onDuty ? ['On duty', 'var(--color-green)'] : ['Off', '#6f6f78'];
  const today = (p: any) => p.role === 'waiter' ? `${p.ordersToday} orders` : p.role === 'chef' ? `${p.doneToday} items` : '—';
  return (
    <>
      <MHead title="Team" sub={`${onDuty} of ${all.length} on duty · ${shift} shift`} right={<MAction label="Add staff" onClick={onAdd} />} />
      <UTabs items={[['all', 'All'], ['waiter', 'Waiters'], ['chef', 'Chefs'], ['mgr', 'Managers']]} value={role} onChange={setRole} />
      <div>
        {list.map((p) => { const [st, sc] = status(p); return (
          <div key={p.id} className="flex items-center border-b border-b-line stagger last:border-b-0 gap-3 min-h-15 p-0">
            <span className="rounded-[18px] bg-chip2 flex items-center justify-center font-semibold flex-none w-10 h-10 text-[15px] relative overflow-visible">{p.name[0]}<span className="absolute -right-0.25 -bottom-0.25 w-2.75 h-2.75 rounded-[6px] border-2 border-bg" style={{ background: sc }} /></span>
            <div className="flex-1 min-w-0"><b className="whitespace-nowrap overflow-hidden text-ellipsis block">{p.name}</b><Sub>{ROLE_LABEL[p.role]} · {where(p)}</Sub></div>
            <div className="text-right"><div className="font-semibold text-[13.5px]">{today(p)}</div><div className="text-[12.5px]" style={{ color: sc }}>{st}</div></div>
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
            <div className="flex gap-2.5 items-baseline pb-0.5"><b>{st.name}</b><span className="text-dim text-[12.5px]">{waiting(st.id)} waiting</span></div>
            {here.length === 0 && <div className="text-dim text-[12.5px] py-2.5 px-0">No chefs on this station</div>}
            {here.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3.5 border-b border-b-line stagger last:border-b-0 py-2.5 px-0">
                <div className="flex-1 min-w-0">
                  <b>{c.name}</b>
                  <div className="text-[12.5px] flex items-center gap-2.5"><span style={{ color: c.onBreak || c.cooking >= c.maxParallel ? 'var(--color-amber)' : 'var(--color-muted)' }}>{c.onBreak ? 'On break' : `${c.cooking} of ${c.maxParallel} cooking`}</span><button className="border-0 bg-transparent p-0 text-blue font-semibold [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] text-[12px]" onClick={() => patch(c.id, { onBreak: !c.onBreak })}>{c.onBreak ? 'Back on duty' : 'Send on break'}</button></div>
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
            <div key={w.id} className="flex items-center gap-3.5 border-b border-b-line stagger last:border-b-0 py-2.5 px-0">
              <div className="flex-1 min-w-0"><b>{w.name} <span className="text-dim font-medium">· {data.areas.find((a: any) => a.id === w.areaId)?.name ?? 'No area'}</span></b><div className="text-[12.5px]" style={{ color: w.onBreak ? 'var(--color-amber)' : 'var(--color-green)' }}>{w.onBreak ? 'On break' : w.onDuty ? 'On duty' : 'Off'}</div></div>
              <div className="text-right">
                <div className="font-semibold">{range(w.tables.map((x: any) => x.code))}</div>
                <div className="flex items-center gap-2.5 justify-end"><button className="border-0 bg-transparent p-0 text-blue font-semibold [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] text-[12px]" onClick={() => onSections(w)}>Tables</button><button className="border-0 bg-transparent p-0 text-blue font-semibold [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] text-[12px]" onClick={() => patch(w.id, { onBreak: !w.onBreak })}>{w.onBreak ? 'Back on duty' : 'Send on break'}</button></div>
              </div>
            </div>
          ))}
        </div>
        <MSec title="Alert rules">
          {([['Pass to free waiters in the area after', 'areaSecs', rules.areaSecs], ['Pass to the manager after', 'managerSecs', rules.managerSecs]] as const).map(([label, key, val]) => (
            <div key={key} className="flex items-center gap-3.5 border-b border-b-line stagger last:border-b-0 min-h-13 p-0">
              <span className="text-muted flex-1 min-w-0 text-[13px]">{label}</span>
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
          <div className="flex items-end gap-2 h-47.5">
            {data.days.map((d: any) => (
              <div key={d.d} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1.5">
                <b className="whitespace-nowrap overflow-hidden text-ellipsis text-[10.5px] max-w-full">{rupees(d.revenue).replace('.00', '')}</b>
                <div className="w-full max-w-8.5 bg-blue2 rounded-[6px]" style={{ height: Math.max(4, (d.revenue / max) * 130) }} />
                <span className="text-dim text-[10.5px]">{d.day}</span>
              </div>
            ))}
          </div>
        )}
      </MSec>
      <MSec title="Top dishes">
        {data.top.map((t: any, i: number) => <div key={t.name} className="flex items-center py-3.5 px-0 border-b border-b-line stagger last:border-b-0 gap-3"><span className="text-dim w-5">{i + 1}</span><b className="flex-1 min-w-0">{t.name}</b><span className="text-muted text-[12.5px]">{t.qty} sold</span><span className="w-20 text-right">{rupees(t.revenue)}</span></div>)}
        {data.top.length === 0 && <Empty>Nothing sold yet</Empty>}
      </MSec>
      <MSec title="Payment methods">
        {data.methods.map((m: any) => <div key={m.method} className="flex items-center py-3.5 px-0 border-b border-b-line stagger last:border-b-0 gap-3"><b className="flex-1 min-w-0">{m.method.toUpperCase()}</b><span className="text-muted text-[12.5px]">{m.n} bills</span><span className="w-20 text-right">{rupees(m.revenue)}</span></div>)}
        {data.methods.length === 0 && <Empty>No payments yet</Empty>}
      </MSec>
    </>
  );
}

// ---------- Settings (MW-Settings) ----------
export function SettingsM({ f, setF, can, save, saving }: { f: any; setF: (f: any) => void; can: boolean; save: () => void; saving: boolean }) {
  const field = (label: string, key: string, numeric?: boolean) => (
    <label className="flex flex-col gap-1.5 text-muted text-[13px]">{label}<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" style={{ opacity: can ? 1 : 0.6 }} disabled={!can} inputMode={numeric ? 'decimal' : undefined} value={f[key]} onChange={(e) => setF({ ...f, [key]: numeric ? Number(e.target.value.replace(/[^0-9.]/g, '')) : e.target.value })} /></label>
  );
  return (
    <>
      <MHead title="Settings" sub="Restaurant details" />
      {field('Restaurant name', 'name')}{field('Address', 'address')}{field('City', 'city')}{field('Tax (GST %)', 'taxPercent', true)}
      {can ? <button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" disabled={!f.name.trim() || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button> : <div className="text-dim text-[12.5px]">Only the owner or manager can change these.</div>}
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
      <MHead title="Notifications" sub={`${unread} new`} right={<button className="border-0 bg-transparent p-0 text-blue font-semibold [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] h-11! py-0 px-2 text-[13px]" onClick={markAll}>Mark all read</button>} />
      <Chips items={FILTERS.map((x) => [x, x] as [typeof f, string])} value={f} onChange={setF} />
      {loading ? <Loading /> : (
        <div>
          {list.length === 0 && <Empty>Nothing here</Empty>}
          {list.map((n) => (
            <button key={n.id} className="stagger flex min-h-12 border-0 border-b border-b-line bg-transparent p-0 text-fg text-left last:border-b-0 w-full items-start py-3 px-0 gap-3" onClick={() => n.tableId && me.role !== 'chef' && nav({ to: me.role === 'waiter' ? '/w/table/$id' : '/tables/$id', params: { id: String(n.tableId) } })}>
              <span className="w-10 h-10 rounded-[20px] bg-chip flex items-center justify-center flex-none font-bold text-[12.5px]" style={{ color: n.color }}>{n.tag}</span>
              <span className="flex-1 min-w-0 text-left"><span className="block" style={{ fontWeight: n.unread ? 600 : 500 }}>{n.title}</span><span className="text-dim text-[12.5px]">{n.sub}</span></span>
              <span className="flex flex-col items-end gap-1.5"><span className="text-dim text-[12.5px]">{since(n.at)}</span><span className="w-2 h-2 rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)]" style={{ background: n.unread ? 'var(--color-blue2)' : 'transparent' }} /></span>
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
      <div className="flex items-center gap-3.5">
        <span className="bg-chip2 flex items-center justify-center flex-none w-16 h-16 rounded-[32px] text-[24px] font-bold">{me.name[0]}</span>
        <div><div className="font-bold text-[20px]">{me.name}</div><div className="text-muted text-[13px]">{ROLE_LABEL[me.role] ?? me.role} · Spice Garden</div></div>
      </div>
      <div className="bg-card rounded-[18px] p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2.5 justify-between">
          <div><b>{onBreak ? 'On break' : 'On duty'}</b><Sub>Evening shift · 6 PM to 11:30 PM</Sub></div>
          <b className="text-[12.5px]" style={{ color: onBreak ? 'var(--color-amber)' : 'var(--color-green)' }}>{onBreak ? 'Break' : 'On duty'}</b>
        </div>
        <div className="flex rounded-[3px] overflow-hidden bg-chip2 h-1"><div className="bg-blue2" style={{ width: `${pct}%` }} /></div>
        <button className="border-0 rounded-[25px] flex items-center justify-center font-semibold text-[14px] text-fg bg-chip2 flex-none w-full active:[transform:scale(.98)] in-[.m-app]:min-h-11 h-10.5" onClick={() => brk.mutate(!onBreak)}>{onBreak ? 'End break' : 'Take a break'}</button>
      </div>
      <div className="bg-card rounded-[18px] py-3.5 px-1 flex">
        {stats.map(([l, v]) => <div key={l} className="flex-1 text-center"><div className="font-bold text-[20px]">{v}</div><div className="text-dim text-[12.5px]">{l}</div></div>)}
      </div>
      <div>
        <button className="flex items-center border-0 border-b border-b-line bg-transparent p-0 text-fg text-left last:border-b-0 w-full min-h-13 border-b! border-b-line! gap-3" onClick={() => nav({ to: '/notifications' })}>
          <span className="text-muted flex"><Icon name="bell" size={20} /></span><span className="flex-1 min-w-0 text-left font-medium">Notifications</span>{unread > 0 && <b className="text-[12.5px] text-blue">{unread}</b>}<Icon name="chev" size={16} />
        </button>
        <button className="flex items-center gap-2.5 w-full border-0 border-b border-b-line bg-transparent p-0 text-left last:border-b-0 min-h-13 text-red font-semibold" onClick={logout}>Sign out</button>
      </div>
    </>
  );
}
