import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { ITEM_LABEL, rupees, type ItemStatus } from '@dineos/shared';
import { api, useTick } from '../../api';
import { ago, Loading, mins, Sec, STATUS_COLOR, Title, useIsMobile, useToast, StatusDot } from '../../ui';
import { KitchenM, OrdersM } from './mobile';

/** Orders: every dish on the floor, filterable by status */
export function Orders() {
  useTick();
  const mobile = useIsMobile();
  const search = useSearch({ strict: false }) as { q?: string };
  const [tab, setTab] = useState<'all' | ItemStatus>('all');
  const [q, setQ] = useState(search.q ?? '');
  const qc = useQueryClient(); const toast = useToast();
  const { data } = useQuery({ queryKey: ['orders'], queryFn: () => api('/floor/orders') });
  const cancel = useMutation({ mutationFn: (id: number) => api(`/floor/items/${id}/cancel`, { body: { reason: 'Voided by manager' } }), onSuccess: () => { qc.invalidateQueries(); toast('Dish cancelled'); }, onError: (e) => toast((e as Error).message) });
  if (!data) return <Loading />;
  const tabs: ['all' | ItemStatus, string][] = [['all', 'All'], ['waiting', 'Placed'], ['cooking', 'Cooking'], ['ready', 'Ready'], ['served', 'Served'], ['cancelled', 'Cancelled']];
  if (mobile) return <OrdersM data={data} tab={tab} setTab={setTab} q={q} setQ={setQ} cancel={(id) => cancel.mutate(id)} tabs={tabs} />;
  const list = data.filter((x: any) => (tab === 'all' || x.status === tab) && (!q || `${x.table} ${x.name} ${x.station}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <Title title="Orders" sub={`${data.filter((x: any) => x.status === 'waiting' || x.status === 'cooking').length} dishes in progress`} right={<input className="input" style={{ width: 260, height: 40 }} placeholder="Search table or dish" value={q} onChange={(e) => setQ(e.target.value)} />} />
      <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l} <span className="dim">{k === 'all' ? data.length : data.filter((x: any) => x.status === k).length}</span></button>)}</div>
      <table className="table">
        <thead><tr><th>Table</th><th>Dish</th><th>Guest</th><th>Station</th><th>Status</th><th>Time</th>{data[0] && 'unitPrice' in data[0] && <th>Amount</th>}<th /></tr></thead>
        <tbody>
          {list.map((x: any) => (
            <tr key={x.id}>
              <td><Link to="/tables/$id" params={{ id: String(x.tableId) }} className="bb">{x.table}</Link></td>
              <td><div className="b">{x.qty} × {x.name}</div>{(x.note || x.spice) && <div className="taupe small">{[x.spice, x.note].filter(Boolean).join(' · ')}</div>}</td>
              <td className="muted">{x.guestNo ? 'G' + x.guestNo : 'Shared'}</td>
              <td className="muted">{x.station}{x.chef && <div className="dim small">{x.chef}</div>}</td>
              <td><span className="row-flex" style={{ gap: 6, color: STATUS_COLOR[x.status] }}><StatusDot color={STATUS_COLOR[x.status]} ready={x.status === 'ready'} />{ITEM_LABEL[x.status as ItemStatus]}</span></td>
              <td className="dim">{ago(x.createdAt)}</td>
              {'unitPrice' in x && <td>{rupees(x.unitPrice * x.qty)}</td>}
              <td style={{ textAlign: 'right' }}>{(x.status === 'waiting' || x.status === 'cooking') && <button className="link red" onClick={() => confirm(`Cancel ${x.qty} × ${x.name} for ${x.table}?`) && cancel.mutate(x.id)}>Cancel</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && <div className="empty">Nothing here</div>}
    </>
  );
}

/** Station queues: live load per kitchen station (no money). Click a station to open its queue. */
export function StationQueues() {
  useTick();
  const d = useQuery({ queryKey: ['dashboard'], queryFn: () => api('/manage/dashboard') });
  if (!d.data) return <Loading />;
  return (
    <>
      <Title title="Station queues" sub="Live load per station" />
        <div className="stations">
          {(d.data.stations ?? []).map((st: any) => (
            <Link key={st.id} to="/kitchen" search={{ station: st.id }}>
              <div className="b" style={{ fontSize: 15 }}>{st.name}</div>
              <div className="row-flex" style={{ gap: 18, margin: '10px 0 8px' }}>
                {[['Waiting', st.waiting, 'var(--muted)'], ['Cooking', st.cooking, 'var(--amber)'], ['At the pass', st.ready, 'var(--green)']].map(([l, n, c]) => (
                  <div key={l as string}><div className="bb" style={{ fontSize: 24 }}>{n}</div><div className="dim small row-flex" style={{ gap: 6 }}><span className="dot" style={{ background: c as string }} />{l}</div></div>
                ))}
              </div>
              <div className={st.late > 0 ? 'amber small' : 'dim small'}>Oldest {st.oldestWaitMin} min · {st.late} late</div>
              <div className={st.chefsOnDuty === 0 && st.waiting > 0 ? 'amber small' : 'dim small'} style={{ marginTop: 2 }}>{st.chefsOnDuty} of {st.chefsTotal} chefs on duty</div>
              <div style={{ marginTop: 10 }}>
                {st.next.map((i: any, n: number) => (
                  <div key={n} className="row-flex small" style={{ gap: 8, padding: '5px 0' }}>
                    <span className="bb" style={{ width: 28 }}>{i.table}</span>
                    <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.qty} × {i.name}</span>
                    {i.remake && <span className="red bb">Remake</span>}
                    <span className="dim">{i.minutes} min</span>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
    </>
  );
}

/** Kitchen display: every station, read only for the manager team (with release for stuck dishes) */
export function Kitchen() {
  useTick();
  const mobile = useIsMobile();
  const stations = useQuery({ queryKey: ['stations'], queryFn: () => api('/kitchen/stations') });
  const search = useSearch({ strict: false }) as { station?: number };
  const [sid, setSid] = useState<number | null>(search.station ?? null);
  const current = sid ?? stations.data?.[0]?.id;
  const qc = useQueryClient(); const toast = useToast();
  const q = useQuery({ queryKey: ['queue', current], queryFn: () => api(`/kitchen/queue?station=${current}`), enabled: !!current });
  const release = useMutation({ mutationFn: (id: number) => api(`/kitchen/items/${id}/release`, { body: {} }), onSuccess: () => { qc.invalidateQueries(); toast('Back in the queue'); } });
  if (mobile) return <KitchenM stations={stations.data ?? []} current={current} setSid={setSid} q={q} release={(id) => release.mutate(id)} />;
  return (
    <>
      <Title title="Kitchen Display" sub="Shared station queues · urgent and oldest first" />
      <div className="tabs">{stations.data?.map((x: any) => <button key={x.id} className={current === x.id ? 'on' : ''} onClick={() => setSid(x.id)}>{x.name}</button>)}</div>
      {!q.data ? <Loading /> : (
        <>
          <div className="row-flex wrap" style={{ gap: '12px 28px' }}>{q.data.chefs.map((c: any) => <span key={c.id}><span className="b">{c.name}</span> <span className={c.onBreak ? 'amber small' : 'dim small'}>{c.onBreak ? 'on break' : `${c.cooking} of ${c.maxParallel} cooking`}</span></span>)}</div>
          <div className="cols">
            <Sec title="Waiting" n={q.data.waiting.length}>{q.data.waiting.map((i: any) => <QRow key={i.id} i={i} />)}{!q.data.waiting.length && <div className="empty">Queue is clear</div>}</Sec>
            <Sec title="Cooking" n={q.data.cooking.length}>{q.data.cooking.map((i: any) => <QRow key={i.id} i={i} right={<button className="link" onClick={() => release.mutate(i.id)}>Release</button>} />)}</Sec>
            <Sec title="At the pass" n={q.data.ready.length}>{q.data.ready.map((i: any) => <QRow key={i.id} i={i} />)}</Sec>
          </div>
        </>
      )}
    </>
  );
}

export function QRow({ i, right }: { i: any; right?: React.ReactNode }) {
  const age = mins(i.status === 'cooking' ? i.claimedAt : i.status === 'ready' ? i.readyAt : i.createdAt);
  const late = i.status !== 'ready' && mins(i.createdAt) > i.prepMinutes;
  return (
    <div className="row">
      <div style={{ width: 52, flex: 'none' }}><div className="bb" style={{ fontSize: 16 }}>{i.table}</div><div className="small" style={{ color: late ? 'var(--amber)' : 'var(--dim)' }}>{age} min</div></div>
      <div className="grow">
        <div className="row-flex wrap" style={{ gap: 8 }}><span className="b">{i.qty} × {i.name}</span><span className="dim small">{i.guestNo ? 'G' + i.guestNo : 'Shared'}</span>{i.remake && <span className="red small bb">Remake</span>}{i.chef && i.status !== 'waiting' && <span className="blue small b">{i.chef.split(' ')[0]}</span>}</div>
        {(i.spice || i.note || i.options?.length > 0) && <div className="taupe small">{[i.spice, ...(i.options ?? []), i.note].filter(Boolean).join(' · ')}</div>}
        {i.status === 'ready' && i.waiter && <div className="dim small">{i.waiter} alerted</div>}
      </div>
      {right}
    </div>
  );
}
