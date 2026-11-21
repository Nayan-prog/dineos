import { and, eq, inArray, sql as dsql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db, sql, schema as s } from '../db/client.js';
import { emit, room } from './live.js';
import type { OrderItemInput } from '@dineos/shared';

export const fail = (status: 400 | 403 | 404 | 409, message: string): never => { throw new HTTPException(status, { message }); };

export async function log(rid: number, kind: string, text: string, staffId?: number) {
  await db.insert(s.activity).values({ restaurantId: rid, kind, text, staffId: staffId ?? null });
}

/** The waiter who owns a table this shift (null if nobody is assigned). */
export async function waiterFor(tableId: number) {
  const [row] = await db.select({ id: s.waiterTables.staffId }).from(s.waiterTables).where(eq(s.waiterTables.tableId, tableId));
  return row?.id ?? null;
}

export async function openSessionFor(tableId: number) {
  const [row] = await db.select().from(s.sessions).where(and(eq(s.sessions.tableId, tableId), inArray(s.sessions.status, ['open', 'billing'])));
  return row ?? null;
}

/** Insert an order and its items; each item is routed to its dish's station queue. */
export async function placeOrder(rid: number, sessionId: number, items: OrderItemInput[], by: { staffId?: number }) {
  const [ses] = await db.select().from(s.sessions).where(and(eq(s.sessions.id, sessionId), eq(s.sessions.restaurantId, rid)));
  if (!ses || ses.status === 'closed') fail(404, 'This table is not open');
  if (ses!.status === 'billing') fail(409, 'The bill has been requested, ask the waiter to reopen the table');
  const ids = [...new Set(items.map((i) => i.dishId))];
  const ds = await db.select().from(s.dishes).where(and(inArray(s.dishes.id, ids), eq(s.dishes.restaurantId, rid)));
  const byId = new Map(ds.map((d) => [d.id, d]));
  for (const i of items) {
    const d = byId.get(i.dishId);
    if (!d) fail(400, 'A dish in this order no longer exists');
    if (!d!.available) fail(409, `${d!.name} is out of stock`);
    if (i.guestNo > ses!.guestCount) fail(400, `There are only ${ses!.guestCount} guests at this table`);
  }
  const [order] = await db.insert(s.orders).values({ restaurantId: rid, sessionId, placedBy: by.staffId ? 'staff' : 'customer', staffId: by.staffId ?? null }).returning();
  const rows = await db.insert(s.orderItems).values(items.map((i) => {
    const d = byId.get(i.dishId)!;
    return { restaurantId: rid, orderId: order.id, sessionId, dishId: d.id, stationId: d.stationId, qty: i.qty, guestNo: i.guestNo, spice: i.spice ?? null, options: i.options, note: i.note, unitPrice: d.price };
  })).returning();
  const [t] = await db.select({ code: s.tables.code }).from(s.tables).where(eq(s.tables.id, ses!.tableId));
  await log(rid, 'order', `${t.code} placed an order · ${rows.length} item${rows.length > 1 ? 's' : ''}`, by.staffId);
  const stations = [...new Set(rows.map((r) => r.stationId))];
  emit([room.team(rid), room.session(sessionId), room.waiters(rid), ...stations.map((x) => room.station(rid, x))], { type: 'order.created', orderId: order.id, tableId: ses!.tableId });
  return { order, items: rows };
}

/**
 * A chef takes dishes from the shared station queue.
 * FOR UPDATE SKIP LOCKED means two chefs tapping at the same moment never get the same dish.
 */
export async function claimItems(rid: number, chef: { id: number; stationId: number | null; maxParallel: number; onBreak: boolean }, itemIds: number[]) {
  if (chef.onBreak) fail(409, 'You are on break. Resume duty to take dishes.');
  return await sql.begin(async (tx) => {
    const [{ n }] = await tx`select count(*)::int as n from order_items where claimed_by = ${chef.id} and status = 'cooking'`;
    if (n + itemIds.length > chef.maxParallel) fail(409, `You can cook ${chef.maxParallel} dishes at once. Finish one first.`);
    const got = await tx`
      select id, station_id, session_id from order_items
      where id = any(${itemIds}) and restaurant_id = ${rid} and status = 'waiting'
      for update skip locked`;
    if (got.length < itemIds.length) fail(409, 'Another chef already took this dish');
    if (chef.stationId && got.some((g) => g.station_id !== chef.stationId)) fail(403, 'This dish belongs to another station');
    await tx`update order_items set status = 'cooking', claimed_by = ${chef.id}, claimed_at = now() where id = any(${itemIds})`;
    return got;
  }).then(async (got) => {
    for (const g of got) await notifyItem(rid, g.id);
    return got.length;
  });
}

export async function notifyItem(rid: number, itemId: number) {
  const [it] = await db.select({ id: s.orderItems.id, status: s.orderItems.status, stationId: s.orderItems.stationId, sessionId: s.orderItems.sessionId, tableId: s.sessions.tableId })
    .from(s.orderItems).innerJoin(s.sessions, eq(s.sessions.id, s.orderItems.sessionId)).where(eq(s.orderItems.id, itemId));
  if (!it) return;
  emit([room.team(rid), room.station(rid, it.stationId), room.session(it.sessionId), room.waiters(rid)], { type: 'item.updated', itemId, status: it.status, tableId: it.tableId, stationId: it.stationId });
}

/** Create (or extend) an alert for a table. It goes to the table's waiter first; the escalation loop passes it on. */
export async function raiseTask(rid: number, tableId: number, sessionId: number | null, kind: 'food_ready' | 'call' | 'bill', detail: string) {
  const [t] = await db.select().from(s.tables).where(eq(s.tables.id, tableId));
  const waiterId = await waiterFor(tableId);
  const [open] = await db.select().from(s.tasks).where(and(eq(s.tasks.tableId, tableId), eq(s.tasks.kind, kind), eq(s.tasks.status, 'open')));
  let task;
  if (open && kind === 'food_ready') {
    [task] = await db.update(s.tasks).set({ detail: open.detail + ', ' + detail }).where(eq(s.tasks.id, open.id)).returning();
  } else if (open) {
    task = open; // a guest pressing "call" twice does not create two alerts
  } else {
    let level = 0;
    if (waiterId) {
      const [w] = await db.select({ onBreak: s.staff.onBreak, onDuty: s.staff.onDuty }).from(s.staff).where(eq(s.staff.id, waiterId));
      if (w?.onBreak || !w?.onDuty) level = 1; // owner is away: go straight to the area
    } else level = 1;
    [task] = await db.insert(s.tasks).values({ restaurantId: rid, tableId, sessionId, areaId: t.areaId, kind, detail, assignedTo: waiterId, level, escalatedAt: level ? new Date() : null }).returning();
  }
  emit([room.waiters(rid), room.team(rid)], { type: 'task.updated', taskId: task.id, status: task.status, level: task.level });
  return task;
}

/** Runs every few seconds: alerts nobody took move to the area, then to the manager. */
export async function escalate() {
  const moved = await sql`
    update service_tasks t set level = t.level + 1, escalated_at = now()
    from restaurants r
    where t.restaurant_id = r.id and t.status = 'open' and (
      (t.level = 0 and t.created_at < now() - make_interval(secs => r.alert_area_secs)) or
      (t.level = 1 and t.created_at < now() - make_interval(secs => r.alert_manager_secs)))
    returning t.id, t.restaurant_id, t.level, t.table_id`;
  for (const m of moved) {
    emit([room.waiters(m.restaurant_id), room.team(m.restaurant_id)], { type: 'task.updated', taskId: m.id, status: 'open', level: m.level });
    if (m.level === 2) {
      const [t] = await db.select({ code: s.tables.code }).from(s.tables).where(eq(s.tables.id, m.table_id));
      await log(m.restaurant_id, 'alert', `Nobody answered ${t.code} in time · passed to the manager`);
    }
  }
  return moved.length;
}

export async function sessionTotals(sessionId: number, taxPercent: number) {
  const [{ sub }] = await db.select({ sub: dsql<number>`coalesce(sum(${s.orderItems.unitPrice} * ${s.orderItems.qty}), 0)::int` })
    .from(s.orderItems).where(and(eq(s.orderItems.sessionId, sessionId), dsql`${s.orderItems.status} <> 'cancelled'`));
  const tax = Math.round((sub * taxPercent) / 100);
  return { subtotal: sub, tax, total: sub + tax };
}
