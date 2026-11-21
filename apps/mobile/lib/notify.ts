import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { TASK_LABEL, type TaskKind } from '@dineos/shared';
import { api } from './api';

export type Notice = { id: string; cat: 'Orders' | 'Kitchen' | 'Alerts'; tag: string; color: string; title: string; sub: string; at: number; tableId?: number; unread: boolean };

const READ_KEY = 'dineos-notif-read';
const KIND: Record<string, { cat: Notice['cat']; tag: string; color: string }> = {
  order: { cat: 'Orders', tag: 'O', color: '#7db0f9' },
  bill: { cat: 'Orders', tag: 'B', color: '#c9b29b' },
  table: { cat: 'Orders', tag: 'T', color: '#7db0f9' },
  void: { cat: 'Orders', tag: 'V', color: '#e0705c' },
  ready: { cat: 'Kitchen', tag: 'R', color: '#5eb88a' },
  stock: { cat: 'Alerts', tag: '!', color: '#e0705c' },
  alert: { cat: 'Alerts', tag: '!', color: '#f5b454' },
  shift: { cat: 'Alerts', tag: 'S', color: '#7db0f9' },
  staff: { cat: 'Alerts', tag: 'S', color: '#7db0f9' },
  menu: { cat: 'Alerts', tag: 'M', color: '#a1a1a8' },
};
const TASK_COLOR: Record<TaskKind, string> = { food_ready: '#5eb88a', call: '#7db0f9', bill: '#c9b29b' };

/** Short relative time: Now, 2m, 1h, 3d */
export function since(ms: number) {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
  return m < 1 ? 'Now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
}

/** Open service alerts plus the activity log, newest first. "Mark all read" is remembered on the phone. */
export function useNotifications() {
  const qc = useQueryClient();
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api('/team/tasks') });
  const activity = useQuery({ queryKey: ['activity'], queryFn: () => api('/team/activity') });
  const read = useQuery({ queryKey: ['notif-read'], queryFn: async () => Number((await SecureStore.getItemAsync(READ_KEY).catch(() => null)) ?? 0) });
  const lastRead = read.data ?? 0;
  const fromTasks: Notice[] = (tasks.data?.tasks ?? []).filter((t: any) => t.status === 'open').map((t: any) => ({
    id: 't' + t.id, cat: 'Orders', tag: t.table, color: TASK_COLOR[t.kind as TaskKind] ?? '#a1a1a8', title: `${t.table} · ${TASK_LABEL[t.kind as TaskKind] ?? t.kind}`,
    sub: t.detail || (t.level === 2 ? 'Nobody took this one, manager alerted' : t.level === 1 ? 'Passed to the area' : 'Waiting for the table waiter'),
    at: new Date(t.createdAt).getTime(), tableId: t.tableId, unread: new Date(t.createdAt).getTime() > lastRead,
  }));
  const fromLog: Notice[] = (activity.data ?? []).map((a: any) => {
    const k = KIND[a.kind] ?? { cat: 'Alerts' as const, tag: '•', color: '#a1a1a8' };
    const at = new Date(a.createdAt).getTime();
    return { id: 'a' + a.id, cat: k.cat, tag: k.tag, color: k.color, title: a.text, sub: a.kind[0].toUpperCase() + a.kind.slice(1), at, unread: at > lastRead };
  });
  const items = [...fromTasks, ...fromLog].sort((a, b) => b.at - a.at);
  const unread = items.filter((n) => n.unread).length;
  const markAll = async () => { const now = Date.now(); await SecureStore.setItemAsync(READ_KEY, String(now)).catch(() => {}); qc.setQueryData(['notif-read'], now); };
  return { items, unread, markAll, loading: !tasks.data && !activity.data };
}
