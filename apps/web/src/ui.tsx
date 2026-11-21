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
  return <ToastCtx.Provider value={show}>{children}{msg && <div className="toast" role="status">{msg}</div>}</ToastCtx.Provider>;
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
    <div className={'m-app' + (noNav ? ' nonav' : '')}>
      {!bare && (
        <header className="m-top">
          {floor
            ? <button className="m-ibtn" aria-label="Profile" onClick={() => nav({ to: waiter ? '/w/profile' : '/c/profile' })}><span className="avatar">{me.name[0]}</span></button>
            : <button className="m-ibtn" aria-label="Open menu" onClick={() => setDrawer(true)}><Icon name="hamburger" size={22} /></button>}
          {floor
            ? <div className="grow"><div className="m-title ellipsis">{me.name}</div><div className="muted small ellipsis">{waiter ? w.sub : chef ? c.sub : sub}</div></div>
            : <span className="brand m-brand">DineOS</span>}
          {floor
            ? <button className="m-duty" onClick={duty.toggleBreak} style={{ color: duty.onBreak ? '#f5c27a' : '#7fcfa3' }}><span className="dot" style={{ background: duty.onBreak ? 'var(--amber)' : 'var(--green)' }} />{duty.onBreak ? 'On break' : 'On duty'}</button>
            : <span className="live" aria-label={online ? 'Live' : 'Connecting'}><span className="dot" style={{ background: online ? 'var(--green)' : 'var(--amber)' }} /></span>}
          {!floor && <button className="m-ibtn" aria-label="Notifications" onClick={() => nav({ to: '/notifications' })} style={{ position: 'relative' }}><Icon name="bell" size={22} />{unread > 0 && <span className="m-badge" />}</button>}
        </header>
      )}
      <main key={path} className={'m-main' + (bare ? ' bare' : '')}>
        {!home && !bare && !floor && <button className="link row-flex m-back" onClick={() => window.history.length > 1 ? window.history.back() : nav({ to: homeFor(me.role) })}><Icon name="back" size={18} />Back</button>}
        {children}
      </main>
      {!noNav && <nav className="m-nav" aria-label="Main">
        <div>
          {tabs.map((t) => (
            <button key={t.label} aria-label={t.cta ? 'Take order' : t.label} aria-current={tabOn(t, path) ? 'page' : undefined} className={(t.cta ? 'cta ' : '') + (tabOn(t, path) || (t.profile && profile) ? 'on' : '')} onClick={() => goTab(t)}>
              {t.profile ? <span className="avatar sm">{me.name[0]}</span> : <Icon name={t.icon} size={t.cta ? 20 : 22} sw={t.cta ? 2.4 : 1.75} />}
              {t.cta && <span>{t.label}</span>}
            </button>
          ))}
        </div>
      </nav>}

      {drawer && (
        <div className="m-drawer" role="dialog" aria-label="Menu">
          <header className="m-top">
            <button className="m-ibtn" aria-label="Close menu" onClick={() => setDrawer(false)}><Icon name="x" size={22} /></button>
            <span className="brand m-brand">DineOS</span><span className="m-ibtn" />
          </header>
          <div className="m-drawer-body">
            <button className="m-who" onClick={() => { setDrawer(false); if (floor) setProfile(true); else nav({ to: '/profile' }); }}>
              <span className="avatar big">{me.name[0]}</span>
              <span className="grow"><span className="b" style={{ display: 'block' }}>{me.name}</span><span className="muted small">{ROLE_LABEL[me.role]} · Spice Garden</span></span>
              <Icon name="chev" size={16} />
            </button>
            {items.filter((it) => it.length === 1 || it[2] !== '/stations').map((it, i) => it.length === 1
              ? <div key={i} className="m-sec">{it[0]}</div>
              : <Link key={i} to={it[2]} className={'m-item' + (path === it[2] || path.startsWith(it[2] + '/') ? ' on' : '')}><Icon name={it[0]} size={22} />{it[1]}</Link>)}
            <button className="m-item red m-out" onClick={logout}>Sign out</button>
          </div>
        </div>
      )}
      {profile && !floor && (
        <Modal title="Profile" onClose={() => setProfile(false)}>
          <div className="row-flex"><span className="avatar big">{me.name[0]}</span><div><div className="b">{me.name}</div><div className="muted small">{floor ? ROLE_LABEL[me.role] : ROLE_LABEL[me.role] + ' · Spice Garden'}</div></div></div>
          {!floor && <Link to="/settings" className="btn ghost block">Settings</Link>}
          <button className="btn danger block" onClick={logout}>Log out</button>
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
      <header className="top">
        <Link to={homeFor(me.role)} className="brand">DineOS</Link>
        <span className="role">{ROLE_LABEL[me.role]}</span>
        <span className="grow" />
        {['owner', 'manager', 'admin'].includes(me.role) && <label className="search"><Icon name="search" size={18} /><input type="search" aria-label="Search" placeholder="Search orders, dishes, tables" onKeyDown={(e) => { if (e.key === 'Enter') nav({ to: '/orders', search: { q: (e.target as HTMLInputElement).value } as any }); }} /></label>}
        <span className="grow" />
        <span className="live"><span className="dot" style={{ background: online ? 'var(--green)' : 'var(--amber)' }} />{online ? 'Live' : 'Connecting'}</span>
        {me.role === 'waiter' && <Link to="/w/alerts" className="iconbtn" aria-label="Alerts"><Icon name="bell" size={22} /></Link>}
        <div className="menu-wrap">
          <button onClick={() => setOpen(!open)} aria-label="Account menu" aria-expanded={open}><span className="avatar">{me.name[0]}</span></button>
          {open && (
            <div className="menu" role="menu">
              <div className="who"><div className="b">{me.name}</div><div className="dim small">{sub}</div></div>
              {['owner', 'manager', 'admin'].includes(me.role) && <Link to="/settings"><Icon name="settings" size={18} />Settings</Link>}
              <hr />
              <button className="item red" onClick={logout}><Icon name="logout" size={18} />Log out</button>
            </div>
          )}
        </div>
      </header>
      <div className="layout">
        <nav className="side" aria-label="Main">
          {items.map((it, i) => it.length === 1
            ? <div key={i} className="sec">{it[0]}</div>
            : <Link key={i} to={it[2]} className={path === it[2] || (it[2] !== '/w' && it[2] !== '/c' && path.startsWith(it[2] + '/')) ? 'active' : ''}><Icon name={it[0]} />{it[1]}</Link>)}
        </nav>
        <main key={path} className="main">
          {path !== homeFor(me.role) && <button className="link row-flex" style={{ gap: 6, marginBottom: 10 }} onClick={() => window.history.length > 1 ? window.history.back() : nav({ to: homeFor(me.role) })}><Icon name="back" size={18} />Back</button>}
          {children}
        </main>
      </div>
    </MeCtx.Provider>
  );
}

export function Title({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return <div className="title-row"><div><h1 className="title">{title}</h1>{sub && <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>{sub}</div>}</div>{right}</div>;
}

export function Sec({ title, n, children, right }: { title: string; n?: ReactNode; children?: ReactNode; right?: ReactNode }) {
  return <section><h2 className="sec-h">{title}{n !== undefined && <span className="n">{n}</span>}{right && <span style={{ marginLeft: n === undefined ? 'auto' : 12 }}>{right}</span>}</h2>{children}</section>;
}

export function Stepper({ value, onChange, min = 1, max = 99, fmt }: { value: number; onChange: (v: number) => void; min?: number; max?: number; fmt?: (v: number) => string }) {
  return <span className="stepper"><button type="button" aria-label="Less" onClick={() => onChange(Math.max(min, value - 1))}>−</button><span>{fmt ? fmt(value) : value}</span><button type="button" aria-label="More" onClick={() => onChange(Math.min(max, value + 1))}>+</button></span>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="row-flex"><h2 style={{ margin: 0, fontSize: 20 }} className="grow">{title}</h2><button className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        {children}
      </div>
    </div>
  );
}

/** Status dot: colour fades; when `ready` (food ready / new alert) it pulses once. Remounts on change so the pulse replays. */
export function StatusDot({ color, ready }: { color: string; ready?: boolean }) {
  return <span key={String(!!ready)} className={ready ? 'dot pulse' : 'dot'} style={{ background: color }} />;
}

export const Loading = () => <div className="dim">Loading…</div>;
export const ErrorText = ({ error }: { error: unknown }) => error ? <div className="err">{(error as Error).message}</div> : null;

export const STATUS_COLOR: Record<string, string> = { waiting: 'var(--muted)', cooking: 'var(--amber)', ready: 'var(--green)', served: 'var(--blue)', cancelled: 'var(--red)' };
export const TABLE_STATE: Record<string, [string, string]> = {
  free: ['Free', '#3a3a40'], seated: ['Seated', 'var(--blue)'], eating: ['Food on the way', 'var(--amber)'], ready: ['Food ready', 'var(--green)'], served: ['Eating', 'var(--taupe)'], billing: ['Bill asked', 'var(--red)'],
};
export const ago = (d: string | Date | null) => { if (!d) return ''; const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
export const mins = (d: string | Date | null) => (d ? Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000)) : 0);
