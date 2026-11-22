import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, useTick } from '../../api';
import { ago, Loading, Sec, Title, useIsMobile, useMe, useToast } from '../../ui';
import { ChefDoneM, ChefHomeM, ChefStockM } from './mobile';
import { QRow } from '../manager/Service';

/** Station queue: Waiting → Cooking → At the pass. Start takes a dish; nobody else can take it. Phones get the app's chef home. */
export function StationQueue() { return useIsMobile() ? <ChefHomeM /> : <StationQueueDesktop />; }

function StationQueueDesktop() {
  useTick(10000);
  const me = useMe();
  const qc = useQueryClient(); const toast = useToast();
  const { data, error } = useQuery({ queryKey: ['queue'], queryFn: () => api('/kitchen/queue'), refetchInterval: 15000 });
  const act = useMutation({ mutationFn: (fn: () => Promise<any>) => fn(), onSuccess: () => qc.invalidateQueries(), onError: (e) => { toast((e as Error).message); qc.invalidateQueries(); } });
  if (error) return <div className="text-red text-[13.5px]">{(error as Error).message}</div>;
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
        right={<button className="font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] h-9 py-0 px-3.5 rounded-[18px] text-[13.5px] bg-transparent border border-edge text-fg active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" style={{ color: onBreak ? 'var(--color-amber)' : 'var(--color-green)' }} onClick={() => act.mutate(() => api(`/team/staff/${me.id}`, { method: 'PATCH', body: { onBreak: !onBreak } }))}><span className="w-2 h-2 rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)]" style={{ background: onBreak ? 'var(--color-amber)' : 'var(--color-green)' }} />{onBreak ? 'On break · tap to resume' : 'On duty'}</button>} />
      <div className="flex items-center gap-2.5 flex-wrap gap-y-4 gap-x-0">
        {data.chefs.map((c: any, i: number) => (
          <div key={c.id} className="min-w-50 pr-7" style={{ paddingLeft: i ? 28 : 0, borderLeft: i ? '1px solid var(--color-line2)' : 0 }}>
            <div className="flex items-center gap-2"><span className="font-semibold">{c.name}</span>{c.id === me.id && <span className="text-[12.5px] text-blue font-bold">You</span>}</div>
            <div className="flex items-center gap-2.5 mt-1.5">
              <span className="flex items-center gap-1">{Array.from({ length: c.maxParallel }, (_, k) => <span key={k} className="w-4.5 h-1.25 rounded-[3px]" style={{ background: k < c.cooking ? 'var(--color-amber)' : 'var(--color-edge)' }} />)}</span>
              <span className={(c.onBreak) ? "text-[12.5px] text-amber" : "text-muted text-[12.5px]"}>{c.onBreak ? 'On break' : `${c.cooking} of ${c.maxParallel} cooking`}</span>
            </div>
          </div>
        ))}
      </div>
      {full && <div className="text-amber">You are cooking {limit} dishes. Finish one to take the next.</div>}
      {onBreak && <div className="text-amber">You are on break. Resume duty to take dishes.</div>}
      <div className="grid gap-y-8 gap-x-0 [&>*]:py-0 [&>*]:px-7 [&>*:first-child]:pl-0 [&>*:last-child]:pr-0 [&>*+*]:border-l [&>*+*]:border-l-line2 phone:[&>*]:p-0! phone:[&>*]:border-l-0! grid-cols-[minmax(0,_1.25fr)_minmax(0,_1fr)_minmax(0,_.85fr)]">
        <Sec title="Waiting" n={data.waiting.length}>
          {batches.map(([name, l]) => (
            <div key={name} className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0 py-3! px-0!">
              <div className="flex-1 min-w-0"><div className="text-[12.5px] text-blue font-bold">Cook together</div><div className="font-semibold">{l.reduce((a, i) => a + i.qty, 0)} × {name} <span className="text-dim font-medium">· {l.map((i) => i.table).join(', ')}</span></div></div>
              <button className="font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] h-9 py-0 px-3.5 rounded-[18px] text-[13.5px] bg-transparent border border-edge text-fg active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" disabled={onBreak || mine + l.length > limit} onClick={() => claim(l.map((i) => i.id))}>Start all {l.length}</button>
            </div>
          ))}
          {data.waiting.length === 0 && <div className="border border-dashed border-edge rounded-[16px] p-5.5 text-dim text-center">Queue is clear</div>}
          {data.waiting.map((i: any) => <QRow key={i.id} i={i} right={full || onBreak ? <span className="text-dim text-[12.5px]">{onBreak ? 'On break' : 'At limit'}</span> : <button className="border-0 font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] h-9 py-0 px-3.5 rounded-[18px] text-[13.5px] bg-fg text-bg active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={() => claim([i.id])}>Start</button>} />)}
        </Sec>
        <Sec title="Cooking" n={data.cooking.length}>
          {data.cooking.map((i: any) => <QRow key={i.id} i={{ ...i, chef: i.claimedBy === me.id ? 'You' : i.chef }} right={i.claimedBy === me.id ? <button className="border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] h-9 py-0 px-3.5 rounded-[18px] text-[13.5px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={() => act.mutate(() => api(`/kitchen/items/${i.id}/ready`, { body: {} }))}>Ready</button> : undefined} />)}
        </Sec>
        <Sec title="At the pass" n={data.ready.length}>
          {data.ready.map((i: any) => <QRow key={i.id} i={i} />)}
        </Sec>
      </div>
    </>
  );
}

export function ChefDone() { return useIsMobile() ? <ChefDoneM /> : <ChefDoneDesktop />; }

function ChefDoneDesktop() {
  const { data } = useQuery({ queryKey: ['done'], queryFn: () => api('/kitchen/done') });
  if (!data) return <Loading />;
  const avg = data.length ? Math.round(data.reduce((a: number, d: any) => a + (new Date(d.readyAt).getTime() - new Date(d.claimedAt).getTime()) / 60000, 0) / data.length) : 0;
  return (
    <>
      <Title title="Done today" sub={`${data.length} dishes · ${avg} min average cook time`} />
      <div>{data.map((d: any) => <div key={d.id} className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0"><span className="font-bold w-12">{d.table}</span><span className="font-semibold flex-1 min-w-0">{d.qty} × {d.name}</span><span className="text-muted text-[12.5px]">{Math.round((new Date(d.readyAt).getTime() - new Date(d.claimedAt).getTime()) / 60000)} min</span><span className="text-dim text-[12.5px] w-22.5 text-right">{ago(d.readyAt)} ago</span></div>)}</div>
      {data.length === 0 && <div className="border border-dashed border-edge rounded-[16px] p-5.5 text-dim text-center">Nothing finished yet</div>}
    </>
  );
}

export function ChefStock() { return useIsMobile() ? <ChefStockM /> : <ChefStockDesktop />; }

function ChefStockDesktop() {
  const me = useMe();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['menu'], queryFn: () => api('/floor/menu') });
  const m = useMutation({ mutationFn: ([id, available]: [number, boolean]) => api(`/kitchen/dishes/${id}/stock`, { method: 'PATCH', body: { available } }), onSuccess: () => qc.invalidateQueries() });
  if (!data) return <Loading />;
  const dishes = data.flatMap((c: any) => c.dishes).filter((d: any) => d.stationId === me.stationId);
  return (
    <>
      <Title title="Stock" sub="Out-of-stock dishes disappear from the guest menu and the waiter's order screen" />
      <div>{dishes.map((d: any) => <div key={d.id} className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0"><span className={(d.veg) ? "w-3 h-3 border-[1.5px] border-green rounded-[2px] inline-flex items-center justify-center flex-none after:content-[''] after:w-1.25 after:h-1.25 after:rounded-[3px] after:bg-green" : "w-3 h-3 border-[1.5px] rounded-[2px] inline-flex items-center justify-center flex-none after:content-[''] after:w-1.25 after:h-1.25 after:rounded-[3px] border-red after:bg-red"} /><span className="font-semibold flex-1 min-w-0">{d.name}</span><button className={(d.available) ? "font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] h-9 py-0 px-3.5 rounded-[18px] text-[13.5px] bg-transparent border border-edge text-fg active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" : "font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] h-9 py-0 px-3.5 rounded-[18px] text-[13.5px] bg-transparent border border-edge text-red active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11"} onClick={() => m.mutate([d.id, !d.available])}>{d.available ? 'In stock' : 'Out of stock'}</button></div>)}</div>
    </>
  );
}
