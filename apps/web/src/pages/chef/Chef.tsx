import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, useTick } from '../../api';
import { ago, Loading, Sec, Title, useMe, useToast } from '../../ui';
import { QRow } from '../manager/Service';

/** Station queue: Waiting → Cooking → At the pass. Start takes a dish; nobody else can take it. */
export function StationQueue() {
  useTick(10000);
  const me = useMe();
  const qc = useQueryClient(); const toast = useToast();
  const { data, error } = useQuery({ queryKey: ['queue'], queryFn: () => api('/kitchen/queue'), refetchInterval: 15000 });
  const act = useMutation({ mutationFn: (fn: () => Promise<any>) => fn(), onSuccess: () => qc.invalidateQueries(), onError: (e) => { toast((e as Error).message); qc.invalidateQueries(); } });
  if (error) return <div className="err">{(error as Error).message}</div>;
  if (!data) return <Loading />;
  const mine = data.cooking.filter((i: any) => i.claimedBy === me.id).length;
  const limit = data.me.maxParallel;
  const onBreak = data.chefs.find((c: any) => c.id === me.id)?.onBreak;
  const full = mine >= limit;
  // Cook together: same dish waiting for 2+ tables
  const groups = new Map<string, any[]>();
  for (const i of data.waiting) groups.set(i.name, [...(groups.get(i.name) ?? []), i]);
  const batches = [...groups.entries()].filter(([, l]) => l.length > 1);
  const claim = (ids: number[]) => act.mutate(() => api('/kitchen/claim', { body: { ids } }));
  return (
    <>
      <Title title={`${data.station.name} station`} sub={`Shared queue for ${data.chefs.length} chefs · tap Start to take a dish · urgent and oldest first`}
        right={<button className="btn ghost sm" style={{ color: onBreak ? 'var(--amber)' : 'var(--green)' }} onClick={() => act.mutate(() => api(`/team/staff/${me.id}`, { method: 'PATCH', body: { onBreak: !onBreak } }))}><span className="dot" style={{ background: onBreak ? 'var(--amber)' : 'var(--green)' }} />{onBreak ? 'On break · tap to resume' : 'On duty'}</button>} />
      <div className="row-flex wrap" style={{ gap: '16px 0' }}>
        {data.chefs.map((c: any, i: number) => (
          <div key={c.id} style={{ minWidth: 200, paddingLeft: i ? 28 : 0, paddingRight: 28, borderLeft: i ? '1px solid var(--line2)' : 0 }}>
            <div className="row-flex" style={{ gap: 8 }}><span className="b">{c.name}</span>{c.id === me.id && <span className="blue small bb">You</span>}</div>
            <div className="row-flex" style={{ marginTop: 6 }}>
              <span className="row-flex" style={{ gap: 4 }}>{Array.from({ length: c.maxParallel }, (_, k) => <span key={k} style={{ width: 18, height: 5, borderRadius: 3, background: k < c.cooking ? 'var(--amber)' : 'var(--border)' }} />)}</span>
              <span className={`small ${c.onBreak ? 'amber' : 'muted'}`}>{c.onBreak ? 'On break' : `${c.cooking} of ${c.maxParallel} cooking`}</span>
            </div>
          </div>
        ))}
      </div>
      {full && <div className="amber">You are cooking {limit} dishes. Finish one to take the next.</div>}
      {onBreak && <div className="amber">You are on break. Resume duty to take dishes.</div>}
      <div className="cols" style={{ gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, .85fr)' }}>
        <Sec title="Waiting" n={data.waiting.length}>
          {batches.map(([name, l]) => (
            <div key={name} className="row" style={{ padding: '12px 0' }}>
              <div className="grow"><div className="blue small bb">Cook together</div><div className="b">{l.reduce((a, i) => a + i.qty, 0)} × {name} <span className="dim" style={{ fontWeight: 500 }}>· {l.map((i) => i.table).join(', ')}</span></div></div>
              <button className="btn ghost sm" disabled={onBreak || mine + l.length > limit} onClick={() => claim(l.map((i) => i.id))}>Start all {l.length}</button>
            </div>
          ))}
          {data.waiting.length === 0 && <div className="empty">Queue is clear</div>}
          {data.waiting.map((i: any) => <QRow key={i.id} i={i} right={full || onBreak ? <span className="dim small">{onBreak ? 'On break' : 'At limit'}</span> : <button className="btn light sm" onClick={() => claim([i.id])}>Start</button>} />)}
        </Sec>
        <Sec title="Cooking" n={data.cooking.length}>
          {data.cooking.map((i: any) => <QRow key={i.id} i={{ ...i, chef: i.claimedBy === me.id ? 'You' : i.chef }} right={i.claimedBy === me.id ? <button className="btn sm" onClick={() => act.mutate(() => api(`/kitchen/items/${i.id}/ready`, { body: {} }))}>Ready</button> : undefined} />)}
        </Sec>
        <Sec title="At the pass" n={data.ready.length}>
          {data.ready.map((i: any) => <QRow key={i.id} i={i} />)}
        </Sec>
      </div>
    </>
  );
}

export function ChefDone() {
  const { data } = useQuery({ queryKey: ['done'], queryFn: () => api('/kitchen/done') });
  if (!data) return <Loading />;
  const avg = data.length ? Math.round(data.reduce((a: number, d: any) => a + (new Date(d.readyAt).getTime() - new Date(d.claimedAt).getTime()) / 60000, 0) / data.length) : 0;
  return (
    <>
      <Title title="Done today" sub={`${data.length} dishes · ${avg} min average cook time`} />
      <div>{data.map((d: any) => <div key={d.id} className="row"><span className="bb" style={{ width: 48 }}>{d.table}</span><span className="grow b">{d.qty} × {d.name}</span><span className="muted small">{Math.round((new Date(d.readyAt).getTime() - new Date(d.claimedAt).getTime()) / 60000)} min</span><span className="dim small" style={{ width: 90, textAlign: 'right' }}>{ago(d.readyAt)} ago</span></div>)}</div>
      {data.length === 0 && <div className="empty">Nothing finished yet</div>}
    </>
  );
}

export function ChefStock() {
  const me = useMe();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['menu'], queryFn: () => api('/floor/menu') });
  const m = useMutation({ mutationFn: ([id, available]: [number, boolean]) => api(`/kitchen/dishes/${id}/stock`, { method: 'PATCH', body: { available } }), onSuccess: () => qc.invalidateQueries() });
  if (!data) return <Loading />;
  const dishes = data.flatMap((c: any) => c.dishes).filter((d: any) => d.stationId === me.stationId);
  return (
    <>
      <Title title="Stock" sub="Out-of-stock dishes disappear from the guest menu and the waiter's order screen" />
      <div>{dishes.map((d: any) => <div key={d.id} className="row"><span className={`veg ${d.veg ? '' : 'non'}`} /><span className="grow b">{d.name}</span><button className={`btn sm ${d.available ? 'ghost' : 'danger'}`} onClick={() => m.mutate([d.id, !d.available])}>{d.available ? 'In stock' : 'Out of stock'}</button></div>)}</div>
    </>
  );
}
