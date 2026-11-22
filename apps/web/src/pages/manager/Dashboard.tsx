import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { rupees } from '@dineos/shared';
import { api, useTick } from '../../api';
import { ago, Loading, Sec, TABLE_STATE, Title, useIsMobile, useMe } from '../../ui';
import { DashboardM } from './mobile';

const LIMIT = 5;
const ROW_H = 64;

export default function Dashboard() {
  const me = useMe();
  useTick();
  const mobile = useIsMobile();
  const [days, setDays] = useState<1 | 7 | 28>(1);
  const d = useQuery({ queryKey: ['dashboard', days], queryFn: () => api(`/manage/dashboard?days=${days}`) });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api('/team/tasks'), enabled: mobile });
  const t = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables') });
  const a = useQuery({ queryKey: ['activity'], queryFn: () => api('/team/activity') });
  const [allChefs, setAllChefs] = useState(false);
  if (!d.data) return <Loading />;
  if (mobile) return <DashboardM d={d.data} tasks={tasks.data?.tasks ?? []} days={days} setDays={setDays} />;
  const k = d.data.kpis;
  const money = 'revenue' in k;
  const kpis = [
    ...(money ? [['Revenue today', rupees(k.revenue)]] : []),
    ['Orders', k.orders], ['Avg prep time', k.avgPrepMinutes + ' min'], ['Occupancy', `${k.occupied} / ${k.tables}`],
  ];
  const p = d.data.pipeline;
  const stages = [['Placed', p.waiting ?? 0, 'var(--color-muted)'], ['Cooking', p.cooking ?? 0, 'var(--color-amber)'], ['Ready', p.ready ?? 0, 'var(--color-green)'], ['Served', p.served ?? 0, 'var(--color-blue)']];
  const pTotal = stages.reduce((n, x) => n + (x[1] as number), 0);
  const pServed = p.served ?? 0;
  const hourly: { h: number; revenue: number }[] = d.data.hourly ?? [];
  const maxH = Math.max(1, ...hourly.map((x) => x.revenue ?? 0));
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  return (
    <>
      <Title title="Dashboard" sub={`${today} · ${me.name.split(' ')[0]}`} />
      {d.data.managerAlerts > 0 && <Link to="/shifts" className="text-amber font-semibold flex items-center gap-2.5">{d.data.managerAlerts} alert{d.data.managerAlerts > 1 ? 's' : ''} nobody answered · check the floor</Link>}
      <div className="grid grid-cols-[repeat(auto-fit,_minmax(170px,_1fr))] gap-5 [&>div+div]:border-l [&>div+div]:border-l-line2 [&>div+div]:pl-5 phone:[&>div+div]:border-l-0 phone:[&>div+div]:pl-0 [&>div]:stagger">{kpis.map(([l, v]) => <div key={l as string}><div className="text-muted text-[13px]">{l}</div><div className="text-[30px] font-bold tracking-[-.5px] mt-0.5">{v}</div></div>)}</div>
      <Sec title="Dish pipeline">
        <div className="flex gap-2.5 items-baseline"><span className="font-semibold">{pServed} of {pTotal} dishes completed</span><span className="flex-1 min-w-0" /><span className="text-blue font-semibold text-[22px]">{pTotal ? Math.round((pServed / pTotal) * 100) : 0}%</span></div>
        <div className="flex h-1.5 rounded-[3px] overflow-hidden bg-chip2 mt-3 mx-0 mb-3.5 gap-0.5">{stages.map(([l, n, c]) => (n as number) > 0 && <div key={l as string} title={`${l} ${n}`} style={{ background: c as string, flex: n as number }} />)}</div>
        <div className="flex items-center gap-2.5 flex-wrap gap-y-2 gap-x-7">{stages.map(([l, n, c]) => <span key={l as string} className="flex items-center gap-2"><span className="w-2 h-2 rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)]" style={{ background: c as string }} /><span className="text-muted">{l}</span><span className="font-bold">{n}</span></span>)}</div>
      </Sec>
      <div className="grid grid-cols-[repeat(auto-fit,_minmax(300px,_1fr))] gap-y-8 gap-x-0 [&>*]:py-0 [&>*]:px-7 [&>*:first-child]:pl-0 [&>*:last-child]:pr-0 [&>*+*]:border-l [&>*+*]:border-l-line2 phone:[&>*]:p-0! phone:[&>*]:border-l-0!">
        <Sec title="Dish progress" right={<Link to="/orders" className="border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]">See all</Link>}>
          {d.data.dishes.length === 0 && <div className="border border-dashed border-edge rounded-[16px] p-5.5 text-dim text-center">No dishes ordered yet today</div>}
          {d.data.dishes.slice(0, LIMIT).map((x: any) => (
            <div key={x.name} className="flex flex-col justify-center border-b border-b-line" style={{ height: ROW_H }}>
              <div className="flex items-center gap-2.5"><span className="font-semibold">{x.name}</span><span className="text-dim text-[12.5px]">{x.station}</span><span className="flex-1 min-w-0" /><span className="font-semibold">{x.done ?? 0}<span className="text-dim"> / {x.total}</span></span></div>
              <div className="flex h-1.5 rounded-[3px] overflow-hidden bg-chip2 mt-2"><div className="bg-blue2" style={{ width: `${((x.done ?? 0) / x.total) * 100}%` }} /><div className="bg-amber" style={{ width: `${(x.cooking / x.total) * 100}%` }} /></div>
            </div>
          ))}
        </Sec>
        <Sec title="Kitchen" right={<Link to="/kitchen" className="border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]">Open display</Link>}>
          {(allChefs ? d.data.chefs : d.data.chefs.slice(0, LIMIT)).map((c: any) => (
            <div key={c.id} className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0 p-0!" style={{ height: ROW_H }}>
              <span className="w-9 h-9 rounded-[18px] bg-chip2 flex items-center justify-center font-semibold flex-none">{c.name[0]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><span className="font-semibold">{c.name}</span><span className="text-dim text-[12.5px]">{c.station}</span>{c.onBreak && <span className="text-[12.5px] text-amber font-semibold">On break</span>}</div>
                <div className="flex items-center gap-2.5 mt-1.5"><div className="flex-1 min-w-0 flex rounded-[3px] overflow-hidden bg-chip2 h-1"><div style={{ background: c.load >= 85 ? 'var(--color-amber)' : 'var(--color-blue2)', width: c.load + '%' }} /></div><span className="text-dim text-[12.5px] w-15.5">{c.load}% load</span></div>
              </div>
              <div className="flex items-center gap-4 text-right">
                {[['done', c.done], ['cooking', c.cooking], ['avg', c.avg + 'm']].map(([l, v]) => <div key={l}><div className="font-bold text-[15px]">{v}</div><div className="text-dim text-[11.5px]">{l}</div></div>)}
              </div>
            </div>
          ))}
          {d.data.chefs.length > LIMIT && <button className="border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] mt-3" onClick={() => setAllChefs(!allChefs)}>{allChefs ? 'Show less' : 'See all'}</button>}
        </Sec>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,_minmax(300px,_1fr))] gap-y-8 gap-x-0 [&>*]:py-0 [&>*]:px-7 [&>*:first-child]:pl-0 [&>*:last-child]:pr-0 [&>*+*]:border-l [&>*+*]:border-l-line2 phone:[&>*]:p-0! phone:[&>*]:border-l-0!">
        <Sec title="Floor">
          <div className="grid grid-cols-[repeat(auto-fill,_minmax(52px,_1fr))] gap-2">
            {t.data?.tables.map((x: any) => <Link key={x.id} to="/tables/$id" params={{ id: String(x.id) }} aria-label={`${x.code} ${TABLE_STATE[x.state][0]}`} className="h-11 rounded-[10px] flex items-center justify-center text-[13px] font-bold" style={{ background: x.state === 'free' ? 'var(--color-chip)' : 'transparent', boxShadow: `inset 0 0 0 1.5px ${TABLE_STATE[x.state][1]}` }}>{x.code}</Link>)}
          </div>
          <div className="text-dim text-[12.5px] flex items-center gap-2.5 flex-wrap mt-3.5 gap-y-1.5 gap-x-3.5">{Object.values(TABLE_STATE).map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)]" style={{ background: c }} />{l}</span>)}</div>
        </Sec>
        {money && (
          <Sec title="Revenue by hour">
            {hourly.length === 0 ? <div className="border border-dashed border-edge rounded-[16px] p-5.5 text-dim text-center">No bills yet today</div> : (
              <div className="flex items-end gap-2 h-37.5">
                {hourly.map((x) => <div key={x.h} className="flex-1 flex flex-col items-center gap-1.5"><div title={rupees(x.revenue)} className="w-full max-w-7 bg-blue2 rounded-[4px]" style={{ height: `${(x.revenue / maxH) * 120}px` }} /><span className="text-dim text-[11px]">{x.h}:00</span></div>)}
              </div>
            )}
          </Sec>
        )}
        <Sec title="Activity">
          {a.data?.slice(0, 8).map((x: any) => <div key={x.id} className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0 py-2.5! px-0!"><span className="flex-1 min-w-0">{x.text}</span><span className="text-dim text-[12.5px]">{ago(x.createdAt)}</span></div>)}
        </Sec>
      </div>
    </>
  );
}
