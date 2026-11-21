import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@dineos/shared';

/** Set EXPO_PUBLIC_API_URL to your laptop's Wi-Fi IP, e.g. http://192.168.1.20:4000 */
export const BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export type Me = { id: number; name: string; role: Role; stationId: number | null; areaId: number | null; maxParallel: number; onBreak: boolean };
type Saved = { token: string; staff: Me };

let cache: Saved | null = null;
export const auth = {
  async load() { const v = await SecureStore.getItemAsync('dineos'); cache = v ? JSON.parse(v) : null; return cache; },
  get: () => cache,
  async set(v: Saved) { cache = v; await SecureStore.setItemAsync('dineos', JSON.stringify(v)); },
  async clear() { cache = null; await SecureStore.deleteItemAsync('dineos'); },
};

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; anon?: boolean } = {}): Promise<T> {
  const token = opts.anon ? null : cache?.token;
  const res = await fetch(`${BASE}/api${path}`, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5000, retry: 1 } } });

/** Live socket: refetch what is on screen whenever the server reports a change. */
export function useLive() {
  const qc = useQueryClient();
  const [online, setOnline] = useState(false);
  useEffect(() => {
    const token = cache?.token; if (!token) return;
    let ws: WebSocket | null = null; let stop = false; let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(token)}`);
      ws.onopen = () => setOnline(true);
      ws.onmessage = () => qc.invalidateQueries();
      ws.onclose = () => { setOnline(false); if (!stop) retry = setTimeout(connect, 2000); };
    };
    connect();
    const poll = setInterval(() => qc.invalidateQueries(), 30000);
    return () => { stop = true; clearTimeout(retry); clearInterval(poll); ws?.close(); };
  }, [qc]);
  return online;
}

export const homeFor = (role: Role): '/waiter' | '/chef' | '/manager' => (role === 'waiter' ? '/waiter' : role === 'chef' ? '/chef' : '/manager');
