import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { api, session, useLive, type Me } from './api';
import { useNotifications } from './notify';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ---------- icons (stroke icons from the design) ----------
const P: Record<string, string> = {
  dash: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  orders: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  kitchen: 'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z',
  tables: 'M3 9h18M5 9v11M19 9v11M8 9V6h8v3',
  billing: 'M3 5h18v14H3zM3 10h18M7 15h4',
  menu: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 8h6',
  staff: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.3 3-5 7-5s7 1.7 7 5M17 11a2.5 2.5 0 1 0 0-5M18 15c2.5.3 4 1.6 4 4',
  analytics: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  settings: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4',
  shifts: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2',
  bell: 'M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 19a2 2 0 0 0 4 0',
  home: 'M3 11.5L12 4l9 7.5M5.5 10v9.5a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V10',
  pen: 'M4 20h4L19 9l-4-4L4 16z',
  plus: 'M12 5v14M5 12h14',
  check: 'M4 12l5 5L20 6',
  box: 'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-3.5 3.5-6 8-6s8 2.5 8 6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  back: 'M19 12H5M11 6l-6 6 6 6',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11',
  phone: 'M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  clock: 'M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9v4l2.5 1.5',
  x: 'M6 6l12 12M18 6L6 18',
  chev: 'M9 6l6 6-6 6',
  hamburger: 'M4 6h16M4 12h16M4 18h16',
  crown: 'M4 18h16M5 18l-1-10 5 4 3-6 3 6 5-4-1 10',
  shield: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z',
  eye: 'M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeoff: 'M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 4l16 16',
};

/** True below 900px (phones and small tablets). Updates when the window is resized. */
const PHONE = '(max-width: 899px)';
export function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE).matches);
  useEffect(() => {
    const q = window.matchMedia(PHONE);
    const on = () => setM(q.matches);
    on(); q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return m;
}
export function Icon({ name, size = 20, sw = 1.75 }: { name: keyof typeof P | string; size?: number; sw?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[name] ?? ''} /></svg>;
}

// ---------- toast ----------
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = (m: string) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), 2800); };
  return <ToastCtx.Provider value={show}>{children}{msg && <div className="fixed left-1/2 bottom-6 [transform:translateX(-50%)] bg-fg text-bg py-3 px-4.5 rounded-[22px] font-semibold z-100 shadow-[0_10px_30px_rgba(0,0,0,.4)] narrow:bottom-24 [animation:toast-up_220ms_var(--ease)]" role="status">{msg}</div>}</ToastCtx.Provider>;
}

// ---------- navigation per role ----------
type NavItem = [icon: string, label: string, to: string] | [section: string];
const NAV: Record<string, NavItem[]> = {
  manager: [['Overview'], ['dash', 'Dashboard', '/dashboard'], ['Service'], ['orders', 'Orders', '/orders'], ['kitchen', 'Kitchen Display', '/kitchen'], ['orders', 'Station queues', '/stations'], ['tables', 'Tables', '/tables'], ['billing', 'Billing', '/billing'],
    ['Manage'], ['menu', 'Menu & Dishes', '/menu'], ['staff', 'Staff & Chefs', '/staff'], ['shifts', 'Shifts & Sections', '/shifts'], ['analytics', 'Analytics', '/analytics'], ['settings', 'Settings', '/settings']],
  admin: [['Overview'], ['dash', 'Dashboard', '/dashboard'], ['Service'], ['orders', 'Orders', '/orders'], ['kitchen', 'Kitchen Display', '/kitchen'], ['orders', 'Station queues', '/stations'], ['tables', 'Tables', '/tables'],
    ['Manage'], ['menu', 'Menu & Dishes', '/menu'], ['staff', 'Staff & Chefs', '/staff'], ['shifts', 'Shifts & Sections', '/shifts'], ['settings', 'Settings', '/settings']],
  waiter: [['Overview'], ['home', 'Home', '/w'], ['Service'], ['tables', 'My tables', '/w/tables'], ['pen', 'Take order', '/w/take-order'], ['Account'], ['bell', 'Alerts', '/w/alerts']],
  chef: [['Kitchen'], ['orders', 'Station queue', '/c'], ['check', 'Done today', '/c/done'], ['box', 'Stock', '/c/stock']],
};
const ROLE_LABEL: Record<string, string> = { owner: 'Owner', manager: 'Manager', admin: 'Admin', waiter: 'Waiter', chef: 'Chef' };
export const homeFor = (role: string) => (role === 'waiter' ? '/w' : role === 'chef' ? '/c' : '/dashboard');

const MeCtx = createContext<Me | null>(null);
export const useMe = () => useContext(MeCtx)!;

// ---------- phone shell (same structure as apps/mobile) ----------
type Tab = { label: string; icon: string; to?: string; profile?: boolean; cta?: boolean };
const PROFILE: Tab = { label: 'Profile', icon: 'user', profile: true };
/** Bottom nav per role, same tabs and order as the app. A tab with no `to` has no web page yet. */
const TABS: Record<string, Tab[]> = {
  manager: [{ label: 'Dashboard', icon: 'dash', to: '/dashboard' }, { label: 'Tables', icon: 'tables', to: '/tables' }, { label: 'Team', icon: 'staff', to: '/staff' }, { label: 'Alerts', icon: 'bell', to: '/notifications' }, { label: 'Profile', icon: 'user', to: '/profile' }],
  waiter: [{ label: 'Home', icon: 'home', to: '/w' }, { label: 'My tables', icon: 'tables', to: '/w/tables' }, { label: 'Order', icon: 'plus', to: '/w/take-order', cta: true }, { label: 'Orders', icon: 'orders', to: '/w/orders' }, { label: 'Profile', icon: 'user', to: '/w/profile' }],
  chef: [{ label: 'Queue', icon: 'kitchen', to: '/c' }, { label: 'Done', icon: 'check', to: '/c/done' }, { label: 'Stock', icon: 'box', to: '/c/stock' }, { label: 'Alerts', icon: 'bell', to: '/c/notifications' }, { label: 'Profile', icon: 'user', to: '/c/profile' }],
};
const tabOn = (t: Tab, path: string) => !!t.to && (path === t.to || (t.to === '/c' && (path.startsWith('/c/station') || path.startsWith('/c/ticket'))) || (t.to === '/w/tables' ? path.startsWith('/w/table') : t.to !== '/w' && t.to !== '/c' && path.startsWith(t.to + '/')));

/** "T1 to T7" for a run of codes, otherwise a comma list */
export function tableRange(codes: string[]) {
  if (!codes.length) return 'No tables';
  const m = codes.map((c) => c.match(/^([A-Za-z]*)(\d+)$/));
  if (codes.length > 1 && m.every(Boolean) && m.every((x) => x![1] === m[0]![1])) {
    const n = m.map((x) => Number(x![2])).sort((a, b) => a - b);
    if (n.every((v, i) => i === 0 || v === n[i - 1] + 1)) return `${m[0]![1]}${n[0]} to ${m[0]![1]}${n[n.length - 1]}`;
  }
  return codes.join(', ');
}

/** My tables, area and break state for the waiter (shared by the phone shell and the waiter pages) */
export function useWaiter(enabled = true) {
  const me = session.get()?.staff;
  const qc = useQueryClient();
  const tables = useQuery({ queryKey: ['tables'], queryFn: () => api('/floor/tables'), enabled });
  const meQ = useQuery({ queryKey: ['me'], queryFn: () => api('/auth/me'), enabled });
  const brk = useMutation({ mutationFn: (onBreak: boolean) => api(`/team/staff/${me!.id}`, { method: 'PATCH', body: { onBreak } }), onSuccess: () => qc.invalidateQueries() });
  const list: any[] = tables.data?.tables ?? [];
  const onBreak: boolean = meQ.data?.staff.onBreak ?? false;
  return { me: me!, tables, list, onBreak, toggleBreak: () => brk.mutate(!onBreak), sub: list.length ? `Tables ${tableRange(list.map((t) => t.code))} · ${list[0].area}` : 'No tables assigned' };
}

/** The shared station queue plus my own state (capacity, break) for the chef (phone shell and chef pages) */
export function useChef(enabled = true) {
  const me = session.get()?.staff;
  const qc = useQueryClient();
  const queue = useQuery({ queryKey: ['queue'], queryFn: () => api('/kitchen/queue'), refetchInterval: 15000, enabled });
  const brk = useMutation({ mutationFn: (onBreak: boolean) => api(`/team/staff/${me!.id}`, { method: 'PATCH', body: { onBreak } }), onSuccess: () => qc.invalidateQueries() });
  const d = queue.data;
  const onBreak: boolean = d?.chefs.find((c: any) => c.id === me?.id)?.onBreak ?? false;
  const limit: number = d?.me?.maxParallel ?? 4;
  const mine: number = d ? d.cooking.filter((i: any) => i.claimedBy === me?.id).length : 0;
  return { me: me!, queue, d, onBreak, limit, mine, full: mine >= limit, toggleBreak: () => brk.mutate(!onBreak), sub: d ? `${d.station.name} station` : ' ' };
}

const C_TABS = ['/c', '/c/done', '/c/stock', '/c/profile'];
const C_NO_NAV = ['/c/ticket'];

// waiter pages: tab pages get the header + nav, detail pages draw their own heading; pages with a sticky action bar hide the nav
const W_TABS = ['/w', '/w/tables', '/w/orders', '/w/profile'];
const W_NO_NAV = ['/w/take-order', '/w/bill', '/w/table', '/w/alerts'];

function MobileShell({ me, online, path, logout, children }: { me: Me; online: boolean; path: string; logout: () => void; children: ReactNode }) {
  const nav = useNavigate();
  const toast = useToast();
  const [drawer, setDrawer] = useState(false);
  const [profile, setProfile] = useState(false);
  useEffect(() => { setDrawer(false); setProfile(false); }, [path]);
  const floor = me.role === 'waiter' || me.role === 'chef';
  const { unread } = useNotifications(!floor);
  const waiter = me.role === 'waiter';
  const w = useWaiter(waiter);
  const chef = me.role === 'chef';
  const c = useChef(chef);
  const duty = waiter ? w : c;
  const bare = waiter ? !W_TABS.includes(path) : chef ? !C_TABS.includes(path) : !floor && path !== '/dashboard'; // detail pages have no top bar: the page draws its own heading
  const noNav = (waiter && W_NO_NAV.some((x) => path === x || path.startsWith(x + '/'))) || (chef && C_NO_NAV.some((x) => path === x || path.startsWith(x + '/')));
  const items = NAV[me.role === 'owner' ? 'manager' : me.role];
  const here = items.find((it) => it.length > 1 && (path === it[2] || path.startsWith(it[2] + '/'))) as [string, string, string] | undefined;
  const label = here?.[1] ?? (path.startsWith('/w/table') ? 'Table' : 'Home');
  const home = path === homeFor(me.role);
  const tabs = TABS[floor ? me.role : 'manager'];
  const sub = floor ? (me.role === 'waiter' ? 'Waiter' : 'Chef') + ' · ' + label : ROLE_LABEL[me.role] + ' · Spice Garden';
  const goTab = (t: Tab) => { if (t.profile && !t.to) setProfile(true); else if (t.to) nav({ to: t.to }); else toast(`${t.label} on phones is coming soon`); };
  return (
    <div className={(noNav) ? "min-h-dvh flex flex-col [&_.mchip.lg]:min-h-11 [&_.chips_button]:relative [&_.wfor_button]:relative [&_.wstep_button]:relative [&_.stepper_button]:relative [&_.mstep_button]:relative [&_.chips_button::after]:content-[''] [&_.chips_button::after]:absolute [&_.chips_button::after]:left-1/2 [&_.chips_button::after]:top-1/2 [&_.chips_button::after]:w-[max(100%,_44px)] [&_.chips_button::after]:h-[max(100%,_44px)] [&_.chips_button::after]:[transform:translate(-50%,_-50%)] [&_.wfor_button::after]:content-[''] [&_.wfor_button::after]:absolute [&_.wfor_button::after]:left-1/2 [&_.wfor_button::after]:top-1/2 [&_.wfor_button::after]:w-[max(100%,_44px)] [&_.wfor_button::after]:h-[max(100%,_44px)] [&_.wfor_button::after]:[transform:translate(-50%,_-50%)] [&_.wstep_button::after]:content-[''] [&_.wstep_button::after]:absolute [&_.wstep_button::after]:left-1/2 [&_.wstep_button::after]:top-1/2 [&_.wstep_button::after]:w-[max(100%,_44px)] [&_.wstep_button::after]:h-[max(100%,_44px)] [&_.wstep_button::after]:[transform:translate(-50%,_-50%)] [&_.stepper_button::after]:content-[''] [&_.stepper_button::after]:absolute [&_.stepper_button::after]:left-1/2 [&_.stepper_button::after]:top-1/2 [&_.stepper_button::after]:w-[max(100%,_44px)] [&_.stepper_button::after]:h-[max(100%,_44px)] [&_.stepper_button::after]:[transform:translate(-50%,_-50%)] [&_.mstep_button::after]:content-[''] [&_.mstep_button::after]:absolute [&_.mstep_button::after]:left-1/2 [&_.mstep_button::after]:top-1/2 [&_.mstep_button::after]:w-[max(100%,_44px)] [&_.mstep_button::after]:h-[max(100%,_44px)] [&_.mstep_button::after]:[transform:translate(-50%,_-50%)] [&_.tabs_button]:min-w-11 [&_.wsearch_input]:h-11 m-app nonav" : "min-h-dvh flex flex-col [&_.mchip.lg]:min-h-11 [&_.chips_button]:relative [&_.wfor_button]:relative [&_.wstep_button]:relative [&_.stepper_button]:relative [&_.mstep_button]:relative [&_.chips_button::after]:content-[''] [&_.chips_button::after]:absolute [&_.chips_button::after]:left-1/2 [&_.chips_button::after]:top-1/2 [&_.chips_button::after]:w-[max(100%,_44px)] [&_.chips_button::after]:h-[max(100%,_44px)] [&_.chips_button::after]:[transform:translate(-50%,_-50%)] [&_.wfor_button::after]:content-[''] [&_.wfor_button::after]:absolute [&_.wfor_button::after]:left-1/2 [&_.wfor_button::after]:top-1/2 [&_.wfor_button::after]:w-[max(100%,_44px)] [&_.wfor_button::after]:h-[max(100%,_44px)] [&_.wfor_button::after]:[transform:translate(-50%,_-50%)] [&_.wstep_button::after]:content-[''] [&_.wstep_button::after]:absolute [&_.wstep_button::after]:left-1/2 [&_.wstep_button::after]:top-1/2 [&_.wstep_button::after]:w-[max(100%,_44px)] [&_.wstep_button::after]:h-[max(100%,_44px)] [&_.wstep_button::after]:[transform:translate(-50%,_-50%)] [&_.stepper_button::after]:content-[''] [&_.stepper_button::after]:absolute [&_.stepper_button::after]:left-1/2 [&_.stepper_button::after]:top-1/2 [&_.stepper_button::after]:w-[max(100%,_44px)] [&_.stepper_button::after]:h-[max(100%,_44px)] [&_.stepper_button::after]:[transform:translate(-50%,_-50%)] [&_.mstep_button::after]:content-[''] [&_.mstep_button::after]:absolute [&_.mstep_button::after]:left-1/2 [&_.mstep_button::after]:top-1/2 [&_.mstep_button::after]:w-[max(100%,_44px)] [&_.mstep_button::after]:h-[max(100%,_44px)] [&_.mstep_button::after]:[transform:translate(-50%,_-50%)] [&_.tabs_button]:min-w-11 [&_.wsearch_input]:h-11 m-app"}>
      {!bare && (
        <header className="sticky top-0 z-20 flex-none h-[calc(56px_+_env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] pr-3 pb-0 pl-1 flex items-center gap-2 bg-bg print:hidden!">
          {floor
            ? <button className="w-11 h-11 flex-none flex items-center justify-center border-0 p-0 bg-transparent rounded-[22px] text-fg [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.94)]" aria-label="Profile" onClick={() => nav({ to: waiter ? '/w/profile' : '/c/profile' })}><span className="w-9 h-9 rounded-[18px] bg-chip2 flex items-center justify-center font-semibold flex-none">{me.name[0]}</span></button>
            : <button className="w-11 h-11 flex-none flex items-center justify-center border-0 p-0 bg-transparent rounded-[22px] text-fg [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.94)]" aria-label="Open menu" onClick={() => setDrawer(true)}><Icon name="hamburger" size={22} /></button>}
          {floor
            ? <div className="flex-1 min-w-0"><div className="whitespace-nowrap overflow-hidden text-ellipsis text-[16px] font-bold">{me.name}</div><div className="text-muted text-[12.5px] whitespace-nowrap overflow-hidden text-ellipsis">{waiter ? w.sub : chef ? c.sub : sub}</div></div>
            : <span className="font-brand font-bold flex-1 text-center text-[20px] in-[.top]:text-[22px]">DineOS</span>}
          {floor
            ? <button className="h-8.5 py-0 px-3 flex items-center gap-1.5 border-0 bg-transparent text-[12.5px] font-semibold in-[.m-app]:min-h-11" onClick={duty.toggleBreak} style={{ color: duty.onBreak ? '#f5c27a' : '#7fcfa3' }}><span className="w-2 h-2 rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)]" style={{ background: duty.onBreak ? 'var(--color-amber)' : 'var(--color-green)' }} />{duty.onBreak ? 'On break' : 'On duty'}</button>
            : <span className="flex items-center gap-1.5 text-[13px] font-semibold text-muted" aria-label={online ? 'Live' : 'Connecting'}><span className="w-2 h-2 rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)]" style={{ background: online ? 'var(--color-green)' : 'var(--color-amber)' }} /></span>}
          {!floor && <button className="w-11 h-11 flex-none flex items-center justify-center border-0 p-0 bg-transparent rounded-[22px] text-fg [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.94)] relative!" aria-label="Notifications" onClick={() => nav({ to: '/notifications' })}><Icon name="bell" size={22} />{unread > 0 && <span className="absolute top-2.5 right-2.75 w-2 h-2 rounded-[4px] bg-blue2" />}</button>}
        </header>
      )}
      <main key={path} className={(bare) ? "flex-1 min-w-0 px-4 pb-[calc(96px_+_env(safe-area-inset-bottom))] flex flex-col gap-5.5 [animation:page-in_220ms_var(--ease)_backwards] pt-[calc(12px_+_env(safe-area-inset-top))] in-[.m-app.nonav]:pb-[calc(24px_+_env(safe-area-inset-bottom))]" : "flex-1 min-w-0 pt-3 px-4 pb-[calc(96px_+_env(safe-area-inset-bottom))] flex flex-col gap-5.5 [animation:page-in_220ms_var(--ease)_backwards] in-[.m-app.nonav]:pb-[calc(24px_+_env(safe-area-inset-bottom))]"}>
        {!home && !bare && !floor && <button className="flex items-center border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] self-start gap-1.5 -mb-2 in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)]" onClick={() => window.history.length > 1 ? window.history.back() : nav({ to: homeFor(me.role) })}><Icon name="back" size={18} />Back</button>}
        {children}
      </main>
      {!noNav && <nav className="fixed left-0 right-0 bottom-0 z-30 pt-2 px-4 pb-[calc(14px_+_env(safe-area-inset-bottom))] bg-bg print:hidden! [&>div]:h-14.5 [&>div]:rounded-[29px] [&>div]:bg-chip [&>div]:p-1.25 [&>div]:flex [&>div]:gap-1 [&_button]:flex-1 [&_button]:h-12 [&_button]:border-0 [&_button]:rounded-[24px] [&_button]:bg-transparent [&_button]:text-muted [&_button]:flex [&_button]:items-center [&_button]:justify-center [&_button]:gap-1 [&_button]:p-0 [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease)] [&_button.on]:bg-[#2c2c31] [&_button.on]:text-fg [&_button.cta]:flex-[1.3] [&_button.cta]:bg-blue2 [&_button.cta]:text-[#fff] [&_button.cta]:font-bold [&_button.cta]:text-[13px] [&_button:active]:[transform:scale(.96)]" aria-label="Main">
        <div>
          {tabs.map((t) => (
            <button key={t.label} aria-label={t.cta ? 'Take order' : t.label} aria-current={tabOn(t, path) ? 'page' : undefined} className={(t.cta) ? ((tabOn(t, path) || (t.profile && profile)) ? "cta on" : "cta") : ((tabOn(t, path) || (t.profile && profile)) ? "on" : "")} onClick={() => goTab(t)}>
              {t.profile ? <span className="bg-chip2 flex items-center justify-center font-semibold flex-none w-6.5 h-6.5 rounded-[13px] text-[12px]">{me.name[0]}</span> : <Icon name={t.icon} size={t.cta ? 20 : 22} sw={t.cta ? 2.4 : 1.75} />}
              {t.cta && <span>{t.label}</span>}
            </button>
          ))}
        </div>
      </nav>}

      {drawer && (
        <div className="fixed inset-0 z-50 bg-bg flex flex-col [animation:fade_var(--t-base)_var(--ease)]" role="dialog" aria-label="Menu">
          <header className="sticky top-0 z-20 flex-none h-[calc(56px_+_env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] pr-3 pb-0 pl-1 flex items-center gap-2 bg-bg print:hidden!">
            <button className="w-11 h-11 flex-none flex items-center justify-center border-0 p-0 bg-transparent rounded-[22px] text-fg [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.94)]" aria-label="Close menu" onClick={() => setDrawer(false)}><Icon name="x" size={22} /></button>
            <span className="font-brand font-bold flex-1 text-center text-[20px] in-[.top]:text-[22px]">DineOS</span><span className="w-11 h-11 flex-none flex items-center justify-center border-0 p-0 bg-transparent rounded-[22px] text-fg [transition:transform_var(--t-fast)_var(--ease)] active:[transform:scale(.94)]" />
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto pt-1 px-3 pb-[calc(16px_+_env(safe-area-inset-bottom))] flex flex-col">
            <button className="flex items-center gap-3 p-3 border-0 rounded-[16px] bg-card text-left text-fg" onClick={() => { setDrawer(false); if (floor) setProfile(true); else nav({ to: '/profile' }); }}>
              <span className="bg-chip2 flex items-center justify-center flex-none w-11 h-11 rounded-[22px] text-[16px] font-bold">{me.name[0]}</span>
              <span className="flex-1 min-w-0"><span className="font-semibold block">{me.name}</span><span className="text-muted text-[12.5px]">{ROLE_LABEL[me.role]} · Spice Garden</span></span>
              <Icon name="chev" size={16} />
            </button>
            {items.filter((it) => it.length === 1 || it[2] !== '/stations').map((it, i) => it.length === 1
              ? <div key={i} className="font-brand text-[12px] font-bold text-dim pt-4 px-3 pb-1.5">{it[0]}</div>
              : <Link key={i} to={it[2]} className={(path === it[2] || path.startsWith(it[2] + '/')) ? "flex items-center gap-3.5 h-13 py-0 px-3 border-0 rounded-[14px] text-[16px] [transition:background-color_var(--t-base)_var(--ease),_transform_var(--t-fast)_var(--ease)] text-blue bg-chip font-semibold active:[transform:scale(.98)] on" : "flex items-center gap-3.5 h-13 py-0 px-3 border-0 rounded-[14px] bg-transparent text-[16px] font-medium text-muted [transition:background-color_var(--t-base)_var(--ease),_transform_var(--t-fast)_var(--ease)] active:[transform:scale(.98)]"}><Icon name={it[0]} size={22} />{it[1]}</Link>)}
            <button className="flex items-center gap-3.5 h-13 py-0 px-3 border-0 rounded-[14px] bg-transparent text-[16px] text-muted [transition:background-color_var(--t-base)_var(--ease),_transform_var(--t-fast)_var(--ease)] mt-auto font-semibold active:[transform:scale(.98)]" onClick={logout}>Sign out</button>
          </div>
        </div>
      )}
      {profile && !floor && (
        <Modal title="Profile" onClose={() => setProfile(false)}>
          <div className="flex items-center gap-2.5"><span className="bg-chip2 flex items-center justify-center flex-none w-11 h-11 rounded-[22px] text-[16px] font-bold">{me.name[0]}</span><div><div className="font-semibold">{me.name}</div><div className="text-muted text-[12.5px]">{floor ? ROLE_LABEL[me.role] : ROLE_LABEL[me.role] + ' · Spice Garden'}</div></div></div>
          {!floor && <Link to="/settings" className="py-0 px-4.5 font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] bg-transparent border border-edge text-fg w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11">Settings</Link>}
          <button className="py-0 px-4.5 font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] bg-transparent border border-edge text-red w-full h-12 rounded-[24px] text-[15px] active:enabled:[transform:scale(.98)] in-[.m-app]:min-h-11" onClick={logout}>Log out</button>
        </Modal>
      )}
    </div>
  );
}

export function Shell({ children, roles }: { children: ReactNode; roles: string[] }) {
  const s = session.get();
  const nav = useNavigate();
  const mobile = useIsMobile();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const online = useLive(s?.token);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!s) nav({ to: '/login' });
    else if (!roles.includes(s.staff.role)) nav({ to: homeFor(s.staff.role) });
  }, []);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.menu-wrap')) setOpen(false); };
    document.addEventListener('click', close); return () => document.removeEventListener('click', close);
  }, []);
  if (!s || !roles.includes(s.staff.role)) return null;
  const me = s.staff;
  const items = NAV[me.role === 'owner' ? 'manager' : me.role];
  const logout = async () => { await api('/auth/logout', { body: {} }).catch(() => {}); session.clear(); nav({ to: '/login' }); };
  const sub = me.role === 'waiter' ? 'Waiter' : me.role === 'chef' ? 'Chef' : ROLE_LABEL[me.role] + ' · Spice Garden';
  if (mobile) return <MeCtx.Provider value={me}><MobileShell me={me} online={online} path={path} logout={logout}>{children}</MobileShell></MeCtx.Provider>;
  return (
    <MeCtx.Provider value={me}>
      <header className="h-16 py-0 px-6 flex items-center gap-3.5 sticky top-0 bg-bg z-20 phone:py-0 phone:px-3 [&_.role]:text-muted [&_.role]:text-[15px] [&_.role]:font-semibold top">
        <Link to={homeFor(me.role)} className="font-brand font-bold in-[.top]:text-[22px]">DineOS</Link>
        <span className="role">{ROLE_LABEL[me.role]}</span>
        <span className="flex-1 min-w-0" />
        {['owner', 'manager', 'admin'].includes(me.role) && <label className="flex items-center gap-2 h-10 w-80 max-w-[36vw] py-0 px-3.5 rounded-[20px] bg-chip text-muted phone:hidden [&_input]:flex-1 [&_input]:min-w-0 [&_input]:border-0 [&_input]:[outline:0] [&_input]:bg-transparent"><Icon name="search" size={18} /><input type="search" aria-label="Search" placeholder="Search orders, dishes, tables" onKeyDown={(e) => { if (e.key === 'Enter') nav({ to: '/orders', search: { q: (e.target as HTMLInputElement).value } as any }); }} /></label>}
        <span className="flex-1 min-w-0" />
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-muted"><span className="w-2 h-2 rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)]" style={{ background: online ? 'var(--color-green)' : 'var(--color-amber)' }} />{online ? 'Live' : 'Connecting'}</span>
        {me.role === 'waiter' && <Link to="/w/alerts" className="w-11 h-11 flex items-center justify-center border-0 bg-transparent relative rounded-[22px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_.badge]:absolute [&_.badge]:top-2.75 [&_.badge]:right-3 [&_.badge]:w-2 [&_.badge]:h-2 [&_.badge]:rounded-[4px] [&_.badge]:bg-blue2 active:[transform:scale(.98)]" aria-label="Alerts"><Icon name="bell" size={22} /></Link>}
        <div className="relative [&>button]:border-0 [&>button]:p-0 [&>button]:bg-transparent">
          <button onClick={() => setOpen(!open)} aria-label="Account menu" aria-expanded={open}><span className="w-9 h-9 rounded-[18px] bg-chip2 flex items-center justify-center font-semibold flex-none">{me.name[0]}</span></button>
          {open && (
            <div className="absolute right-0 top-11.5 w-60 p-1.5 rounded-[14px] bg-card border border-line2 shadow-[0_12px_32px_rgba(0,0,0,.5)] z-40 [&_.who]:pt-2.5 [&_.who]:px-3 [&_.who]:pb-3 [&_.who]:border-b [&_.who]:border-b-line2 [&_.who]:mb-1.5 [&_a]:flex [&_a]:items-center [&_a]:gap-2.5 [&_a]:w-full [&_a]:h-10 [&_a]:py-0 [&_a]:px-3 [&_a]:rounded-[8px] [&_a]:border-0 [&_a]:bg-transparent [&_a]:text-[14px] [&_a]:text-left [&_button.item]:flex [&_button.item]:items-center [&_button.item]:gap-2.5 [&_button.item]:w-full [&_button.item]:h-10 [&_button.item]:py-0 [&_button.item]:px-3 [&_button.item]:rounded-[8px] [&_button.item]:border-0 [&_button.item]:bg-transparent [&_button.item]:text-[14px] [&_button.item]:text-left [&_a:hover]:bg-chip [&_button.item:hover]:bg-chip [&_hr]:border-0 [&_hr]:h-0.25 [&_hr]:bg-line2 [&_hr]:my-1.5 [&_hr]:mx-0" role="menu">
              <div className="who"><div className="font-semibold">{me.name}</div><div className="text-dim text-[12.5px]">{sub}</div></div>
              {['owner', 'manager', 'admin'].includes(me.role) && <Link to="/settings"><Icon name="settings" size={18} />Settings</Link>}
              <hr />
              <button className="text-red item" onClick={logout}><Icon name="logout" size={18} />Log out</button>
            </div>
          )}
        </div>
      </header>
      <div className="flex items-start phone:flex-col">
        <nav className="flex-none w-59 pt-2 px-3 pb-6 sticky top-16 phone:w-full phone:static phone:flex phone:overflow-x-auto phone:gap-1 phone:py-0 phone:px-3 [&_.sec]:font-brand [&_.sec]:text-[12px] [&_.sec]:font-bold [&_.sec]:text-dim [&_.sec]:pt-3.5 [&_.sec]:px-3.5 [&_.sec]:pb-1.5 [&_a]:flex [&_a]:items-center [&_a]:gap-3 [&_a]:h-11 [&_a]:py-0 [&_a]:px-3.5 [&_a]:rounded-[12px] [&_a]:text-[14.5px] [&_a]:font-medium [&_a]:text-muted [&_a:hover]:text-fg [&_a.active]:text-blue [&_a.active]:bg-chip [&_a.active]:font-semibold [&_a_.count]:ml-auto [&_a_.count]:text-[12.5px] [&_a_.count]:text-blue [&_a_.count]:font-semibold phone:[&_.sec]:hidden phone:[&_a]:flex-none phone:[&_a]:h-10 [&_a]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)]" aria-label="Main">
          {items.map((it, i) => it.length === 1
            ? <div key={i} className="sec">{it[0]}</div>
            : <Link key={i} to={it[2]} className={(path === it[2] || (it[2] !== '/w' && it[2] !== '/c' && path.startsWith(it[2] + '/'))) ? "active" : ""}><Icon name={it[0]} />{it[1]}</Link>)}
        </nav>
        <main key={path} className="flex-1 min-w-0 pt-6 px-10 pb-16 max-w-305 flex flex-col gap-7 phone:pt-4 phone:px-4 phone:pb-12 [animation:page-in_220ms_var(--ease)_backwards]">
          {path !== homeFor(me.role) && <button className="flex items-center border-0 bg-transparent p-0 text-blue font-semibold text-[13.5px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] in-[.m-app]:relative in-[.m-app]:after:content-[''] in-[.m-app]:after:absolute in-[.m-app]:after:left-1/2 in-[.m-app]:after:top-1/2 in-[.m-app]:after:w-[max(100%,_44px)] in-[.m-app]:after:h-[max(100%,_44px)] in-[.m-app]:after:[transform:translate(-50%,_-50%)] gap-1.5 mb-2.5" onClick={() => window.history.length > 1 ? window.history.back() : nav({ to: homeFor(me.role) })}><Icon name="back" size={18} />Back</button>}
          {children}
        </main>
      </div>
    </MeCtx.Provider>
  );
}

export function Title({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="m-0 text-[30px] font-bold tracking-[-.4px] phone:text-[26px]">{title}</h1>{sub && <div className="text-muted text-[13.5px] mt-0.5">{sub}</div>}</div>{right}</div>;
}

export function Sec({ title, n, children, right }: { title: string; n?: ReactNode; children?: ReactNode; right?: ReactNode }) {
  return <section><h2 className="mt-0 mx-0 mb-3 font-brand text-[15px] font-bold text-muted flex items-center gap-2 [&_.n]:ml-auto [&_.n]:font-sans [&_.n]:font-semibold">{title}{n !== undefined && <span className="n">{n}</span>}{right && <span style={{ marginLeft: n === undefined ? 'auto' : 12 }}>{right}</span>}</h2>{children}</section>;
}

export function Stepper({ value, onChange, min = 1, max = 99, fmt }: { value: number; onChange: (v: number) => void; min?: number; max?: number; fmt?: (v: number) => string }) {
  return <span className="inline-flex items-center gap-0.5 [&_button]:w-8 [&_button]:h-8 [&_button]:rounded-[16px] [&_button]:border [&_button]:border-edge [&_button]:bg-transparent [&_button]:text-[16px] [&_span]:min-w-10 [&_span]:text-center [&_span]:font-bold [&_button]:[transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_button:active]:[transform:scale(.98)] stepper"><button type="button" aria-label="Less" onClick={() => onChange(Math.max(min, value - 1))}>−</button><span>{fmt ? fmt(value) : value}</span><button type="button" aria-label="More" onClick={() => onChange(Math.min(max, value + 1))}>+</button></span>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="fixed inset-0 bg-[rgba(0,0,0,.6)] flex items-center justify-center z-60 p-4 [animation:fade_var(--t-base)_var(--ease)] phone:items-end" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[min(520px,_100%)] max-h-[92vh] overflow-auto bg-card border border-line2 rounded-[20px] p-5.5 flex flex-col gap-4 [animation:pop_var(--t-base)_var(--ease)] phone:[animation:sheet-up_250ms_var(--ease)]" role="dialog" aria-label={title}>
        <div className="flex items-center gap-2.5"><h2 className="flex-1 min-w-0 m-0 text-[20px]">{title}</h2><button className="w-11 h-11 flex items-center justify-center border-0 bg-transparent relative rounded-[22px] [transition:transform_var(--t-fast)_var(--ease),_background-color_var(--t-base)_var(--ease),_color_var(--t-base)_var(--ease),_border-color_var(--t-base)_var(--ease),_box-shadow_var(--t-base)_var(--ease)] [&_.badge]:absolute [&_.badge]:top-2.75 [&_.badge]:right-3 [&_.badge]:w-2 [&_.badge]:h-2 [&_.badge]:rounded-[4px] [&_.badge]:bg-blue2 active:[transform:scale(.98)]" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        {children}
      </div>
    </div>
  );
}

/** Status dot: colour fades; when `ready` (food ready / new alert) it pulses once. Remounts on change so the pulse replays. */
export function StatusDot({ color, ready }: { color: string; ready?: boolean }) {
  return <span key={String(!!ready)} className={(ready) ? "w-2 h-2 rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)] [animation:pulse_500ms_var(--ease)_1]" : "w-2 h-2 rounded-[4px] inline-block flex-none [transition:background-color_var(--t-base)_var(--ease)]"} style={{ background: color }} />;
}

export const Loading = () => <div className="text-dim">Loading…</div>;
export const ErrorText = ({ error }: { error: unknown }) => error ? <div className="text-red text-[13.5px]">{(error as Error).message}</div> : null;

export const STATUS_COLOR: Record<string, string> = { waiting: 'var(--color-muted)', cooking: 'var(--color-amber)', ready: 'var(--color-green)', served: 'var(--color-blue)', cancelled: 'var(--color-red)' };
export const TABLE_STATE: Record<string, [string, string]> = {
  free: ['Free', '#3a3a40'], seated: ['Seated', 'var(--color-blue)'], eating: ['Food on the way', 'var(--color-amber)'], ready: ['Food ready', 'var(--color-green)'], served: ['Eating', 'var(--color-taupe)'], billing: ['Bill asked', 'var(--color-red)'],
};
export const ago = (d: string | Date | null) => { if (!d) return ''; const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
export const mins = (d: string | Date | null) => (d ? Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000)) : 0);
