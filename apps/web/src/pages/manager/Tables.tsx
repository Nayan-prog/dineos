import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { QRCodeSVG } from 'qrcode.react';
import { ITEM_LABEL, rupees, type ItemStatus } from '@dineos/shared';
import { api, useTick } from '../../api';
import { ago, ErrorText, Icon, Loading, Modal, Sec, STATUS_COLOR, Stepper, TABLE_STATE, Title, useIsMobile, useMe, useToast, StatusDot } from '../../ui';
import { AddTableM, TableAddedM, TableDetailM, TablesM } from './mobile';
import { WaiterTableM, WaiterTablesM } from '../waiter/mobile';

export function Tables() {
  useTick();
  const me = useMe();
  const mobile = useIsMobile();
  const { data } = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables') });
  const areas = useQuery({ queryKey: ['areas'], queryFn: () => api('/floor/areas') });
  const [area, setArea] = useState<number | 'all'>('all');
  const [adding, setAdding] = useState(false);
  if (!data) return <Loading />;
  if (mobile && me.role === 'waiter') return <WaiterTablesM list={data.tables} />;
  if (mobile) return <TablesM data={data} areas={areas.data ?? []} area={area} setArea={setArea} />;
  const s = data.summary;
  const list = data.tables.filter((t: any) => area === 'all' || t.areaId === area);
  const base = me.role === 'waiter' ? '/w/table/$id' : '/tables/$id';
  return (
    <>
      <Title title={me.role === 'waiter' ? 'My tables' : 'Tables'} sub={`${s.occupied} of ${s.tables} tables in use · ${s.guests} guests on ${s.seats} seats`}
        right={me.role !== 'waiter' && <button className="h-10 py-0 px-4.5 rounded-[20px] border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={() => setAdding(true)}><Icon name="plus" size={18} sw={2} />Add table</button>} />
      <div className="grid grid-cols-[repeat(auto-fit,_minmax(170px,_1fr))] gap-5 [&>div+div]:border-l [&>div+div]:border-l-line2 [&>div+div]:pl-5 phone:[&>div+div]:border-l-0 phone:[&>div+div]:pl-0 [&>div]:stagger">
        {[['Tables in use', `${s.occupied} / ${s.tables}`], ['Seats covered', `${s.guests} / ${s.seats}`], ['Free tables', s.tables - s.occupied], ['Waiting for bill', data.tables.filter((t: any) => t.state === 'billing').length]].map(([l, v]) => <div key={l as string}><div className="text-muted text-[13px]">{l}</div><div className="text-[30px] font-bold tracking-[-.5px] mt-0.5">{v}</div></div>)}
      </div>
      {me.role !== 'waiter' && <div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)]"><button className={(area === 'all') ? "on" : ""} onClick={() => setArea('all')}>All areas</button>{areas.data?.map((a: any) => <button key={a.id} className={(area === a.id) ? "on" : ""} onClick={() => setArea(a.id)}>{a.name}</button>)}</div>}
      <div className="grid grid-cols-[repeat(auto-fill,_minmax(118px,_1fr))] gap-2.5 [&>*]:stagger [&>a:hover]:[transform:translateY(-2px)] [&>button:hover]:[transform:translateY(-2px)] [&>a:active]:[transform:scale(.98)] [&>button:active]:[transform:scale(.98)]">
        {list.map((t: any) => {
          const [label, color] = TABLE_STATE[t.state];
          return (
            <Link key={t.id} to={base} params={{ id: String(t.id) }} className="rounded-[14px] bg-card py-2.5 px-3 flex flex-col justify-between min-h-19 border-0 text-left text-fg stagger [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] hover:[transform:translateY(-2px)] active:[transform:scale(.98)]" style={{ boxShadow: `inset 0 0 0 1px ${t.state === 'free' ? 'transparent' : color}` }}>
              <div className="flex items-center gap-2.5"><span className="font-bold text-[18px]">{t.code}</span><span className="flex-1 min-w-0" /><StatusDot color={color} ready={t.state === 'ready'} /></div>
              <div>
                <div className="text-[12.5px]" style={{ color: t.state === 'free' ? 'var(--color-dim)' : color }}>{label}</div>
                <div className="text-dim text-[12.5px]">{t.state === 'free' ? `${t.seats} seats` : `${t.guests}/${t.seats} · ${ago(t.openedAt)}`}{'amount' in t && t.amount ? ` · ${rupees(t.amount)}` : ''}</div>
                {me.role !== 'waiter' && <div className="text-dim text-[11.5px]">{t.waiter?.split(' ')[0] ?? 'No waiter'}</div>}
              </div>
            </Link>
          );
        })}
      </div>
      {list.length === 0 && <div className="border border-dashed border-edge rounded-[16px] p-5.5 text-dim text-center">No tables yet. Add your first table to get its QR code.</div>}
      {adding && <AddTable onClose={() => setAdding(false)} />}
    </>
  );
}

function AddTable({ onClose }: { onClose: () => void }) {
  const areas = useQuery({ queryKey: ['areas'], queryFn: () => api('/floor/areas') });
  const qc = useQueryClient(); const nav = useNavigate();
  const [f, setF] = useState({ code: '', seats: 4, shape: 'square', areaId: 0, newArea: '' });
  const m = useMutation({
    mutationFn: async () => {
      let areaId = f.areaId || areas.data?.[0]?.id;
      if (f.newArea) areaId = (await api('/floor/areas', { body: { name: f.newArea } })).id;
      return api('/floor/tables', { body: { code: f.code.trim().toUpperCase(), seats: f.seats, shape: f.shape, areaId } });
    },
    onSuccess: (t) => { qc.invalidateQueries(); onClose(); nav({ to: '/tables/$id', params: { id: String(t.id) }, search: { added: 1 } as any }); },
  });
  return (
    <Modal title="Add table" onClose={onClose}>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">Table name<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" autoFocus placeholder="T25" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">Area
        <select className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" value={f.areaId || areas.data?.[0]?.id || 0} onChange={(e) => setF({ ...f, areaId: Number(e.target.value), newArea: '' })}>
          {areas.data?.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}<option value={-1}>New area…</option>
        </select>
      </label>
      {f.areaId === -1 && <label className="flex flex-col gap-1.5 text-[13px] text-muted">New area name<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" value={f.newArea} onChange={(e) => setF({ ...f, newArea: e.target.value })} /></label>}
      <div className="flex items-center gap-2.5 justify-between"><span className="text-muted">Seats</span><Stepper value={f.seats} min={1} max={30} onChange={(v) => setF({ ...f, seats: v })} /></div>
      <div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)]">{['square', 'round', 'long'].map((s) => <button key={s} type="button" className={(f.shape === s) ? "on" : ""} onClick={() => setF({ ...f, shape: s })}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
      <ErrorText error={m.error} />
      <button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" disabled={!f.code || m.isPending} onClick={() => m.mutate()}>Add table and create QR</button>
    </Modal>
  );
}

/** Table dashboard: QR, guests, every dish by guest with status, bill */
export function TableDetail() {
  useTick();
  const me = useMe();
  const mobile = useIsMobile();
  const { id } = useParams({ strict: false }) as { id: string };
  const qc = useQueryClient(); const toast = useToast(); const nav = useNavigate();
  const { data, error } = useQuery({ queryKey: ['table', id], queryFn: () => api(`/floor/tables/${id}`) });
  const [guests, setGuests] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const act = useMutation({ mutationFn: (fn: () => Promise<any>) => fn(), onSuccess: () => qc.invalidateQueries(), onError: (e) => toast((e as Error).message) });
  if (error) return <ErrorText error={error} />;
  if (!data) return <Loading />;
  const { table, session, items, totals } = data;
  const newQr = () => confirm('Old printed QR codes for this table will stop working. Continue?') && act.mutate(() => api(`/floor/tables/${table.id}`, { method: 'PATCH', body: { newQr: true } }));
  if (mobile && me.role === 'waiter') return <WaiterTableM data={data} />;
  if (mobile) return <><TableDetailM data={data} onBill={() => setPaying(true)} onNewQr={newQr} />{paying && session && <PayBill sessionId={session.id} code={table.code} onClose={() => setPaying(false)} onPaid={() => { setPaying(false); toast(`${table.code} paid · table is free`); }} />}</>;
  const g = guests ?? session?.guestCount ?? 2;
  const groups = new Map<number, any[]>();
  for (const it of items) groups.set(it.guestNo, [...(groups.get(it.guestNo) ?? []), it]);
  const canBill = ['owner', 'manager', 'waiter'].includes(me.role);
  const takeOrder = me.role === 'waiter' ? '/w/take-order' : '/w/take-order';
  return (
    <>
      <Title title={`Table ${table.code}`} sub={`${table.area} · ${table.seats} seats · ${table.waiter ?? 'no waiter assigned'}${session ? ' · open ' + ago(session.openedAt) : ''}`}
        right={<div className="flex items-center gap-2.5">{session && me.role !== 'admin' && <Link to={takeOrder} search={{ table: table.id } as any} className="h-10 py-0 px-4.5 rounded-[20px] border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11"><Icon name="plus" size={18} sw={2} />Take order</Link>}{session && canBill && <button className="h-10 py-0 px-4.5 rounded-[20px] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] bg-transparent border border-edge text-fg active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={() => setPaying(true)}>Bill</button>}</div>} />
      <div className="grid gap-y-8 gap-x-0 [&>*]:py-0 [&>*]:px-7 [&>*:first-child]:pl-0 [&>*:last-child]:pr-0 [&>*+*]:border-l [&>*+*]:border-l-line2 phone:[&>*]:p-0! phone:[&>*]:border-l-0! grid-cols-[minmax(0,_1.6fr)_minmax(260px,_1fr)]">
        <div className="flex flex-col gap-6">
          {!session ? (
            <Sec title="Seat guests">
              {me.role !== 'admin' && <Link to={takeOrder} search={{ table: table.id } as any} className="h-10 py-0 px-4.5 rounded-[20px] border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11"><Icon name="plus" size={18} sw={2} />Take order</Link>}
              <div className="text-dim text-[12.5px] mt-2.5">Or the guests scan the QR and order themselves.</div>
            </Sec>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <span className="text-muted">Guests</span><Stepper value={g} min={1} max={30} onChange={(v) => { setGuests(v); act.mutate(() => api('/floor/sessions', { body: { tableId: table.id, guestCount: v } })); }} />
                {session.customer && <span className="text-muted">· {session.customer.name || 'Guest'} {session.customer.phone} · visit {session.customer.visits}</span>}
                {session.status === 'billing' && <span className="text-red font-semibold">Bill asked</span>}
              </div>
              {items.length === 0 && <div className="border border-dashed border-edge rounded-[16px] p-5.5 text-dim text-center">Nothing ordered yet</div>}
              {[...groups.entries()].sort((a, b) => a[0] - b[0]).map(([gn, list]) => (
                <Sec key={gn} title={gn ? `Guest ${gn}` : 'Shared'}>
                  {list.map((it: any) => (
                    <div key={it.id} className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0">
                      <span className={(it.veg) ? "w-3 h-3 border-[1.5px] border-green rounded-[2px] inline-flex items-center justify-center flex-none after:content-[''] after:w-1.25 after:h-1.25 after:rounded-[3px] after:bg-green" : "w-3 h-3 border-[1.5px] rounded-[2px] inline-flex items-center justify-center flex-none after:content-[''] after:w-1.25 after:h-1.25 after:rounded-[3px] border-red after:bg-red"} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold" style={{ textDecoration: it.status === 'cancelled' ? 'line-through' : undefined }}>{it.qty} × {it.name}</div>
                        {(it.spice || it.note || it.options?.length > 0) && <div className="text-[12.5px] text-taupe">{[it.spice, ...(it.options ?? []), it.note].filter(Boolean).join(' · ')}</div>}
                      </div>
                      <span className="text-[12.5px] flex items-center gap-1.5" style={{ color: STATUS_COLOR[it.status] }}><StatusDot color={STATUS_COLOR[it.status]} ready={it.status === 'ready'} />{ITEM_LABEL[it.status as ItemStatus]}{it.chef && it.status === 'cooking' ? ' · ' + it.chef.split(' ')[0] : ''}</span>
                      {'unitPrice' in it && <span className="w-17.5 text-right">{rupees(it.unitPrice * it.qty)}</span>}
                      <span className="w-17.5 text-right">
                        {it.status === 'ready' && <button className="border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]" onClick={() => act.mutate(() => api(`/floor/items/${it.id}/served`, { body: {} }))}>Served</button>}
                        {(it.status === 'waiting' || (it.status === 'cooking' && me.role !== 'waiter')) && <button className="border-0 bg-transparent p-0 font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] text-red in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]" onClick={() => confirm(`Cancel ${it.name}?`) && act.mutate(() => api(`/floor/items/${it.id}/cancel`, { body: {} }))}>Cancel</button>}
                      </span>
                    </div>
                  ))}
                </Sec>
              ))}
              {totals && 'total' in totals && <div className="flex items-center justify-end gap-6"><span className="text-muted">Subtotal {rupees(totals.subtotal)}</span><span className="text-muted">Tax {rupees(totals.tax)}</span><span className="font-bold text-[18px]">{rupees(totals.total)}</span></div>}
            </>
          )}
        </div>
        <Sec title="Table QR">
          <div className="bg-[#fff] p-4! rounded-[16px] w-fit"><QRCodeSVG value={table.qrUrl} size={180} /></div>
          <div className="text-dim text-[12.5px] mt-2.5 [word-break:break-all]">{table.qrUrl}</div>
          <div className="flex items-center gap-2.5 mt-3">
            <a className="border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]" href={table.qrUrl} target="_blank" rel="noreferrer">Open guest view</a>
            <button className="border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]" onClick={() => window.print()}>Print</button>
            {me.role !== 'waiter' && <button className="border-0 bg-transparent p-0 font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] text-amber in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]" onClick={() => confirm('Old printed QR codes for this table will stop working. Continue?') && act.mutate(() => api(`/floor/tables/${table.id}`, { method: 'PATCH', body: { newQr: true } }))}>New QR</button>}
          </div>
        </Sec>
      </div>
      {paying && session && <PayBill sessionId={session.id} code={table.code} onClose={() => setPaying(false)} onPaid={() => { setPaying(false); toast(`${table.code} paid · table is free`); if (me.role === 'waiter') nav({ to: '/w' }); }} />}
    </>
  );
}

export function PayBill({ sessionId, code, onClose, onPaid }: { sessionId: number; code: string; onClose: () => void; onPaid: () => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['bill', sessionId], queryFn: () => api(`/floor/sessions/${sessionId}/bill`) });
  const [method, setMethod] = useState('upi'); const [discount, setDiscount] = useState(0);
  const pay = useMutation({ mutationFn: () => api(`/floor/sessions/${sessionId}/pay`, { body: { method, discount: discount * 100 } }), onSuccess: () => { qc.invalidateQueries(); onPaid(); } });
  return (
    <Modal title={`Bill · ${code}`} onClose={onClose}>
      {!data ? <Loading /> : <>
        <div>{data.lines.map((l: any) => <div key={l.name + l.unitPrice} className="flex items-center gap-3.5 border-b border-b-line stagger last:border-b-0 py-2.5 px-0"><span className="flex-1 min-w-0">{l.qty} × {l.name}</span><span>{rupees(l.qty * l.unitPrice)}</span></div>)}</div>
        <div className="flex items-center gap-2.5"><span className="text-muted flex-1 min-w-0">Subtotal</span>{rupees(data.subtotal)}</div>
        <div className="flex items-center gap-2.5"><span className="text-muted flex-1 min-w-0">Tax {data.taxPercent}%</span>{rupees(data.tax)}</div>
        {me.role !== 'waiter' && <div className="flex items-center gap-2.5"><span className="text-muted flex-1 min-w-0">Discount (₹)</span><input className="py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue w-27.5 h-9.5" type="number" min={0} value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} /></div>}
        <div className="flex items-center gap-2.5"><span className="font-bold flex-1 min-w-0 text-[18px]">Total</span><span className="font-bold text-[22px]">{rupees(Math.max(0, data.total - discount * 100))}</span></div>
        <div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)]">{['upi', 'cash', 'card'].map((m) => <button key={m} className={(method === m) ? "on" : ""} onClick={() => setMethod(m)}>{m.toUpperCase()}</button>)}</div>
        <ErrorText error={pay.error} />
        <button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" disabled={pay.isPending} onClick={() => pay.mutate()}>Payment received · close table</button>
      </>}
    </Modal>
  );
}

/** Phone-only pages: Add table (MW-AddTable) and Table added (MW-TableAdded). The desktop uses the Add table dialog instead. */
export function AddTablePage() { return <AddTableM />; }
export function TableAddedPage() { const { id } = useParams({ strict: false }) as { id: string }; return <TableAddedM id={id} />; }
