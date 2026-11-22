import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { rupees, SPICE, TASK_LABEL, type TaskKind } from '@dineos/shared';
import { api, session, useTick } from '../../api';
import { ago, ErrorText, Icon, Loading, Modal, Sec, Stepper, TABLE_STATE, Title, useIsMobile, useMe, useToast, StatusDot } from '../../ui';
import { TakeOrderM, WaiterAlertsM, WaiterHomeM } from './mobile';
import { tableRange as tableRangeOf } from '../../ui';

const KIND_COLOR: Record<TaskKind, string> = { food_ready: 'var(--color-green)', call: 'var(--color-blue)', bill: 'var(--color-taupe)' };

function useTasks() {
  return useQuery({ queryKey: ['tasks'], queryFn: () => api('/team/tasks'), refetchInterval: 10000 });
}
function useTaskActions() {
  const qc = useQueryClient(); const toast = useToast();
  return useMutation({
    mutationFn: ([id, what]: [number, 'take' | 'done']) => api(`/team/tasks/${id}/${what}`, { body: {} }),
    // the button reacts at once; the server answer (or a rollback) follows
    onMutate: async ([id, what]) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const prev = qc.getQueryData(['tasks']) as any;
      if (prev) qc.setQueryData(['tasks'], { ...prev, tasks: prev.tasks.map((t: any) => (t.id === id ? (what === 'take' ? { ...t, status: 'taken', mine: true } : { ...t, status: 'done' }) : t)) });
      return { prev };
    },
    onError: (e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['tasks'], ctx.prev); toast((e as Error).message); },
    onSettled: () => qc.invalidateQueries(),
  });
}
function origin(t: any, rules: any) {
  if (t.level === 0) return [`Your table · passes on in ${Math.max(0, rules.areaSecs - Math.round((Date.now() - new Date(t.createdAt).getTime()) / 1000))} s`, 'var(--color-dim)'];
  if (t.ownTable) return ['Your table · now with the whole area', 'var(--color-amber)'];
  if (t.level === 2) return [`Passed on from ${t.assignedName?.split(' ')[0] ?? 'nobody'} · manager alerted`, 'var(--color-red)'];
  return [`Passed on from ${t.assignedName?.split(' ')[0] ?? 'nobody'} · no reply in time`, 'var(--color-amber)'];
}

function DutyButton() {
  const me = useMe(); const qc = useQueryClient();
  const staff = useQuery({ queryKey: ['me'], queryFn: () => api('/auth/me') });
  const onBreak = staff.data?.staff.onBreak ?? me.onBreak;
  const m = useMutation({ mutationFn: () => api(`/team/staff/${me.id}`, { method: 'PATCH', body: { onBreak: !onBreak } }), onSuccess: () => qc.invalidateQueries() });
  return <button className="font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] h-9 py-0 px-3.5 rounded-[18px] text-[13.5px] bg-transparent border border-edge text-fg active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={() => m.mutate()} style={{ color: onBreak ? 'var(--color-amber)' : 'var(--color-green)' }}><span className="w-2 h-2 rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)]" style={{ background: onBreak ? 'var(--color-amber)' : 'var(--color-green)' }} />{onBreak ? 'On break · tap to resume' : 'On duty'}</button>;
}

export function WaiterHome() {
  useTick(5000);
  const me = useMe();
  const mobile = useIsMobile();
  const tables = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables') });
  const tasks = useTasks(); const act = useTaskActions();
  const open = (tasks.data?.tasks ?? []).filter((t: any) => t.status === 'open');
  const mine = (tasks.data?.tasks ?? []).filter((t: any) => t.status === 'taken' && t.mine);
  const ts = tables.data?.tables ?? [];
  const hour = new Date().getHours();
  if (mobile) return <WaiterHomeM tasks={tasks.data} act={(id, what) => act.mutate([id, what])} />;
  return (
    <>
      <Title title={`Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, ${me.name.split(' ')[0]}`} sub={`Tables ${ts.map((t: any) => t.code).join(', ') || 'not assigned yet'}`}
        right={<div className="flex items-center gap-2.5"><DutyButton /><Link to="/w/take-order" className="h-10 py-0 px-4.5 rounded-[20px] border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11"><Icon name="plus" size={18} sw={2} />Take order</Link></div>} />
      <div className="grid grid-cols-[repeat(auto-fit,_minmax(170px,_1fr))] gap-5 [&>div+div]:border-l [&>div+div]:border-l-line2 [&>div+div]:pl-5 phone:[&>div+div]:border-l-0 phone:[&>div+div]:pl-0 [&>div]:stagger">{[['Tables in use', ts.filter((t: any) => t.state !== 'free').length], ['Food ready', ts.reduce((a: number, t: any) => a + t.ready, 0)], ['Alerts', open.length], ['Waiting for bill', ts.filter((t: any) => t.state === 'billing').length]].map(([l, v]) => <div key={l as string}><div className="text-muted text-[13px]">{l}</div><div className="text-[30px] font-bold tracking-[-.5px] mt-0.5">{v}</div></div>)}</div>
      <div className="grid gap-y-8 gap-x-0 [&>*]:py-0 [&>*]:px-7 [&>*:first-child]:pl-0 [&>*:last-child]:pr-0 [&>*+*]:border-l [&>*+*]:border-l-line2 phone:[&>*]:p-0! phone:[&>*]:border-l-0! grid-cols-[minmax(0,_1.4fr)_minmax(260px,_1fr)]">
        <div className="flex flex-col gap-6">
          <Sec title="Needs someone" n={open.length} right={<Link to="/w/alerts" className="border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]">All alerts</Link>}>
            {open.length === 0 && <div className="border border-dashed border-edge rounded-[16px] p-5.5 text-dim text-center">All clear</div>}
            {open.slice(0, 5).map((t: any) => <TaskRow key={t.id} t={t} rules={tasks.data.rules} onTake={() => act.mutate([t.id, 'take'])} />)}
          </Sec>
          {mine.length > 0 && <Sec title="I'm handling" n={mine.length}>{mine.map((t: any) => <MineRow key={t.id} t={t} onDone={() => act.mutate([t.id, 'done'])} />)}</Sec>}
        </div>
        <Sec title="My tables">
          <div className="grid gap-2.5 [&>*]:stagger [&>a:hover]:[transform:translateY(-2px)] [&>button:hover]:[transform:translateY(-2px)] [&>a:active]:[transform:scale(.98)] [&>button:active]:[transform:scale(.98)] grid-cols-[repeat(auto-fill,_minmax(96px,_1fr))]">
            {ts.map((t: any) => { const [l, c] = TABLE_STATE[t.state]; return <Link key={t.id} to="/w/table/$id" params={{ id: String(t.id) }} className="rounded-[14px] bg-card py-2.5 px-3 flex flex-col justify-between border-0 text-left text-fg stagger [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] hover:[transform:translateY(-2px)] active:[transform:scale(.98)] min-h-16" style={{ boxShadow: `inset 0 0 0 1px ${t.state === 'free' ? 'transparent' : c}` }}><span className="flex items-center gap-2.5"><span className="font-bold">{t.code}</span><span className="flex-1 min-w-0" /><span className="w-2 h-2 rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)]" style={{ background: c }} /></span><span className="text-dim text-[11.5px]">{t.state === 'free' ? `${t.seats} seats` : `${t.guests} guests · ${l}`}</span></Link>; })}
          </div>
        </Sec>
      </div>
    </>
  );
}

function TaskRow({ t, rules, onTake }: { t: any; rules: any; onTake: () => void }) {
  const [o, c] = origin(t, rules);
  return (
    <div className="flex items-center gap-3.5 border-b border-b-line stagger last:border-b-0 py-4 px-0">
      <StatusDot color={KIND_COLOR[t.kind as TaskKind]} ready />
      <span className="font-bold w-11 text-[17px]">{t.table}</span>
      <div className="flex-1 min-w-0"><div className="font-semibold">{TASK_LABEL[t.kind as TaskKind]} <span className="text-muted font-medium">· {t.detail}</span></div><div className="text-[12.5px]" style={{ color: c }}>{o}</div></div>
      <button className="border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] h-9 py-0 px-3.5 rounded-[18px] text-[13.5px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={onTake}>On it</button>
    </div>
  );
}
function MineRow({ t, onDone }: { t: any; onDone: () => void }) {
  return (
    <div className="flex items-center gap-3.5 border-b border-b-line stagger last:border-b-0 py-4 px-0">
      <span className="w-2 h-2 rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)]" style={{ background: KIND_COLOR[t.kind as TaskKind] }} />
      <span className="font-bold w-11 text-[17px]">{t.table}</span>
      <div className="font-semibold flex-1 min-w-0">{TASK_LABEL[t.kind as TaskKind]} <span className="text-muted font-medium">· {t.detail}</span></div>
      {t.kind === 'bill' ? <Link to="/w/table/$id" params={{ id: String(t.tableId) }} className="font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] h-9 py-0 px-3.5 rounded-[18px] text-[13.5px] bg-transparent border border-edge text-fg active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11">Open bill</Link> : <button className="font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] h-9 py-0 px-3.5 rounded-[18px] text-[13.5px] bg-transparent border border-edge text-fg active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={onDone}>Done</button>}
    </div>
  );
}

export function Alerts() {
  useTick(5000);
  const me = useMe();
  const mobile = useIsMobile();
  const tasks = useTasks(); const act = useTaskActions();
  const staff = useQuery({ queryKey: ['me'], queryFn: () => api('/auth/me') });
  const tables = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables'), enabled: mobile });
  if (mobile) { const l: any[] = tables.data?.tables ?? []; return <WaiterAlertsM tasks={tasks.data} act={(id, what) => act.mutate([id, what])} sub={l.length ? `${tableRangeOf(l.map((t) => t.code))} · ${l[0].area}` : undefined} />; }
  if (!tasks.data) return <Loading />;
  const all = tasks.data.tasks;
  const open = all.filter((t: any) => t.status === 'open');
  const mine = all.filter((t: any) => t.status === 'taken' && t.mine);
  const others = all.filter((t: any) => t.status === 'taken' && !t.mine);
  const r = tasks.data.rules;
  return (
    <>
      <Title title="Alerts" sub="The first person to tap On it takes the alert" right={<DutyButton />} />
      <div className="grid gap-y-8 gap-x-0 [&>*]:py-0 [&>*]:px-7 [&>*:first-child]:pl-0 [&>*:last-child]:pr-0 [&>*+*]:border-l [&>*+*]:border-l-line2 phone:[&>*]:p-0! phone:[&>*]:border-l-0! grid-cols-[minmax(0,_1.6fr)_minmax(260px,_1fr)]">
        <div className="flex flex-col gap-7">
          <Sec title="Needs someone" n={open.length}>{open.length === 0 && <div className="border border-dashed border-edge rounded-[16px] p-5.5 text-dim text-center">All clear</div>}{open.map((t: any) => <TaskRow key={t.id} t={t} rules={r} onTake={() => act.mutate([t.id, 'take'])} />)}</Sec>
          <Sec title="I'm handling" n={mine.length}>{mine.length === 0 && <div className="text-dim">Nothing yet. Tap On it to take an alert.</div>}{mine.map((t: any) => <MineRow key={t.id} t={t} onDone={() => act.mutate([t.id, 'done'])} />)}</Sec>
          {others.length > 0 && <Sec title="Taken by others">{others.map((t: any) => <div key={t.id} className="text-dim flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0"><span className="font-bold w-11 ml-5.5">{t.table}</span><span>{TASK_LABEL[t.kind as TaskKind]} · {t.takenName?.split(' ')[0]} is on it</span></div>)}</Sec>}
        </div>
        <div className="flex flex-col gap-7">
          <Sec title="How an alert moves">
            {[['1', 'Your waiter', 'Goes to the waiter who owns the table', `0 to ${r.areaSecs} s`], ['2', 'Free waiters in the area', 'Everyone on duty in the same area sees it', `${r.areaSecs} to ${r.managerSecs} s`], ['3', 'Manager', 'Nobody took it, the manager is alerted', `After ${r.managerSecs} s`]].map(([n, a, b, c], i) => (
              <div key={n} className="flex items-start gap-3.5 py-3! px-0!" style={{ borderTop: i ? '1px solid var(--color-line2)' : 0 }}>
                <span className="w-6.5 h-6.5 rounded-[13px] border! border-edge! flex items-center justify-center text-[12.5px] font-bold text-muted flex-none">{n}</span>
                <div className="flex-1 min-w-0"><div className="flex items-center gap-2.5"><span className="font-semibold flex-1 min-w-0">{a}</span><span className="text-dim text-[12.5px]">{c}</span></div><div className="text-dim text-[12.5px]">{b}</div></div>
              </div>
            ))}
          </Sec>
          <Sec title="Covering tonight">
            <div className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0"><span className="text-muted flex-1 min-w-0">Status</span><span className="font-semibold">{staff.data?.staff.onBreak ? 'On break' : 'On duty'}</span></div>
            <div className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0"><span className="text-muted flex-1 min-w-0">Signed in as</span><span className="font-semibold">{me.name}</span></div>
          </Sec>
        </div>
      </div>
    </>
  );
}

// ---------------- Take order (POS) ----------------
type Line = { key: number; dishId: number; name: string; price?: number; qty: number; guestNo: number; spice: string | null; options: string[]; note: string };

/** Phone: the app's take-order flow. Desktop: the two-column POS below. */
export function TakeOrder() { return useIsMobile() ? <TakeOrderM /> : <TakeOrderDesktop />; }

function TakeOrderDesktop() {
  const search = useSearch({ strict: false }) as { table?: number };
  const qc = useQueryClient(); const toast = useToast(); const nav = useNavigate();
  const tables = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables') });
  const menu = useQuery({ queryKey: ['menu'], queryFn: () => api('/floor/menu') });
  const [tableId, setTableId] = useState<number | null>(search.table ? Number(search.table) : null);
  const [guests, setGuests] = useState<number | null>(null);
  const [cat, setCat] = useState<number | 'all'>('all');
  const [q, setQ] = useState('');
  const [cart, setCart] = useState<Line[]>([]);
  const [pick, setPick] = useState<any | null>(null);
  const table = tables.data?.tables.find((t: any) => t.id === tableId);
  const g = guests ?? (table?.guests || 2);
  const dishes = useMemo(() => (menu.data ?? []).flatMap((c: any) => c.dishes), [menu.data]);
  const list = dishes.filter((d: any) => (cat === 'all' || d.categoryId === cat) && d.name.toLowerCase().includes(q.toLowerCase()));
  const send = useMutation({
    mutationFn: async () => {
      let sessionId = table.sessionId;
      if (!sessionId || guests) sessionId = (await api('/floor/sessions', { body: { tableId, guestCount: g } })).id;
      return api('/floor/orders', { body: { sessionId, items: cart.map(({ dishId, qty, guestNo, spice, options, note }) => ({ dishId, qty, guestNo, spice, options, note })) } });
    },
    onSuccess: () => { qc.invalidateQueries(); toast(`Sent to the kitchen · ${cart.length} dishes for ${table.code}`); setCart([]); nav({ to: '/w/table/$id', params: { id: String(tableId) } }); },
  });
  const total = cart.reduce((a, l) => a + (l.price ?? 0) * l.qty, 0);
  const byGuest = [...new Set(cart.map((l) => l.guestNo))].sort((a, b) => a - b);
  if (!tables.data || !menu.data) return <Loading />;
  return (
    <>
      <Title title="Take order" sub={table ? `${table.code} · ${table.seats} seats` : 'Pick a table'} />
      <div className="grid gap-y-8 gap-x-0 [&>*]:py-0 [&>*]:px-7 [&>*:first-child]:pl-0 [&>*:last-child]:pr-0 [&>*+*]:border-l [&>*+*]:border-l-line2 phone:[&>*]:p-0! phone:[&>*]:border-l-0! grid-cols-[minmax(0,_1.7fr)_minmax(300px,_1fr)]">
        <div className="flex flex-col gap-4.5">
          <div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)]">{tables.data.tables.map((t: any) => <button key={t.id} className={(tableId === t.id) ? "on" : ""} onClick={() => { setTableId(t.id); setGuests(null); }}>{t.code}{t.state !== 'free' ? ' ·' + t.guests : ''}</button>)}</div>
          {tables.data.tables.length === 0 && <div className="border border-dashed border-edge rounded-[16px] p-5.5 text-dim text-center">No tables assigned to you yet. Ask the manager.</div>}
          {table && <div className="flex items-center gap-4"><span className="text-muted">Guests at {table.code}</span><Stepper value={g} min={1} max={30} onChange={setGuests} /></div>}
          <input className="w-full h-11.5 py-0 px-3.5 rounded-[12px] border border-edge bg-chip text-fg [outline:0] focus:border-blue" placeholder="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)]"><button className={(cat === 'all') ? "on" : ""} onClick={() => setCat('all')}>All</button>{menu.data.map((c: any) => <button key={c.id} className={(cat === c.id) ? "on" : ""} onClick={() => setCat(c.id)}>{c.name}</button>)}</div>
          <div className="grid grid-cols-[repeat(auto-fill,_minmax(190px,_1fr))] gap-2.5">
            {list.map((d: any) => (
              <button key={d.id} className="rounded-[14px] bg-card py-2.5 px-3 flex flex-col justify-between border-0 text-left text-fg stagger [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] hover:[transform:translateY(-2px)] active:[transform:scale(.98)] min-h-21" disabled={!d.available || !table} onClick={() => setPick(d)}>
                <span className="flex gap-2.5 items-start"><span className={(d.veg) ? "w-3 h-3 border-[1.5px] border-green rounded-[2px] inline-flex items-center justify-center flex-none after:content-[''] after:w-1.25 after:h-1.25 after:rounded-[3px] after:bg-green mt-0.75" : "w-3 h-3 border-[1.5px] rounded-[2px] inline-flex items-center justify-center flex-none after:content-[''] after:w-1.25 after:h-1.25 after:rounded-[3px] border-red after:bg-red mt-0.75"} /><span className="font-semibold flex-1 min-w-0">{d.name}</span></span>
                <span className="flex items-center gap-2.5"><span className="text-muted text-[12.5px] flex-1 min-w-0">{d.available ? `${d.prepMinutes} min` : 'Out of stock'}</span>{'price' in d && <span className="font-semibold">{rupees(d.price)}</span>}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3.5">
          <h2 className="mt-0 mx-0 mb-3 font-brand text-[15px] font-bold text-muted flex items-center gap-2 [&_.n]:ml-auto [&_.n]:font-sans [&_.n]:font-semibold">Order{table ? ` · ${table.code}` : ''}<span className="n">{cart.reduce((a, l) => a + l.qty, 0)} items</span></h2>
          {cart.length === 0 && <div className="border border-dashed border-edge rounded-[16px] p-5.5 text-dim text-center">Tap a dish to add it</div>}
          {byGuest.map((gn) => (
            <div key={gn}>
              <div className="text-dim text-[12.5px] font-semibold mb-0.5">{gn ? `Guest ${gn}` : 'Shared'}</div>
              {cart.filter((l) => l.guestNo === gn).map((l) => (
                <div key={l.key} className="flex items-center gap-3.5 py-3.5 px-0 border-b border-b-line stagger last:border-b-0 py-2.5! px-0!">
                  <div className="flex-1 min-w-0"><div className="font-semibold">{l.qty} × {l.name}</div>{(l.spice || l.note || l.options.length > 0) && <div className="text-[12.5px] text-taupe">{[l.spice, ...l.options, l.note].filter(Boolean).join(' · ')}</div>}</div>
                  {l.price != null && <span>{rupees(l.price * l.qty)}</span>}
                  <button className="border-0 bg-transparent p-0 font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] text-red in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]" onClick={() => setCart(cart.filter((x) => x.key !== l.key))}>Remove</button>
                </div>
              ))}
            </div>
          ))}
          {cart.length > 0 && total > 0 && <div className="flex items-center gap-2.5"><span className="text-muted flex-1 min-w-0">Total before tax</span><span className="font-bold text-[18px]">{rupees(total)}</span></div>}
          <ErrorText error={send.error} />
          <button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" disabled={!table || !cart.length || send.isPending} onClick={() => send.mutate()}>{send.isPending ? 'Sending…' : 'Send to kitchen'}</button>
        </div>
      </div>
      {pick && <Customise dish={pick} guests={g} onClose={() => setPick(null)} onAdd={(l) => { setCart([...cart, { ...l, key: Date.now() }]); setPick(null); }} />}
    </>
  );
}

export function Customise({ dish, guests, onClose, onAdd }: { dish: any; guests: number; onClose: () => void; onAdd: (l: Omit<Line, 'key'>) => void }) {
  const [qty, setQty] = useState(1); const [guestNo, setGuestNo] = useState(0);
  const [spice, setSpice] = useState<string | null>(dish.hasSpice ? 'Medium' : null);
  const [options, setOptions] = useState<string[]>([]); const [note, setNote] = useState('');
  return (
    <Modal title={dish.name} onClose={onClose}>
      {dish.description && <div className="text-muted">{dish.description}</div>}
      <div className="flex items-center gap-2.5 justify-between"><span className="text-muted">Quantity</span><Stepper value={qty} min={1} max={50} onChange={setQty} /></div>
      {guests > 0 && <div><div className="text-muted text-[12.5px] mb-2">For</div><div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)]"><button className={(guestNo === 0) ? "on" : ""} onClick={() => setGuestNo(0)}>Shared</button>{Array.from({ length: guests }, (_, i) => i + 1).map((n) => <button key={n} className={(guestNo === n) ? "on" : ""} onClick={() => setGuestNo(n)}>G{n}</button>)}</div></div>}
      {dish.hasSpice && <div><div className="text-muted text-[12.5px] mb-2">Spice level</div><div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)]">{SPICE.map((s) => <button key={s} className={(spice === s) ? "on" : ""} onClick={() => setSpice(s)}>{s}</button>)}</div></div>}
      {dish.options?.length > 0 && <div><div className="text-muted text-[12.5px] mb-2">Options</div><div className="flex gap-2 flex-wrap [&_button]:h-8.5 [&_button]:py-0 [&_button]:px-3.5 [&_button]:rounded-[17px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-muted [&_button]:font-medium [&_button.on]:bg-fg [&_button.on]:text-bg [&_button.on]:border-fg [&_button.on]:font-semibold [&_button]:whitespace-nowrap [&_button]:flex-none [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)]">{dish.options.map((o: string) => <button key={o} className={(options.includes(o)) ? "on" : ""} onClick={() => setOptions(options.includes(o) ? options.filter((x) => x !== o) : [...options, o])}>{o}</button>)}</div></div>}
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">Note for the kitchen<textarea className="w-full rounded-[12px] border border-edge bg-chip text-fg [outline:0] h-auto py-3 px-3.5 resize-y focus:border-blue" rows={2} maxLength={200} placeholder="Less oil, no garlic…" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <button className="py-0 px-4.5 border-0 bg-blue2 text-[#fff] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={() => onAdd({ dishId: dish.id, name: dish.name, price: dish.price, qty, guestNo, spice, options, note })}>Add {qty} to order{dish.price != null ? ' · ' + rupees(dish.price * qty) : ''}</button>
    </Modal>
  );
}

export const myId = () => session.get()?.staff.id;
