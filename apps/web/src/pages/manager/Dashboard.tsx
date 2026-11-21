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
  const stages = [['Placed', p.waiting ?? 0, 'var(--muted)'], ['Cooking', p.cooking ?? 0, 'var(--amber)'], ['Ready', p.ready ?? 0, 'var(--green)'], ['Served', p.served ?? 0, 'var(--blue)']];
  const pTotal = stages.reduce((n, x) => n + (x[1] as number), 0);
  const pServed = p.served ?? 0;
  const hourly: { h: number; revenue: number }[] = d.data.hourly ?? [];
  const maxH = Math.max(1, ...hourly.map((x) => x.revenue ?? 0));
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  return (
    <>
      <Title title="Dashboard" sub={`${today} · ${me.name.split(' ')[0]}`} />
      {d.data.managerAlerts > 0 && <Link to="/shifts" className="row-flex amber b">{d.data.managerAlerts} alert{d.data.managerAlerts > 1 ? 's' : ''} nobody answered · check the floor</Link>}
      <div className="kpis">{kpis.map(([l, v]) => <div key={l as string}><div className="kpi-l">{l}</div><div className="kpi-v">{v}</div></div>)}</div>
      <Sec title="Dish pipeline">
        <div className="row-flex" style={{ alignItems: 'baseline' }}><span className="b">{pServed} of {pTotal} dishes completed</span><span className="grow" /><span className="blue b" style={{ fontSize: 22 }}>{pTotal ? Math.round((pServed / pTotal) * 100) : 0}%</span></div>
        <div className="bar" style={{ margin: '12px 0 14px', gap: 2 }}>{stages.map(([l, n, c]) => (n as number) > 0 && <div key={l as string} title={`${l} ${n}`} style={{ background: c as string, flex: n as number }} />)}</div>
        <div className="row-flex wrap" style={{ gap: '8px 28px' }}>{stages.map(([l, n, c]) => <span key={l as string} className="row-flex" style={{ gap: 8 }}><span className="dot" style={{ background: c as string }} /><span className="muted">{l}</span><span className="bb">{n}</span></span>)}</div>
      </Sec>
      <div className="cols">
        <Sec title="Dish progress" right={<Link to="/orders" className="link">See all</Link>}>
          {d.data.dishes.length === 0 && <div className="empty">No dishes ordered yet today</div>}
          {d.data.dishes.slice(0, LIMIT).map((x: any) => (
            <div key={x.name} style={{ height: ROW_H, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderBottom: '1px solid var(--line)' }}>
              <div className="row-flex"><span className="b">{x.name}</span><span className="dim small">{x.station}</span><span className="grow" /><span className="b">{x.done ?? 0}<span className="dim"> / {x.total}</span></span></div>
              <div className="bar" style={{ marginTop: 8 }}><div style={{ background: 'var(--blue2)', width: `${((x.done ?? 0) / x.total) * 100}%` }} /><div style={{ background: 'var(--amber)', width: `${(x.cooking / x.total) * 100}%` }} /></div>
            </div>
          ))}
        </Sec>
        <Sec title="Kitchen" right={<Link to="/kitchen" className="link">Open display</Link>}>
          {(allChefs ? d.data.chefs : d.data.chefs.slice(0, LIMIT)).map((c: any) => (
            <div key={c.id} className="row" style={{ height: ROW_H, padding: 0 }}>
              <span className="avatar">{c.name[0]}</span>
              <div className="grow">
                <div className="row-flex" style={{ gap: 8 }}><span className="b">{c.name}</span><span className="dim small">{c.station}</span>{c.onBreak && <span className="amber small b">On break</span>}</div>
                <div className="row-flex" style={{ marginTop: 6 }}><div className="bar grow" style={{ height: 4 }}><div style={{ background: c.load >= 85 ? 'var(--amber)' : 'var(--blue2)', width: c.load + '%' }} /></div><span className="dim small" style={{ width: 62 }}>{c.load}% load</span></div>
              </div>
              <div className="row-flex" style={{ gap: 16, textAlign: 'right' }}>
                {[['done', c.done], ['cooking', c.cooking], ['avg', c.avg + 'm']].map(([l, v]) => <div key={l}><div className="bb" style={{ fontSize: 15 }}>{v}</div><div className="dim" style={{ fontSize: 11.5 }}>{l}</div></div>)}
              </div>
            </div>
          ))}
          {d.data.chefs.length > LIMIT && <button className="link" style={{ marginTop: 12 }} onClick={() => setAllChefs(!allChefs)}>{allChefs ? 'Show less' : 'See all'}</button>}
        </Sec>
      </div>
      <div className="cols">
        <Sec title="Floor">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: 8 }}>
            {t.data?.tables.map((x: any) => <Link key={x.id} to="/tables/$id" params={{ id: String(x.id) }} aria-label={`${x.code} ${TABLE_STATE[x.state][0]}`} style={{ height: 44, borderRadius: 10, background: x.state === 'free' ? 'var(--chip)' : 'transparent', boxShadow: `inset 0 0 0 1.5px ${TABLE_STATE[x.state][1]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{x.code}</Link>)}
          </div>
          <div className="row-flex wrap dim small" style={{ marginTop: 14, gap: '6px 14px' }}>{Object.values(TABLE_STATE).map(([l, c]) => <span key={l} className="row-flex" style={{ gap: 6 }}><span className="dot" style={{ background: c }} />{l}</span>)}</div>
        </Sec>
        {money && (
          <Sec title="Revenue by hour">
            {hourly.length === 0 ? <div className="empty">No bills yet today</div> : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150 }}>
                {hourly.map((x) => <div key={x.h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}><div title={rupees(x.revenue)} style={{ width: '100%', maxWidth: 28, height: `${(x.revenue / maxH) * 120}px`, background: 'var(--blue2)', borderRadius: 4 }} /><span className="dim" style={{ fontSize: 11 }}>{x.h}:00</span></div>)}
              </div>
            )}
          </Sec>
        )}
        <Sec title="Activity">
          {a.data?.slice(0, 8).map((x: any) => <div key={x.id} className="row" style={{ padding: '10px 0' }}><span className="grow">{x.text}</span><span className="dim small">{ago(x.createdAt)}</span></div>)}
        </Sec>
      </div>
    </>
  );
}
