import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { rupees } from '@dineos/shared';
import { api } from '../../api';
import { ago, ErrorText, Icon, Loading, Modal, Sec, Stepper, Title, useIsMobile, useMe, useToast } from '../../ui';
import { AnalyticsM, BillingM, MenuM, SettingsM, ShiftsM, StaffM } from './mobile';

const useAct = (msg?: string) => {
  const qc = useQueryClient(); const toast = useToast();
  return useMutation({ mutationFn: (fn: () => Promise<any>) => fn(), onSuccess: () => { qc.invalidateQueries(); if (msg) toast(msg); }, onError: (e) => toast((e as Error).message) });
};

// ---------------- Menu & Dishes ----------------
export function Menu() {
  const me = useMe();
  const mobile = useIsMobile();
  const { data } = useQuery({ queryKey: ['menu'], queryFn: () => api('/floor/menu') });
  const stations = useQuery({ queryKey: ['stations'], queryFn: () => api('/kitchen/stations') });
  const [cat, setCat] = useState<number | 'all'>('all');
  const [edit, setEdit] = useState<any | null>(null);
  const act = useAct();
  if (!data) return <Loading />;
  const dishes = data.flatMap((c: any) => c.dishes.map((d: any) => ({ ...d, category: c.name })));
  const list = dishes.filter((d: any) => cat === 'all' || d.categoryId === cat);
  const stationName = (id: number) => stations.data?.find((s: any) => s.id === id)?.name ?? '';
  if (mobile) return <><MenuM cats={data} dishes={dishes} cat={cat} setCat={setCat} stationName={stationName} canAdd={me.role !== 'admin'} onAdd={() => setEdit({})} onEdit={setEdit} toggleStock={(d) => act.mutate(() => api(`/kitchen/dishes/${d.id}/stock`, { method: 'PATCH', body: { available: !d.available } }))} />{edit && <DishForm dish={edit} cats={data} stations={stations.data ?? []} onClose={() => setEdit(null)} />}</>;
  return (
    <>
      <Title title="Menu & Dishes" sub={`${dishes.length} dishes · ${dishes.filter((d: any) => !d.available).length} out of stock`} right={me.role !== 'admin' && <button className="btn" onClick={() => setEdit({})}><Icon name="plus" size={18} sw={2} />Add dish</button>} />
      <div className="pills"><button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>All</button>{data.map((c: any) => <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>{c.name}</button>)}</div>
      <table className="table">
        <thead><tr><th>Dish</th><th>Category</th><th>Station</th><th>Prep</th>{me.role !== 'admin' && <th>Price</th>}<th>Stock</th><th /></tr></thead>
        <tbody>{list.map((d: any) => (
          <tr key={d.id}>
            <td><div className="row-flex"><span className={`veg ${d.veg ? '' : 'non'}`} /><span className="b">{d.name}</span></div>{d.options?.length > 0 && <div className="dim small">{d.options.join(' · ')}</div>}</td>
            <td className="muted">{d.category}</td><td className="muted">{stationName(d.stationId)}</td><td className="muted">{d.prepMinutes} min</td>
            {me.role !== 'admin' && <td>{rupees(d.price)}</td>}
            <td><button className={`link ${d.available ? 'green' : 'red'}`} onClick={() => act.mutate(() => api(`/kitchen/dishes/${d.id}/stock`, { method: 'PATCH', body: { available: !d.available } }))}>{d.available ? 'In stock' : 'Out of stock'}</button></td>
            <td style={{ textAlign: 'right' }}><button className="link" onClick={() => setEdit(d)}>Edit</button></td>
          </tr>))}
        </tbody>
      </table>
      {edit && <DishForm dish={edit} cats={data} stations={stations.data ?? []} onClose={() => setEdit(null)} />}
    </>
  );
}

function DishForm({ dish, cats, stations, onClose }: { dish: any; cats: any[]; stations: any[]; onClose: () => void }) {
  const me = useMe(); const qc = useQueryClient();
  const [f, setF] = useState({ name: dish.name ?? '', description: dish.description ?? '', categoryId: dish.categoryId ?? cats[0]?.id, stationId: dish.stationId ?? stations[0]?.id, price: dish.price != null ? dish.price / 100 : 0, veg: dish.veg ?? true, prepMinutes: dish.prepMinutes ?? 15, options: (dish.options ?? []).join(', '), hasSpice: dish.hasSpice ?? true });
  const save = useMutation({
    mutationFn: () => {
      const body: any = { ...f, options: f.options.split(',').map((x: string) => x.trim()).filter(Boolean), price: Math.round(f.price * 100) };
      if (me.role === 'admin') delete body.price;
      return dish.id ? api(`/manage/dishes/${dish.id}`, { method: 'PATCH', body }) : api('/manage/dishes', { body });
    },
    onSuccess: () => { qc.invalidateQueries(); onClose(); },
  });
  return (
    <Modal title={dish.id ? 'Edit dish' : 'Add dish'} onClose={onClose}>
      <label className="field">Name<input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="field">Description<input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <div className="row-flex"><label className="field grow">Category<select className="select" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: Number(e.target.value) })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="field grow">Station (kitchen queue)<select className="select" value={f.stationId} onChange={(e) => setF({ ...f, stationId: Number(e.target.value) })}>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
      <div className="row-flex">{me.role !== 'admin' && <label className="field grow">Price (₹)<input className="input" type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} /></label>}
        <label className="field grow">Prep time (min)<input className="input" type="number" min={1} value={f.prepMinutes} onChange={(e) => setF({ ...f, prepMinutes: Number(e.target.value) })} /></label></div>
      <label className="field">Options guests can pick (comma separated)<input className="input" placeholder="No onion, Extra butter" value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} /></label>
      <div className="pills"><button className={f.veg ? 'on' : ''} onClick={() => setF({ ...f, veg: !f.veg })}>Veg</button><button className={f.hasSpice ? 'on' : ''} onClick={() => setF({ ...f, hasSpice: !f.hasSpice })}>Ask spice level</button></div>
      <ErrorText error={save.error} />
      <button className="btn block" disabled={!f.name || save.isPending} onClick={() => save.mutate()}>Save dish</button>
    </Modal>
  );
}

// ---------------- Staff & Chefs ----------------
export function Staff() {
  const me = useMe();
  const mobile = useIsMobile();
  const { data } = useQuery({ queryKey: ['staff'], queryFn: () => api('/team/staff') });
  const [tab, setTab] = useState('all'); const [adding, setAdding] = useState(false);
  if (!data) return <Loading />;
  const roles = [['all', 'Everyone'], ['chef', 'Chefs'], ['waiter', 'Waiters'], ['manager', 'Managers']];
  const list = data.staff.filter((p: any) => tab === 'all' || p.role === tab || (tab === 'manager' && ['owner', 'admin'].includes(p.role)));
  const station = (id: number) => data.stations.find((s: any) => s.id === id)?.name;
  const area = (id: number) => data.areas.find((a: any) => a.id === id)?.name;
  if (mobile) return <><StaffM data={data} onAdd={() => setAdding(true)} />{adding && <AddStaff data={data} canManagers={me.role !== 'admin'} onClose={() => setAdding(false)} />}</>;
  return (
    <>
      <Title title="Staff & Chefs" sub={`${data.staff.filter((p: any) => p.onDuty).length} of ${data.staff.length} on duty`} right={<div className="row-flex"><Link to="/shifts" className="btn ghost">Shifts & sections</Link><button className="btn" onClick={() => setAdding(true)}><Icon name="plus" size={18} sw={2} />Add staff</button></div>} />
      <div className="tabs">{roles.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div>{list.map((p: any) => (
        <div key={p.id} className="row">
          <span className="avatar">{p.name[0]}</span>
          <div className="grow"><div className="b">{p.name}</div><div className="dim small">{p.role[0].toUpperCase() + p.role.slice(1)}{p.stationId ? ' · ' + station(p.stationId) : ''}{p.areaId ? ' · ' + area(p.areaId) : ''}{p.tables.length ? ' · ' + p.tables.map((t: any) => t.code).join(', ') : ''}</div></div>
          <span className="muted small">{p.phone}</span>
          {p.role === 'chef' && <span className="muted small" style={{ width: 120 }}>{p.cooking}/{p.maxParallel} cooking · {p.doneToday} done</span>}
          <span className={`small b ${!p.onDuty ? 'dim' : p.onBreak ? 'amber' : 'green'}`} style={{ width: 80, textAlign: 'right' }}>{!p.onDuty ? 'Off duty' : p.onBreak ? 'On break' : 'On duty'}</span>
        </div>))}
      </div>
      {adding && <AddStaff data={data} canManagers={me.role !== 'admin'} onClose={() => setAdding(false)} />}
    </>
  );
}

function AddStaff({ data, canManagers, onClose }: { data: any; canManagers: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<any>({ name: '', phone: '', role: 'waiter', pin: '', email: '', password: '', stationId: data.stations[0]?.id, areaId: data.areas[0]?.id, maxParallel: 4 });
  const staffRole = f.role === 'waiter' || f.role === 'chef';
  const save = useMutation({
    mutationFn: () => api('/team/staff', { body: { name: f.name, phone: f.phone, role: f.role, maxParallel: f.maxParallel, ...(staffRole ? { pin: f.pin } : { email: f.email, password: f.password }), stationId: f.role === 'chef' ? f.stationId : null, areaId: f.role === 'waiter' ? f.areaId : null } }),
    onSuccess: () => { qc.invalidateQueries(); onClose(); },
  });
  return (
    <Modal title="Add staff" onClose={onClose}>
      <div className="pills">{['waiter', 'chef', 'admin', ...(canManagers ? ['manager'] : [])].map((r) => <button key={r} className={f.role === r ? 'on' : ''} onClick={() => setF({ ...f, role: r })}>{r[0].toUpperCase() + r.slice(1)}</button>)}</div>
      <label className="field">Name<input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="field">Phone<input className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
      {staffRole ? <label className="field">Sign-in PIN (4 digits)<input className="input" inputMode="numeric" maxLength={6} value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, '') })} /></label> : <>
        <label className="field">Email<input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className="field">Password<input className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label></>}
      {f.role === 'chef' && <><label className="field">Station<select className="select" value={f.stationId} onChange={(e) => setF({ ...f, stationId: Number(e.target.value) })}>{data.stations.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <div className="row-flex" style={{ justifyContent: 'space-between' }}><span className="muted">Most dishes at once</span><Stepper value={f.maxParallel} min={1} max={10} onChange={(v) => setF({ ...f, maxParallel: v })} /></div></>}
      {f.role === 'waiter' && <label className="field">Area<select className="select" value={f.areaId} onChange={(e) => setF({ ...f, areaId: Number(e.target.value) })}>{data.areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
      <ErrorText error={save.error} />
      <button className="btn block" disabled={!f.name || !f.phone || save.isPending} onClick={() => save.mutate()}>Add to team</button>
    </Modal>
  );
}

// ---------------- Shifts & Sections ----------------
export function Shifts() {
  const me = useMe();
  const mobile = useIsMobile();
  const { data } = useQuery({ queryKey: ['staff'], queryFn: () => api('/team/staff') });
  const tables = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables') });
  const [tab, setTab] = useState<'kitchen' | 'floor'>('kitchen');
  const dash = useQuery({ queryKey: ['dashboard', 1], queryFn: () => api('/manage/dashboard?days=1'), enabled: mobile });
  const [sections, setSections] = useState<any | null>(null);
  const act = useAct();
  const [rules, setRules] = useState<{ areaSecs: number; managerSecs: number } | null>(null);
  useEffect(() => { if (data && !rules) setRules(data.rules); }, [data]);
  if (!data || !rules) return <Loading />;
  const chefs = data.staff.filter((p: any) => p.role === 'chef');
  const waiters = data.staff.filter((p: any) => p.role === 'waiter');
  const patch = (id: number, body: any) => act.mutate(() => api(`/team/staff/${id}`, { method: 'PATCH', body }));
  const saveRules = (r: typeof rules) => { setRules(r); act.mutate(() => api('/team/restaurant', { method: 'PATCH', body: { alertAreaSecs: r.areaSecs, alertManagerSecs: r.managerSecs } })); };
  if (mobile) return <><ShiftsM data={data} waiting={(id) => dash.data?.stations?.find((x: any) => x.id === id)?.waiting ?? 0} patch={patch} rules={rules} saveRules={saveRules} onSections={setSections} />{sections && me.role !== 'chef' && <Sections waiter={sections} all={tables.data?.tables ?? []} onClose={() => setSections(null)} />}</>;
  return (
    <>
      <Title title="Shifts & Sections" sub="Who cooks where and who serves which tables" />
      <div className="tabs"><button className={tab === 'kitchen' ? 'on' : ''} onClick={() => setTab('kitchen')}>Kitchen <span className="dim">{chefs.length} chefs</span></button><button className={tab === 'floor' ? 'on' : ''} onClick={() => setTab('floor')}>Floor <span className="dim">{waiters.length} waiters</span></button></div>
      <div className="cols" style={{ gridTemplateColumns: 'minmax(0, 1.7fr) minmax(260px, 1fr)' }}>
        <div>
          {tab === 'kitchen' ? data.stations.map((st: any) => (
            <Sec key={st.id} title={st.name}>
              {chefs.filter((c: any) => c.stationId === st.id).map((c: any) => (
                <div key={c.id} className="row">
                  <span className="b grow">{c.name}</span>
                  <span className={`small ${c.onBreak ? 'amber' : c.cooking >= c.maxParallel ? 'amber' : 'muted'}`} style={{ width: 120 }}>{c.onBreak ? 'On break' : `${c.cooking} of ${c.maxParallel} cooking`}</span>
                  <span className="dim small">Max</span><Stepper value={c.maxParallel} min={1} max={10} onChange={(v) => patch(c.id, { maxParallel: v })} />
                  <select className="select" style={{ width: 140, height: 36 }} value={c.stationId} onChange={(e) => patch(c.id, { stationId: Number(e.target.value) })} aria-label="Move to station">{data.stations.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  <button className="link" style={{ width: 110, textAlign: 'right' }} onClick={() => patch(c.id, { onBreak: !c.onBreak })}>{c.onBreak ? 'Back on duty' : 'Send on break'}</button>
                </div>
              ))}
            </Sec>
          )) : (
            <Sec title="Waiters and their tables">
              {waiters.map((w: any) => (
                <div key={w.id} className="row">
                  <div className="grow"><div className="b">{w.name}</div><div className={`small ${w.onBreak ? 'amber' : !w.onDuty ? 'dim' : 'green'}`}>{w.onBreak ? 'On break · alerts go to the area' : w.onDuty ? 'On duty' : 'Off duty'}</div></div>
                  <span className="muted" style={{ width: 110 }}>{data.areas.find((a: any) => a.id === w.areaId)?.name}</span>
                  <span className="b" style={{ width: 160 }}>{w.tables.map((t: any) => t.code).join(', ') || '—'}</span>
                  <button className="link" onClick={() => setSections(w)}>Tables</button>
                  <button className="link" style={{ width: 110, textAlign: 'right' }} onClick={() => patch(w.id, { onBreak: !w.onBreak })}>{w.onBreak ? 'Back on duty' : 'Send on break'}</button>
                </div>
              ))}
            </Sec>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <Sec title="How the kitchen queue works"><div className="muted" style={{ lineHeight: 1.6 }}>Each dish goes to its station. Chefs at a station share one queue and tap Start to take a dish. Nobody can take more than their max at once, and two chefs can never take the same dish.</div></Sec>
          <Sec title="Alert rules">
            <div className="row"><span className="muted grow">Pass to free waiters in the area after</span><Stepper value={rules.areaSecs} min={15} max={600} fmt={(v) => v + ' s'} onChange={(v) => saveRules({ ...rules, areaSecs: v })} /></div>
            <div className="row"><span className="muted grow">Pass to the manager after</span><Stepper value={rules.managerSecs} min={30} max={1200} fmt={(v) => v + ' s'} onChange={(v) => saveRules({ ...rules, managerSecs: Math.max(v, rules.areaSecs + 15) })} /></div>
            <div className="dim small" style={{ marginTop: 10 }}>Food ready, guest calls and bill requests go to the table's waiter first.</div>
          </Sec>
        </div>
      </div>
      {sections && me.role !== 'chef' && <Sections waiter={sections} all={tables.data?.tables ?? []} onClose={() => setSections(null)} />}
    </>
  );
}

function Sections({ waiter, all, onClose }: { waiter: any; all: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [pick, setPick] = useState<number[]>(waiter.tables.map((t: any) => t.id));
  const save = useMutation({ mutationFn: () => api(`/team/staff/${waiter.id}/tables`, { method: 'PUT', body: { tableIds: pick } }), onSuccess: () => { qc.invalidateQueries(); onClose(); } });
  return (
    <Modal title={`${waiter.name}'s tables`} onClose={onClose}>
      <div className="dim small">Tables already with another waiter move to {waiter.name.split(' ')[0]}.</div>
      <div className="grid-tables" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))' }}>
        {all.map((t) => { const on = pick.includes(t.id); return <button key={t.id} className="tile" style={{ minHeight: 52, alignItems: 'center', justifyContent: 'center', boxShadow: on ? 'inset 0 0 0 1.5px var(--blue)' : undefined, color: on ? 'var(--blue)' : undefined }} onClick={() => setPick(on ? pick.filter((x) => x !== t.id) : [...pick, t.id])}><span className="bb">{t.code}</span>{!on && t.waiter && t.waiterId !== waiter.id && <span className="dim" style={{ fontSize: 10.5 }}>{t.waiter.split(' ')[0]}</span>}</button>; })}
      </div>
      <button className="btn block" onClick={() => save.mutate()}>Save {pick.length} tables</button>
    </Modal>
  );
}

// ---------------- Billing ----------------
export function Billing() {
  const mobile = useIsMobile();
  const tables = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables') });
  const bills = useQuery({ queryKey: ['bills'], queryFn: () => api('/floor/bills') });
  if (!tables.data || !bills.data) return <Loading />;
  if (mobile) return <BillingM tables={tables.data.tables} bills={bills.data} />;
  const open = tables.data.tables.filter((t: any) => t.state !== 'free');
  const today = bills.data.filter((b: any) => new Date(b.paidAt).toDateString() === new Date().toDateString());
  const sum = (m?: string) => today.filter((b: any) => !m || b.method === m).reduce((a: number, b: any) => a + b.total, 0);
  return (
    <>
      <Title title="Billing" sub={`${today.length} bills today`} />
      <div className="kpis">{[['Collected today', rupees(sum())], ['UPI', rupees(sum('upi'))], ['Card', rupees(sum('card'))], ['Cash', rupees(sum('cash'))]].map(([l, v]) => <div key={l}><div className="kpi-l">{l}</div><div className="kpi-v">{v}</div></div>)}</div>
      <div className="cols">
        <Sec title="Open tables" n={open.length}>
          {open.map((t: any) => <Link key={t.id} to="/tables/$id" params={{ id: String(t.id) }} className="row"><span className="bb" style={{ width: 48 }}>{t.code}</span><span className="grow muted">{t.guests} guests · {t.items} dishes · {ago(t.openedAt)}</span>{t.state === 'billing' && <span className="red small b">Bill asked</span>}<span className="b">{rupees(t.amount)}</span></Link>)}
        </Sec>
        <Sec title="Paid">
          {bills.data.slice(0, 20).map((b: any) => <div key={b.id} className="row"><span className="bb" style={{ width: 48 }}>{b.table}</span><span className="grow muted">{b.method.toUpperCase()} · {ago(b.paidAt)} ago</span>{b.discount > 0 && <span className="amber small">−{rupees(b.discount)}</span>}<span className="b">{rupees(b.total)}</span></div>)}
        </Sec>
      </div>
    </>
  );
}

// ---------------- Analytics ----------------
export function Analytics() {
  const mobile = useIsMobile();
  const { data } = useQuery({ queryKey: ['analytics'], queryFn: () => api('/manage/analytics') });
  if (!data) return <Loading />;
  if (mobile) return <AnalyticsM data={data} />;
  const max = Math.max(1, ...data.days.map((d: any) => d.revenue));
  return (
    <>
      <Title title="Analytics" sub="Last 7 days" />
      <Sec title="Revenue by day">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 200 }}>
          {data.days.map((d: any) => <div key={d.d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}><span className="small b">{rupees(d.revenue)}</span><div style={{ width: '100%', maxWidth: 48, height: (d.revenue / max) * 150, background: 'var(--blue2)', borderRadius: 6 }} /><span className="dim small">{d.day}</span></div>)}
          {data.days.length === 0 && <div className="empty grow">No bills yet</div>}
        </div>
      </Sec>
      <div className="cols">
        <Sec title="Top dishes">{data.top.map((t: any, i: number) => <div key={t.name} className="row"><span className="dim" style={{ width: 20 }}>{i + 1}</span><span className="grow b">{t.name}</span><span className="muted">{t.qty} sold</span><span style={{ width: 90, textAlign: 'right' }}>{rupees(t.revenue)}</span></div>)}</Sec>
        <Sec title="Payment methods">{data.methods.map((m: any) => <div key={m.method} className="row"><span className="grow b">{m.method.toUpperCase()}</span><span className="muted">{m.n} bills</span><span style={{ width: 90, textAlign: 'right' }}>{rupees(m.revenue)}</span></div>)}</Sec>
      </div>
    </>
  );
}

// ---------------- Settings ----------------
export function Settings() {
  const me = useMe();
  const mobile = useIsMobile();
  const { data } = useQuery({ queryKey: ['restaurant'], queryFn: () => api('/team/restaurant') });
  const [f, setF] = useState<any>(null);
  const act = useAct('Saved');
  useEffect(() => { if (data) setF(data); }, [data]);
  if (!f) return <Loading />;
  const can = me.role === 'owner' || me.role === 'manager';
  const saveRestaurant = () => act.mutate(() => api('/team/restaurant', { method: 'PATCH', body: { name: f.name, address: f.address, city: f.city, taxPercent: f.taxPercent } }));
  if (mobile) return <SettingsM f={f} setF={setF} can={can} save={saveRestaurant} saving={act.isPending} />;
  return (
    <>
      <Title title="Settings" sub="Restaurant details and alert rules" />
      <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label className="field">Restaurant name<input className="input" disabled={!can} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="field">Address<input className="input" disabled={!can} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
        <label className="field">City<input className="input" disabled={!can} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>
        <label className="field">Tax (GST %)<input className="input" type="number" disabled={!can} value={f.taxPercent} onChange={(e) => setF({ ...f, taxPercent: Number(e.target.value) })} /></label>
        {can ? <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => act.mutate(() => api('/team/restaurant', { method: 'PATCH', body: { name: f.name, address: f.address, city: f.city, taxPercent: f.taxPercent } }))}>Save</button> : <div className="dim small">Only the owner or manager can change these.</div>}
      </div>
    </>
  );
}
