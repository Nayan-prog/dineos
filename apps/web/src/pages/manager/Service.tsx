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
      <Title title="Orders" sub={`${data.filter((x: any) => x.status === 'waiting' || x.status === 'cooking').length} dishes in progress`} right={<input className="py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue w-65 h-10" placeholder="Search table or dish" value={q} onChange={(e) => setQ(e.target.value)} />} />
      <div className="flex gap-5.5 border-b border-b-line overflow-x-auto [&_button]:h-11 [&_button]:p-0 [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button]:text-[14.5px] [&_button]:shadow-[inset_0_-2px_0_transparent] [&_button]:whitespace-nowrap [&_button.on]:text-fg [&_button.on]:font-bold [&_button.on]:shadow-[inset_0_-2px_0_var(--color-blue)] [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] tabs">{tabs.map(([k, l]) => <button key={k} className={(tab === k) ? "on" : ""} onClick={() => setTab(k)}>{l} <span className="text-dim">{k === 'all' ? data.length : data.filter((x: any) => x.status === k).length}</span></button>)}</div>
      <table className="w-full [border-collapse:collapse] [&_th]:text-left [&_th]:font-medium [&_th]:text-dim [&_th]:text-[12.5px] [&_th]:pt-0 [&_th]:pr-3 [&_th]:pb-2.5 [&_th]:pl-0 [&_td]:pt-3 [&_td]:pr-3 [&_td]:pb-3 [&_td]:pl-0 [&_td]:border-t [&_td]:border-t-line [&_tbody_tr]:stagger">
        <thead><tr><th>Table</th><th>Dish</th><th>Guest</th><th>Station</th><th>Status</th><th>Time</th>{data[0] && 'unitPrice' in data[0] && <th>Amount</th>}<th /></tr></thead>
        <tbody>
          {list.map((x: any) => (
            <tr key={x.id}>
              <td><Link to="/tables/$id" params={{ id: String(x.tableId) }} className="font-bold">{x.table}</Link></td>
              <td><div className="font-semibold">{x.qty} × {x.name}</div>{(x.note || x.spice) && <div className="text-[12.5px] text-taupe">{[x.spice, x.note].filter(Boolean).join(' · ')}</div>}</td>
              <td className="text-muted">{x.guestNo ? 'G' + x.guestNo : 'Shared'}</td>
              <td className="text-muted">{x.station}{x.chef && <div className="text-dim text-[12.5px]">{x.chef}</div>}</td>
              <td><span className="flex items-center gap-1.5" style={{ color: STATUS_COLOR[x.status] }}><StatusDot color={STATUS_COLOR[x.status]} ready={x.status === 'ready'} />{ITEM_LABEL[x.status as ItemStatus]}</span></td>
              <td className="text-dim">{ago(x.createdAt)}</td>
              {'unitPrice' in x && <td>{rupees(x.unitPrice * x.qty)}</td>}
              <td className="text-right">{(x.status === 'waiting' || x.status === 'cooking') && <button className="border-0 bg-transparent p-0 font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] text-red in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]" onClick={() => confirm(`Cancel ${x.qty} × ${x.name} for ${x.table}?`) && cancel.mutate(x.id)}>Cancel</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && <div className="border border-dashed border-edge rounded-[16px] p-5.5 text-dim text-center">Nothing here</div>}
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
        <div className="grid grid-cols-[repeat(auto-fit,_minmax(240px,_1fr))] gap-y-6 gap-x-0 phone:grid-cols-[1fr] phone:gap-0 [&>a]:block [&>a]:py-0 [&>a]:px-6 [&>a]:text-current [&>a:first-child]:pl-0 [&>a:last-child]:pr-0 [&>a+a]:border-l [&>a+a]:border-l-line2 phone:[&>a]:py-4! phone:[&>a]:px-0! phone:[&>a+a]:border-l-0 phone:[&>a+a]:border-t phone:[&>a+a]:border-t-line2 [&>a]:stagger">
          {(d.data.stations ?? []).map((st: any) => (
            <Link key={st.id} to="/kitchen" search={{ station: st.id }}>
              <div className="font-semibold text-[15px]">{st.name}</div>
              <div className="flex items-center gap-4.5 mt-2.5 mx-0 mb-2">
                {[['Waiting', st.waiting, 'var(--color-muted)'], ['Cooking', st.cooking, 'var(--color-amber)'], ['At the pass', st.ready, 'var(--color-green)']].map(([l, n, c]) => (
                  <div key={l as string}><div className="font-bold text-[24px]">{n}</div><div className="text-dim text-[12.5px] flex items-center gap-1.5"><span className="w-2 h-2 rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)]" style={{ background: c as string }} />{l}</div></div>
                ))}
              </div>
              <div className={(st.late > 0) ? "text-[12.5px] text-amber" : "text-dim text-[12.5px]"}>Oldest {st.oldestWaitMin} min · {st.late} late</div>
              <div className={(st.chefsOnDuty === 0 && st.waiting > 0) ? "text-[12.5px] text-amber mt-0.5" : "text-dim text-[12.5px] mt-0.5"}>{st.chefsOnDuty} of {st.chefsTotal} chefs on duty</div>
              <div className="mt-2.5">
                {st.next.map((i: any, n: number) => (
                  <div key={n} className="text-[12.5px] flex items-center gap-2 py-1.25 px-0">
                    <span className="font-bold w-7">{i.table}</span>
                    <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{i.qty} × {i.name}</span>
                    {i.remake && <span className="text-red font-bold">Remake</span>}
                    <span className="text-dim">{i.minutes} min</span>
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
      <div className="flex gap-5.5 border-b border-b-line overflow-x-auto [&_button]:h-11 [&_button]:p-0 [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button]:text-[14.5px] [&_button]:shadow-[inset_0_-2px_0_transparent] [&_button]:whitespace-nowrap [&_button.on]:text-fg [&_button.on]:font-bold [&_button.on]:shadow-[inset_0_-2px_0_var(--color-blue)] [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] tabs">{stations.data?.map((x: any) => <button key={x.id} className={(current === x.id) ? "on" : ""} onClick={() => setSid(x.id)}>{x.name}</button>)}</div>
      {!q.data ? <Loading /> : (
        <>
          <div className="flex items-center gap-2.5 flex-wrap gap-y-3 gap-x-7">{q.data.chefs.map((c: any) => <span key={c.id}><span className="font-semibold">{c.name}</span> <span className={(c.onBreak) ? "text-[12.5px] text-amber" : "text-dim text-[12.5px]"}>{c.onBreak ? 'on break' : `${c.cooking} of ${c.maxParallel} cooking`}</span></span>)}</div>
          <div className="grid grid-cols-[repeat(auto-fit,_minmax(300px,_1fr))] gap-y-8 gap-x-0 [&>*]:py-0 [&>*]:px-7 [&>*:first-child]:pl-0 [&>*:last-child]:pr-0 [&>*+*]:border-l [&>*+*]:border-l-line2 phone:[&>*]:p-0! phone:[&>*]:border-l-0!">
            <Sec title="Waiting" n={q.data.waiting.length}>{q.data.waiting.map((i: any) => <QRow key={i.id} i={i} />)}{!q.data.waiting.length && <div className="border border-dashed border-edge rounded-[16px] p-5.5 text-dim text-center">Queue is clear</div>}</Sec>
            <Sec title="Cooking" n={q.data.cooking.length}>{q.data.cooking.map((i: any) => <QRow key={i.id} i={i} right={<button className="border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]" onClick={() => release.mutate(i.id)}>Release</button>} />)}</Sec>
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
    <div className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0">
      <div className="w-13 flex-none"><div className="font-bold text-[16px]">{i.table}</div><div className="text-[12.5px]" style={{ color: late ? 'var(--color-amber)' : 'var(--color-dim)' }}>{age} min</div></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-2"><span className="font-semibold">{i.qty} × {i.name}</span><span className="text-dim text-[12.5px]">{i.guestNo ? 'G' + i.guestNo : 'Shared'}</span>{i.remake && <span className="text-[12.5px] text-red font-bold">Remake</span>}{i.chef && i.status !== 'waiting' && <span className="text-[12.5px] text-blue font-semibold">{i.chef.split(' ')[0]}</span>}</div>
        {(i.spice || i.note || i.options?.length > 0) && <div className="text-[12.5px] text-taupe">{[i.spice, ...(i.options ?? []), i.note].filter(Boolean).join(' · ')}</div>}
        {i.status === 'ready' && i.waiter && <div className="text-dim text-[12.5px]">{i.waiter} alerted</div>}
      </div>
      {right}
    </div>
  );
}
