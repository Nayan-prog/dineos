import { useEffect, useState } from 'react';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@dineos/shared';

export const API = import.meta.env.VITE_API_URL ?? '/api';

export type Me = { id: number; name: string; role: Role; stationId: number | null; areaId: number | null; maxParallel: number; onBreak: boolean; restaurantId: number };

const KEY = 'dineos.staff';
const GKEY = 'dineos.guest';

export const session = {
  get(): { token: string; staff: Me } | null { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; } },
  set(v: { token: string; staff: Me }) { localStorage.setItem(KEY, JSON.stringify(v)); },
  clear() { localStorage.removeItem(KEY); },
};
export const guestSession = {
  get(qr: string): { token: string; name: string } | null { try { return JSON.parse(localStorage.getItem(GKEY + qr) ?? 'null'); } catch { return null; } },
  set(qr: string, v: { token: string; name: string }) { localStorage.setItem(GKEY + qr, JSON.stringify(v)); },
  clear(qr: string) { localStorage.removeItem(GKEY + qr); },
};

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const token = opts.token === undefined ? session.get()?.token : opts.token;
  const res = await fetch(API + path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && opts.token === undefined) { session.clear(); if (!location.pathname.startsWith('/login')) location.href = '/login'; }
  if (!res.ok) throw new ApiError(res.status, json.error ?? 'Something went wrong');
  return json as T;
}

export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true, retry: 1 } } });

/** Opens the live socket and refetches everything on screen when the server says something changed. */
export function useLive(token: string | null | undefined) {
  const qc = useQueryClient();
  const [online, setOnline] = useState(false);
  useEffect(() => {
    if (!token) return;
    let ws: WebSocket | null = null; let stop = false; let retry: ReturnType<typeof setTimeout>;
    let t: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      const base = (import.meta.env.VITE_API_URL ?? '').replace(/^http/, 'ws').replace(/\/api$/, '') || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
      ws = new WebSocket(`${base}/ws?token=${encodeURIComponent(token)}`);
      ws.onopen = () => setOnline(true);
      ws.onmessage = () => { clearTimeout(t); t = setTimeout(() => qc.invalidateQueries(), 150); };
      ws.onclose = () => { setOnline(false); if (!stop) retry = setTimeout(connect, 2000); };
    };
    connect();
    // safety net if the socket drops silently
    const poll = setInterval(() => qc.invalidateQueries(), 30000);
    return () => { stop = true; clearTimeout(retry); clearInterval(poll); ws?.close(); };
  }, [token, qc]);
  return online;
}

/** Ticks every 15 s so "5 min ago" style labels stay fresh. */
export function useTick(ms = 15000) {
  const [, set] = useState(0);
  useEffect(() => { const i = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(i); }, [ms]);
}
