import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { api, session, useLive, type Me } from './api';

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
};
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

export function Shell({ children, roles }: { children: ReactNode; roles: string[] }) {
  const s = session.get();
  const nav = useNavigate();
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
