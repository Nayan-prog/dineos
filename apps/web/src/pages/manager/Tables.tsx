import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { QRCodeSVG } from 'qrcode.react';
import { ITEM_LABEL, rupees, type ItemStatus } from '@dineos/shared';
import { api, useTick } from '../../api';
import { ago, ErrorText, Icon, Loading, Modal, Sec, STATUS_COLOR, Stepper, TABLE_STATE, Title, useMe, useToast, StatusDot } from '../../ui';

export function Tables() {
  useTick();
  const me = useMe();
  const { data } = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables') });
  const areas = useQuery({ queryKey: ['areas'], queryFn: () => api('/floor/areas') });
  const [area, setArea] = useState<number | 'all'>('all');
  const [adding, setAdding] = useState(false);
  if (!data) return <Loading />;
  const s = data.summary;
  const list = data.tables.filter((t: any) => area === 'all' || t.areaId === area);
  const base = me.role === 'waiter' ? '/w/table/$id' : '/tables/$id';
  return (
    <>
      <Title title={me.role === 'waiter' ? 'My tables' : 'Tables'} sub={`${s.occupied} of ${s.tables} tables in use · ${s.guests} guests on ${s.seats} seats`}
        right={me.role !== 'waiter' && <button className="btn" onClick={() => setAdding(true)}><Icon name="plus" size={18} sw={2} />Add table</button>} />
      <div className="kpis">
        {[['Tables in use', `${s.occupied} / ${s.tables}`], ['Seats covered', `${s.guests} / ${s.seats}`], ['Free tables', s.tables - s.occupied], ['Waiting for bill', data.tables.filter((t: any) => t.state === 'billing').length]].map(([l, v]) => <div key={l as string}><div className="kpi-l">{l}</div><div className="kpi-v">{v}</div></div>)}
      </div>
      {me.role !== 'waiter' && <div className="pills"><button className={area === 'all' ? 'on' : ''} onClick={() => setArea('all')}>All areas</button>{areas.data?.map((a: any) => <button key={a.id} className={area === a.id ? 'on' : ''} onClick={() => setArea(a.id)}>{a.name}</button>)}</div>}
      <div className="grid-tables">
        {list.map((t: any) => {
          const [label, color] = TABLE_STATE[t.state];
          return (
            <Link key={t.id} to={base} params={{ id: String(t.id) }} className="tile" style={{ boxShadow: `inset 0 0 0 1px ${t.state === 'free' ? 'transparent' : color}` }}>
              <div className="row-flex"><span className="bb" style={{ fontSize: 18 }}>{t.code}</span><span className="grow" /><StatusDot color={color} ready={t.state === 'ready'} /></div>
              <div>
                <div className="small" style={{ color: t.state === 'free' ? 'var(--dim)' : color }}>{label}</div>
                <div className="dim small">{t.state === 'free' ? `${t.seats} seats` : `${t.guests}/${t.seats} · ${ago(t.openedAt)}`}{'amount' in t && t.amount ? ` · ${rupees(t.amount)}` : ''}</div>
                {me.role !== 'waiter' && <div className="dim" style={{ fontSize: 11.5 }}>{t.waiter?.split(' ')[0] ?? 'No waiter'}</div>}
              </div>
            </Link>
          );
        })}
      </div>
      {list.length === 0 && <div className="empty">No tables yet. Add your first table to get its QR code.</div>}
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
      <label className="field">Table name<input className="input" autoFocus placeholder="T25" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
      <label className="field">Area
        <select className="select" value={f.areaId || areas.data?.[0]?.id || 0} onChange={(e) => setF({ ...f, areaId: Number(e.target.value), newArea: '' })}>
          {areas.data?.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}<option value={-1}>New area…</option>
        </select>
      </label>
      {f.areaId === -1 && <label className="field">New area name<input className="input" value={f.newArea} onChange={(e) => setF({ ...f, newArea: e.target.value })} /></label>}
      <div className="row-flex" style={{ justifyContent: 'space-between' }}><span className="muted">Seats</span><Stepper value={f.seats} min={1} max={30} onChange={(v) => setF({ ...f, seats: v })} /></div>
      <div className="pills">{['square', 'round', 'long'].map((s) => <button key={s} type="button" className={f.shape === s ? 'on' : ''} onClick={() => setF({ ...f, shape: s })}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
      <ErrorText error={m.error} />
      <button className="btn block" disabled={!f.code || m.isPending} onClick={() => m.mutate()}>Add table and create QR</button>
    </Modal>
  );
}

/** Table dashboard: QR, guests, every dish by guest with status, bill */
export function TableDetail() {
  useTick();
  const me = useMe();
  const { id } = useParams({ strict: false }) as { id: string };
  const qc = useQueryClient(); const toast = useToast(); const nav = useNavigate();
  const { data, error } = useQuery({ queryKey: ['table', id], queryFn: () => api(`/floor/tables/${id}`) });
  const [guests, setGuests] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const act = useMutation({ mutationFn: (fn: () => Promise<any>) => fn(), onSuccess: () => qc.invalidateQueries(), onError: (e) => toast((e as Error).message) });
  if (error) return <ErrorText error={error} />;
  if (!data) return <Loading />;
  const { table, session, items, totals } = data;
  const g = guests ?? session?.guestCount ?? 2;
  const groups = new Map<number, any[]>();
  for (const it of items) groups.set(it.guestNo, [...(groups.get(it.guestNo) ?? []), it]);
  const canBill = ['owner', 'manager', 'waiter'].includes(me.role);
  const takeOrder = me.role === 'waiter' ? '/w/take-order' : '/w/take-order';
  return (
    <>
      <Title title={`Table ${table.code}`} sub={`${table.area} · ${table.seats} seats · ${table.waiter ?? 'no waiter assigned'}${session ? ' · open ' + ago(session.openedAt) : ''}`}
        right={<div className="row-flex">{session && me.role !== 'admin' && <Link to={takeOrder} search={{ table: table.id } as any} className="btn"><Icon name="plus" size={18} sw={2} />Take order</Link>}{session && canBill && <button className="btn ghost" onClick={() => setPaying(true)}>Bill</button>}</div>} />
      <div className="cols" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(260px, 1fr)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {!session ? (
            <Sec title="Seat guests">
              {me.role !== 'admin' && <Link to={takeOrder} search={{ table: table.id } as any} className="btn"><Icon name="plus" size={18} sw={2} />Take order</Link>}
              <div className="dim small" style={{ marginTop: 10 }}>Or the guests scan the QR and order themselves.</div>
            </Sec>
          ) : (
            <>
              <div className="row-flex" style={{ gap: 16 }}>
                <span className="muted">Guests</span><Stepper value={g} min={1} max={30} onChange={(v) => { setGuests(v); act.mutate(() => api('/floor/sessions', { body: { tableId: table.id, guestCount: v } })); }} />
                {session.customer && <span className="muted">· {session.customer.name || 'Guest'} {session.customer.phone} · visit {session.customer.visits}</span>}
                {session.status === 'billing' && <span className="red b">Bill asked</span>}
              </div>
              {items.length === 0 && <div className="empty">Nothing ordered yet</div>}
              {[...groups.entries()].sort((a, b) => a[0] - b[0]).map(([gn, list]) => (
                <Sec key={gn} title={gn ? `Guest ${gn}` : 'Shared'}>
                  {list.map((it: any) => (
                    <div key={it.id} className="row">
                      <span className={`veg ${it.veg ? '' : 'non'}`} />
                      <div className="grow">
                        <div className="b" style={{ textDecoration: it.status === 'cancelled' ? 'line-through' : undefined }}>{it.qty} × {it.name}</div>
                        {(it.spice || it.note || it.options?.length > 0) && <div className="taupe small">{[it.spice, ...(it.options ?? []), it.note].filter(Boolean).join(' · ')}</div>}
                      </div>
                      <span className="small row-flex" style={{ gap: 6, color: STATUS_COLOR[it.status] }}><StatusDot color={STATUS_COLOR[it.status]} ready={it.status === 'ready'} />{ITEM_LABEL[it.status as ItemStatus]}{it.chef && it.status === 'cooking' ? ' · ' + it.chef.split(' ')[0] : ''}</span>
                      {'unitPrice' in it && <span style={{ width: 70, textAlign: 'right' }}>{rupees(it.unitPrice * it.qty)}</span>}
                      <span style={{ width: 70, textAlign: 'right' }}>
                        {it.status === 'ready' && <button className="link" onClick={() => act.mutate(() => api(`/floor/items/${it.id}/served`, { body: {} }))}>Served</button>}
                        {(it.status === 'waiting' || (it.status === 'cooking' && me.role !== 'waiter')) && <button className="link red" onClick={() => confirm(`Cancel ${it.name}?`) && act.mutate(() => api(`/floor/items/${it.id}/cancel`, { body: {} }))}>Cancel</button>}
                      </span>
                    </div>
                  ))}
                </Sec>
              ))}
              {totals && 'total' in totals && <div className="row-flex" style={{ justifyContent: 'flex-end', gap: 24 }}><span className="muted">Subtotal {rupees(totals.subtotal)}</span><span className="muted">Tax {rupees(totals.tax)}</span><span className="bb" style={{ fontSize: 18 }}>{rupees(totals.total)}</span></div>}
            </>
          )}
        </div>
        <Sec title="Table QR">
          <div style={{ background: '#fff', padding: 16, borderRadius: 16, width: 'fit-content' }}><QRCodeSVG value={table.qrUrl} size={180} /></div>
          <div className="dim small" style={{ marginTop: 10, wordBreak: 'break-all' }}>{table.qrUrl}</div>
          <div className="row-flex" style={{ marginTop: 12 }}>
            <a className="link" href={table.qrUrl} target="_blank" rel="noreferrer">Open guest view</a>
            <button className="link" onClick={() => window.print()}>Print</button>
            {me.role !== 'waiter' && <button className="link amber" onClick={() => confirm('Old printed QR codes for this table will stop working. Continue?') && act.mutate(() => api(`/floor/tables/${table.id}`, { method: 'PATCH', body: { newQr: true } }))}>New QR</button>}
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
        <div>{data.lines.map((l: any) => <div key={l.name + l.unitPrice} className="row" style={{ padding: '10px 0' }}><span className="grow">{l.qty} × {l.name}</span><span>{rupees(l.qty * l.unitPrice)}</span></div>)}</div>
        <div className="row-flex"><span className="muted grow">Subtotal</span>{rupees(data.subtotal)}</div>
        <div className="row-flex"><span className="muted grow">Tax {data.taxPercent}%</span>{rupees(data.tax)}</div>
        {me.role !== 'waiter' && <div className="row-flex"><span className="muted grow">Discount (₹)</span><input className="input" style={{ width: 110, height: 38 }} type="number" min={0} value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} /></div>}
        <div className="row-flex"><span className="bb grow" style={{ fontSize: 18 }}>Total</span><span className="bb" style={{ fontSize: 22 }}>{rupees(Math.max(0, data.total - discount * 100))}</span></div>
        <div className="pills">{['upi', 'cash', 'card'].map((m) => <button key={m} className={method === m ? 'on' : ''} onClick={() => setMethod(m)}>{m.toUpperCase()}</button>)}</div>
        <ErrorText error={pay.error} />
        <button className="btn block" disabled={pay.isPending} onClick={() => pay.mutate()}>Payment received · close table</button>
      </>}
    </Modal>
  );
}
