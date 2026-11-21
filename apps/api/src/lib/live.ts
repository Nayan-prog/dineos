import type { WSContext } from 'hono/ws';
import type { LiveEvent } from '@dineos/shared';

/**
 * Rooms:
 *   r:<rid>:team      owner / manager / admin dashboards
 *   r:<rid>:station:<id>  chefs on a station
 *   r:<rid>:waiters   all waiters (task hand-off)
 *   staff:<id>        one person
 *   session:<id>      guests at a table
 */
const rooms = new Map<string, Set<WSContext>>();

export function join(room: string, ws: WSContext) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room)!.add(ws);
}

export function leaveAll(ws: WSContext) {
  for (const set of rooms.values()) set.delete(ws);
}

export function emit(roomsTo: string[], event: LiveEvent) {
  const msg = JSON.stringify(event);
  const sent = new Set<WSContext>();
  for (const r of roomsTo) {
    for (const ws of rooms.get(r) ?? []) {
      if (sent.has(ws)) continue;
      sent.add(ws);
      try { ws.send(msg); } catch { /* socket closed */ }
    }
  }
}

export const room = {
  team: (rid: number) => `r:${rid}:team`,
  station: (rid: number, sid: number) => `r:${rid}:station:${sid}`,
  waiters: (rid: number) => `r:${rid}:waiters`,
  staff: (id: number) => `staff:${id}`,
  session: (id: number) => `session:${id}`,
};
