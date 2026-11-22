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
      <Title title="Menu & Dishes" sub={`${dishes.length} dishes · ${dishes.filter((d: any) => !d.available).length} out of stock`} right={me.role !== 'admin' && <button className="h-10 py-0 px-4.5 rounded-[20px] border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={() => setEdit({})}><Icon name="plus" size={18} sw={2} />Add dish</button>} />
      <div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)]"><button className={(cat === 'all') ? "on" : ""} onClick={() => setCat('all')}>All</button>{data.map((c: any) => <button key={c.id} className={(cat === c.id) ? "on" : ""} onClick={() => setCat(c.id)}>{c.name}</button>)}</div>
      <table className="w-full [border-collapse:collapse] [&_th]:text-left [&_th]:font-medium [&_th]:text-dim [&_th]:text-[12.5px] [&_th]:pt-0 [&_th]:pr-3 [&_th]:pb-2.5 [&_th]:pl-0 [&_td]:pt-3 [&_td]:pr-3 [&_td]:pb-3 [&_td]:pl-0 [&_td]:border-t [&_td]:border-t-line [&_tbody_tr]:stagger">
        <thead><tr><th>Dish</th><th>Category</th><th>Station</th><th>Prep</th>{me.role !== 'admin' && <th>Price</th>}<th>Stock</th><th /></tr></thead>
        <tbody>{list.map((d: any) => (
          <tr key={d.id}>
            <td><div className="flex items-center gap-2.5"><span className={(d.veg) ? "w-3 h-3 border-[1.5px] border-green rounded-[2px] inline-flex items-center justify-center flex-none after:content-[''] after:w-1.25 after:h-1.25 after:rounded-[3px] after:bg-green" : "w-3 h-3 border-[1.5px] rounded-[2px] inline-flex items-center justify-center flex-none after:content-[''] after:w-1.25 after:h-1.25 after:rounded-[3px] border-red after:bg-red"} /><span className="font-semibold">{d.name}</span></div>{d.options?.length > 0 && <div className="text-dim text-[12.5px]">{d.options.join(' · ')}</div>}</td>
            <td className="text-muted">{d.category}</td><td className="text-muted">{stationName(d.stationId)}</td><td className="text-muted">{d.prepMinutes} min</td>
            {me.role !== 'admin' && <td>{rupees(d.price)}</td>}
            <td><button className={(d.available) ? "border-0 bg-transparent p-0 font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] text-green in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]" : "border-0 bg-transparent p-0 font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] text-red in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]"} onClick={() => act.mutate(() => api(`/kitchen/dishes/${d.id}/stock`, { method: 'PATCH', body: { available: !d.available } }))}>{d.available ? 'In stock' : 'Out of stock'}</button></td>
            <td className="text-right"><button className="border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]" onClick={() => setEdit(d)}>Edit</button></td>
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
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">Name<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">Description<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <div className="flex items-center gap-2.5"><label className="flex-1 min-w-0 flex flex-col gap-1.5 text-[13px] text-muted">Category<select className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: Number(e.target.value) })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="flex-1 min-w-0 flex flex-col gap-1.5 text-[13px] text-muted">Station (kitchen queue)<select className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" value={f.stationId} onChange={(e) => setF({ ...f, stationId: Number(e.target.value) })}>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
      <div className="flex items-center gap-2.5">{me.role !== 'admin' && <label className="flex-1 min-w-0 flex flex-col gap-1.5 text-[13px] text-muted">Price (₹)<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} /></label>}
        <label className="flex-1 min-w-0 flex flex-col gap-1.5 text-[13px] text-muted">Prep time (min)<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" type="number" min={1} value={f.prepMinutes} onChange={(e) => setF({ ...f, prepMinutes: Number(e.target.value) })} /></label></div>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">Options guests can pick (comma separated)<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" placeholder="No onion, Extra butter" value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} /></label>
      <div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)]"><button className={(f.veg) ? "on" : ""} onClick={() => setF({ ...f, veg: !f.veg })}>Veg</button><button className={(f.hasSpice) ? "on" : ""} onClick={() => setF({ ...f, hasSpice: !f.hasSpice })}>Ask spice level</button></div>
      <ErrorText error={save.error} />
      <button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" disabled={!f.name || save.isPending} onClick={() => save.mutate()}>Save dish</button>
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
      <Title title="Staff & Chefs" sub={`${data.staff.filter((p: any) => p.onDuty).length} of ${data.staff.length} on duty`} right={<div className="flex items-center gap-2.5"><Link to="/shifts" className="h-10 py-0 px-4.5 rounded-[20px] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] bg-transparent border border-edge text-fg active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11">Shifts & sections</Link><button className="h-10 py-0 px-4.5 rounded-[20px] border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={() => setAdding(true)}><Icon name="plus" size={18} sw={2} />Add staff</button></div>} />
      <div className="flex gap-5.5 border-b border-b-line overflow-x-auto [&_button]:h-11 [&_button]:p-0 [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button]:text-[14.5px] [&_button]:shadow-[inset_0_-2px_0_transparent] [&_button]:whitespace-nowrap [&_button.on]:text-fg [&_button.on]:font-bold [&_button.on]:shadow-[inset_0_-2px_0_var(--color-blue)] [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] tabs">{roles.map(([k, l]) => <button key={k} className={(tab === k) ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div>{list.map((p: any) => (
        <div key={p.id} className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0">
          <span className="w-9 h-9 rounded-[18px] bg-chip2 flex items-center justify-center font-semibold flex-none">{p.name[0]}</span>
          <div className="flex-1 min-w-0"><div className="font-semibold">{p.name}</div><div className="text-dim text-[12.5px]">{p.role[0].toUpperCase() + p.role.slice(1)}{p.stationId ? ' · ' + station(p.stationId) : ''}{p.areaId ? ' · ' + area(p.areaId) : ''}{p.tables.length ? ' · ' + p.tables.map((t: any) => t.code).join(', ') : ''}</div></div>
          <span className="text-muted text-[12.5px]">{p.phone}</span>
          {p.role === 'chef' && <span className="text-muted text-[12.5px] w-30">{p.cooking}/{p.maxParallel} cooking · {p.doneToday} done</span>}
          <span className={(!p.onDuty) ? "text-dim text-[12.5px] font-semibold w-20 text-right" : ((p.onBreak) ? "text-[12.5px] text-amber font-semibold w-20 text-right" : "text-[12.5px] text-green font-semibold w-20 text-right")}>{!p.onDuty ? 'Off duty' : p.onBreak ? 'On break' : 'On duty'}</span>
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
      <div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)]">{['waiter', 'chef', 'admin', ...(canManagers ? ['manager'] : [])].map((r) => <button key={r} className={(f.role === r) ? "on" : ""} onClick={() => setF({ ...f, role: r })}>{r[0].toUpperCase() + r.slice(1)}</button>)}</div>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">Name<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">Phone<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
      {staffRole ? <label className="flex flex-col gap-1.5 text-[13px] text-muted">Sign-in PIN (4 digits)<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" inputMode="numeric" maxLength={6} value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, '') })} /></label> : <>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Email<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Password<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label></>}
      {f.role === 'chef' && <><label className="flex flex-col gap-1.5 text-[13px] text-muted">Station<select className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" value={f.stationId} onChange={(e) => setF({ ...f, stationId: Number(e.target.value) })}>{data.stations.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <div className="flex items-center gap-2.5 justify-between"><span className="text-muted">Most dishes at once</span><Stepper value={f.maxParallel} min={1} max={10} onChange={(v) => setF({ ...f, maxParallel: v })} /></div></>}
      {f.role === 'waiter' && <label className="flex flex-col gap-1.5 text-[13px] text-muted">Area<select className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" value={f.areaId} onChange={(e) => setF({ ...f, areaId: Number(e.target.value) })}>{data.areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
      <ErrorText error={save.error} />
      <button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" disabled={!f.name || !f.phone || save.isPending} onClick={() => save.mutate()}>Add to team</button>
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
      <div className="flex gap-5.5 border-b border-b-line overflow-x-auto [&_button]:h-11 [&_button]:p-0 [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button]:text-[14.5px] [&_button]:shadow-[inset_0_-2px_0_transparent] [&_button]:whitespace-nowrap [&_button.on]:text-fg [&_button.on]:font-bold [&_button.on]:shadow-[inset_0_-2px_0_var(--color-blue)] [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] tabs"><button className={(tab === 'kitchen') ? "on" : ""} onClick={() => setTab('kitchen')}>Kitchen <span className="text-dim">{chefs.length} chefs</span></button><button className={(tab === 'floor') ? "on" : ""} onClick={() => setTab('floor')}>Floor <span className="text-dim">{waiters.length} waiters</span></button></div>
      <div className="grid gap-y-8 gap-x-0 [&>*]:py-0 [&>*]:px-7 [&>*:first-child]:pl-0 [&>*:last-child]:pr-0 [&>*+*]:border-l [&>*+*]:border-l-line2 phone:[&>*]:p-0! phone:[&>*]:border-l-0! grid-cols-[minmax(0,_1.7fr)_minmax(260px,_1fr)]">
        <div>
          {tab === 'kitchen' ? data.stations.map((st: any) => (
            <Sec key={st.id} title={st.name}>
              {chefs.filter((c: any) => c.stationId === st.id).map((c: any) => (
                <div key={c.id} className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0">
                  <span className="font-semibold flex-1 min-w-0">{c.name}</span>
                  <span className={(c.onBreak) ? "text-[12.5px] text-amber w-30" : ((c.cooking >= c.maxParallel) ? "text-[12.5px] text-amber w-30" : "text-muted text-[12.5px] w-30")}>{c.onBreak ? 'On break' : `${c.cooking} of ${c.maxParallel} cooking`}</span>
                  <span className="text-dim text-[12.5px]">Max</span><Stepper value={c.maxParallel} min={1} max={10} onChange={(v) => patch(c.id, { maxParallel: v })} />
                  <select className="py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue w-35 h-9" value={c.stationId} onChange={(e) => patch(c.id, { stationId: Number(e.target.value) })} aria-label="Move to station">{data.stations.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  <button className="border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] w-27.5! text-right" onClick={() => patch(c.id, { onBreak: !c.onBreak })}>{c.onBreak ? 'Back on duty' : 'Send on break'}</button>
                </div>
              ))}
            </Sec>
          )) : (
            <Sec title="Waiters and their tables">
              {waiters.map((w: any) => (
                <div key={w.id} className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0">
                  <div className="flex-1 min-w-0"><div className="font-semibold">{w.name}</div><div className={(w.onBreak) ? "text-[12.5px] text-amber" : ((!w.onDuty) ? "text-dim text-[12.5px]" : "text-[12.5px] text-green")}>{w.onBreak ? 'On break · alerts go to the area' : w.onDuty ? 'On duty' : 'Off duty'}</div></div>
                  <span className="text-muted w-27.5">{data.areas.find((a: any) => a.id === w.areaId)?.name}</span>
                  <span className="font-semibold w-40">{w.tables.map((t: any) => t.code).join(', ') || '—'}</span>
                  <button className="border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]" onClick={() => setSections(w)}>Tables</button>
                  <button className="border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] w-27.5! text-right" onClick={() => patch(w.id, { onBreak: !w.onBreak })}>{w.onBreak ? 'Back on duty' : 'Send on break'}</button>
                </div>
              ))}
            </Sec>
          )}
        </div>
        <div className="flex flex-col gap-7">
          <Sec title="How the kitchen queue works"><div className="text-muted leading-[1.6]">Each dish goes to its station. Chefs at a station share one queue and tap Start to take a dish. Nobody can take more than their max at once, and two chefs can never take the same dish.</div></Sec>
          <Sec title="Alert rules">
            <div className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0"><span className="text-muted flex-1 min-w-0">Pass to free waiters in the area after</span><Stepper value={rules.areaSecs} min={15} max={600} fmt={(v) => v + ' s'} onChange={(v) => saveRules({ ...rules, areaSecs: v })} /></div>
            <div className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0"><span className="text-muted flex-1 min-w-0">Pass to the manager after</span><Stepper value={rules.managerSecs} min={30} max={1200} fmt={(v) => v + ' s'} onChange={(v) => saveRules({ ...rules, managerSecs: Math.max(v, rules.areaSecs + 15) })} /></div>
            <div className="text-dim text-[12.5px] mt-2.5">Food ready, guest calls and bill requests go to the table's waiter first.</div>
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
      <div className="text-dim text-[12.5px]">Tables already with another waiter move to {waiter.name.split(' ')[0]}.</div>
      <div className="grid gap-2.5 [&>*]:stagger [&>a:hover]:[transform:translateY(-2px)] [&>button:hover]:[transform:translateY(-2px)] [&>a:active]:[transform:scale(.98)] [&>button:active]:[transform:scale(.98)] grid-cols-[repeat(auto-fill,_minmax(64px,_1fr))]">
        {all.map((t) => { const on = pick.includes(t.id); return <button key={t.id} className="rounded-[14px] bg-card py-2.5 px-3 flex flex-col border-0 text-left text-fg stagger [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] hover:[transform:translateY(-2px)] active:[transform:scale(.98)] min-h-13 items-center justify-center" style={{ boxShadow: on ? 'inset 0 0 0 1.5px var(--color-blue)' : undefined, color: on ? 'var(--color-blue)' : undefined }} onClick={() => setPick(on ? pick.filter((x) => x !== t.id) : [...pick, t.id])}><span className="font-bold">{t.code}</span>{!on && t.waiter && t.waiterId !== waiter.id && <span className="text-dim text-[10.5px]">{t.waiter.split(' ')[0]}</span>}</button>; })}
      </div>
      <button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={() => save.mutate()}>Save {pick.length} tables</button>
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
      <div className="grid grid-cols-[repeat(auto-fit,_minmax(170px,_1fr))] gap-5 [&>div+div]:border-l [&>div+div]:border-l-line2 [&>div+div]:pl-5 phone:[&>div+div]:border-l-0 phone:[&>div+div]:pl-0 [&>div]:stagger">{[['Collected today', rupees(sum())], ['UPI', rupees(sum('upi'))], ['Card', rupees(sum('card'))], ['Cash', rupees(sum('cash'))]].map(([l, v]) => <div key={l}><div className="text-muted text-[13px]">{l}</div><div className="text-[30px] font-bold tracking-[-.5px] mt-0.5">{v}</div></div>)}</div>
      <div className="grid grid-cols-[repeat(auto-fit,_minmax(300px,_1fr))] gap-y-8 gap-x-0 [&>*]:py-0 [&>*]:px-7 [&>*:first-child]:pl-0 [&>*:last-child]:pr-0 [&>*+*]:border-l [&>*+*]:border-l-line2 phone:[&>*]:p-0! phone:[&>*]:border-l-0!">
        <Sec title="Open tables" n={open.length}>
          {open.map((t: any) => <Link key={t.id} to="/tables/$id" params={{ id: String(t.id) }} className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0"><span className="font-bold w-12">{t.code}</span><span className="text-muted flex-1 min-w-0">{t.guests} guests · {t.items} dishes · {ago(t.openedAt)}</span>{t.state === 'billing' && <span className="text-[12.5px] text-red font-semibold">Bill asked</span>}<span className="font-semibold">{rupees(t.amount)}</span></Link>)}
        </Sec>
        <Sec title="Paid">
          {bills.data.slice(0, 20).map((b: any) => <div key={b.id} className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0"><span className="font-bold w-12">{b.table}</span><span className="text-muted flex-1 min-w-0">{b.method.toUpperCase()} · {ago(b.paidAt)} ago</span>{b.discount > 0 && <span className="text-[12.5px] text-amber">−{rupees(b.discount)}</span>}<span className="font-semibold">{rupees(b.total)}</span></div>)}
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
        <div className="flex items-end gap-3.5 h-50">
          {data.days.map((d: any) => <div key={d.d} className="flex-1 flex flex-col items-center gap-1.5"><span className="text-[12.5px] font-semibold">{rupees(d.revenue)}</span><div className="w-full max-w-12 bg-blue2 rounded-[6px]" style={{ height: (d.revenue / max) * 150 }} /><span className="text-dim text-[12.5px]">{d.day}</span></div>)}
          {data.days.length === 0 && <div className="flex-1 min-w-0 border border-dashed border-edge rounded-[16px] p-5.5 text-dim text-center">No bills yet</div>}
        </div>
      </Sec>
      <div className="grid grid-cols-[repeat(auto-fit,_minmax(300px,_1fr))] gap-y-8 gap-x-0 [&>*]:py-0 [&>*]:px-7 [&>*:first-child]:pl-0 [&>*:last-child]:pr-0 [&>*+*]:border-l [&>*+*]:border-l-line2 phone:[&>*]:p-0! phone:[&>*]:border-l-0!">
        <Sec title="Top dishes">{data.top.map((t: any, i: number) => <div key={t.name} className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0"><span className="text-dim w-5">{i + 1}</span><span className="font-semibold flex-1 min-w-0">{t.name}</span><span className="text-muted">{t.qty} sold</span><span className="w-22.5 text-right">{rupees(t.revenue)}</span></div>)}</Sec>
        <Sec title="Payment methods">{data.methods.map((m: any) => <div key={m.method} className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0"><span className="font-semibold flex-1 min-w-0">{m.method.toUpperCase()}</span><span className="text-muted">{m.n} bills</span><span className="w-22.5 text-right">{rupees(m.revenue)}</span></div>)}</Sec>
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
      <div className="max-w-140 flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Restaurant name<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" disabled={!can} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Address<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" disabled={!can} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">City<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" disabled={!can} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Tax (GST %)<input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" type="number" disabled={!can} value={f.taxPercent} onChange={(e) => setF({ ...f, taxPercent: Number(e.target.value) })} /></label>
        {can ? <button className="h-10 py-0 px-4.5 rounded-[20px] border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11 self-start" onClick={() => act.mutate(() => api('/team/restaurant', { method: 'PATCH', body: { name: f.name, address: f.address, city: f.city, taxPercent: f.taxPercent } }))}>Save</button> : <div className="text-dim text-[12.5px]">Only the owner or manager can change these.</div>}
      </div>
    </>
  );
}
