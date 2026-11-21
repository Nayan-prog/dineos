import { Hono } from 'hono';
import { and, asc, eq, inArray, ne, sql as dsql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema as s } from '../db/client.js';
import { zValidator } from '../lib/validate.js';
import { requireStaff } from '../lib/auth.js';
import { claimItems, fail, log, notifyItem, raiseTask } from '../lib/service.js';
import { emit, room } from '../lib/live.js';
import { out } from '../lib/util.js';

/** Station queues. Each dish goes to its station; all chefs at a station share one queue. */
export const kitchen = new Hono();
kitchen.use('*', requireStaff('chef', 'owner', 'manager', 'admin'));

async function me(c: any) {
  const claims = c.get('staff');
  const [x] = await db.select().from(s.staff).where(eq(s.staff.id, claims.sub));
  return x;
}

kitchen.get('/stations', async (c) => c.json(await db.select().from(s.stations).where(eq(s.stations.restaurantId, c.get('staff').rid))));

/** Queue for one station (chefs: their own station). Waiting is sorted remake → late → oldest. */
kitchen.get('/queue', async (c) => {
  const claims = c.get('staff');
  const chef = await me(c);
  const stationId = claims.role === 'chef' ? chef.stationId : Number(c.req.query('station')) || null;
  if (!stationId) fail(400, 'Pick a station');
  const items = await db.select({
    id: s.orderItems.id, orderId: s.orderItems.orderId, area: s.areas.name, guests: s.sessions.guestCount, table: s.tables.code, tableId: s.tables.id, name: s.dishes.name, qty: s.orderItems.qty, guestNo: s.orderItems.guestNo, spice: s.orderItems.spice,
    options: s.orderItems.options, note: s.orderItems.note, status: s.orderItems.status, remake: s.orderItems.remake, prepMinutes: s.dishes.prepMinutes,
    createdAt: s.orderItems.createdAt, claimedAt: s.orderItems.claimedAt, readyAt: s.orderItems.readyAt, claimedBy: s.orderItems.claimedBy, chef: s.staff.name, waiterId: s.waiterTables.staffId,
  }).from(s.orderItems)
    .innerJoin(s.sessions, eq(s.sessions.id, s.orderItems.sessionId)).innerJoin(s.tables, eq(s.tables.id, s.sessions.tableId)).innerJoin(s.areas, eq(s.areas.id, s.tables.areaId))
    .innerJoin(s.dishes, eq(s.dishes.id, s.orderItems.dishId)).leftJoin(s.staff, eq(s.staff.id, s.orderItems.claimedBy))
    .leftJoin(s.waiterTables, eq(s.waiterTables.tableId, s.tables.id))
    .where(and(eq(s.orderItems.restaurantId, claims.rid), eq(s.orderItems.stationId, stationId!), inArray(s.orderItems.status, ['waiting', 'cooking', 'ready'])))
    .orderBy(asc(s.orderItems.createdAt));
  const waiterNames = Object.fromEntries((await db.select({ id: s.staff.id, name: s.staff.name }).from(s.staff).where(eq(s.staff.role, 'waiter'))).map((w) => [w.id, w.name]));
  const age = (d: Date) => (Date.now() - new Date(d).getTime()) / 60000;
  const rank = (i: (typeof items)[number]) => (i.remake ? 1e6 : 0) + (age(i.createdAt) > i.prepMinutes * 0.7 ? 1e5 : 0) + age(i.createdAt);
  const waiting = items.filter((i) => i.status === 'waiting').sort((a, b) => rank(b) - rank(a));
  const chefs = await db.select({ id: s.staff.id, name: s.staff.name, maxParallel: s.staff.maxParallel, onBreak: s.staff.onBreak, onDuty: s.staff.onDuty,
    cooking: dsql<number>`(select count(*) from order_items oi where oi.claimed_by = ${s.staff.id} and oi.status = 'cooking')::int` })
    .from(s.staff).where(and(eq(s.staff.stationId, stationId!), eq(s.staff.active, true), eq(s.staff.role, 'chef'))).orderBy(asc(s.staff.id));
  const [station] = await db.select().from(s.stations).where(eq(s.stations.id, stationId!));
  const withWaiter = <T extends { waiterId: number | null }>(i: T) => ({ ...i, waiter: i.waiterId ? waiterNames[i.waiterId] ?? null : null });
  // what the other stations are doing on the same tables (for the ticket view)
  const tableIds = [...new Set(items.map((i) => i.tableId))];
  const others = tableIds.length ? await db.select({ tableId: s.sessions.tableId, station: s.stations.name, status: s.orderItems.status, n: dsql<number>`count(*)::int` }).from(s.orderItems)
    .innerJoin(s.sessions, eq(s.sessions.id, s.orderItems.sessionId)).innerJoin(s.stations, eq(s.stations.id, s.orderItems.stationId))
    .where(and(eq(s.orderItems.restaurantId, claims.rid), ne(s.orderItems.stationId, stationId!), inArray(s.sessions.tableId, tableIds), inArray(s.orderItems.status, ['waiting', 'cooking'])))
    .groupBy(s.sessions.tableId, s.stations.name, s.orderItems.status) : [];
  return out(c, {
    station, me: claims.role === 'chef' ? { id: chef.id, maxParallel: chef.maxParallel, onBreak: chef.onBreak } : null, chefs, others,
    waiting: waiting.map(withWaiter), cooking: items.filter((i) => i.status === 'cooking').map(withWaiter),
    ready: items.filter((i) => i.status === 'ready').map(withWaiter),
  });
});

/** Start one or more dishes (Start / Start all) */
kitchen.post('/claim', requireStaff('chef'), zValidator('json', z.object({ ids: z.array(z.number().int()).min(1).max(10) })), async (c) => {
  const chef = await me(c);
  const n = await claimItems(chef.restaurantId, chef, c.req.valid('json').ids);
  return c.json({ claimed: n });
});

/** Mark ready → alerts the table's waiter */
kitchen.post('/items/:id/ready', async (c) => {
  const claims = c.get('staff');
  const id = Number(c.req.param('id'));
  const [it] = await db.select().from(s.orderItems).where(and(eq(s.orderItems.id, id), eq(s.orderItems.restaurantId, claims.rid)));
  if (!it || it.status !== 'cooking') fail(409, 'This dish is not cooking');
  if (claims.role === 'chef' && it.claimedBy !== claims.sub) fail(403, 'Another chef is cooking this dish');
  await db.update(s.orderItems).set({ status: 'ready', readyAt: new Date() }).where(eq(s.orderItems.id, id));
  const [d] = await db.select({ name: s.dishes.name, tableId: s.sessions.tableId, code: s.tables.code }).from(s.orderItems)
    .innerJoin(s.dishes, eq(s.dishes.id, s.orderItems.dishId)).innerJoin(s.sessions, eq(s.sessions.id, s.orderItems.sessionId)).innerJoin(s.tables, eq(s.tables.id, s.sessions.tableId))
    .where(eq(s.orderItems.id, id));
  await raiseTask(claims.rid, d.tableId, it.sessionId, 'food_ready', `${it.qty} × ${d.name}`);
  await log(claims.rid, 'ready', `${claims.name.split(' ')[0]} marked ${it.qty} × ${d.name} ready for ${d.code}`, claims.sub);
  await notifyItem(claims.rid, id);
  return c.json({ ok: true });
});

/** Manager: hand a cooking dish back to the queue (chef left, wrong station…) */
kitchen.post('/items/:id/release', requireStaff('owner', 'manager', 'admin'), async (c) => {
  const claims = c.get('staff');
  const [it] = await db.update(s.orderItems).set({ status: 'waiting', claimedBy: null, claimedAt: null })
    .where(and(eq(s.orderItems.id, Number(c.req.param('id'))), eq(s.orderItems.restaurantId, claims.rid), eq(s.orderItems.status, 'cooking'))).returning();
  if (!it) fail(409, 'This dish is not cooking');
  await notifyItem(claims.rid, it.id);
  return c.json({ ok: true });
});

/** Send a dish back (remake): goes to the top of the queue */
kitchen.post('/items/:id/remake', requireStaff('owner', 'manager', 'admin', 'waiter'), zValidator('json', z.object({ reason: z.string().max(120).default('') })), async (c) => {
  const claims = c.get('staff');
  const [it] = await db.update(s.orderItems).set({ status: 'waiting', remake: true, claimedBy: null, claimedAt: null, readyAt: null, servedAt: null, note: c.req.valid('json').reason || 'Sent back' })
    .where(and(eq(s.orderItems.id, Number(c.req.param('id'))), eq(s.orderItems.restaurantId, claims.rid), inArray(s.orderItems.status, ['ready', 'served']))).returning();
  if (!it) fail(409, 'Only ready or served dishes can be sent back');
  await notifyItem(claims.rid, it.id);
  return c.json({ ok: true });
});

/** Chef or manager: mark a dish out of stock / back in stock */
kitchen.patch('/dishes/:id/stock', zValidator('json', z.object({ available: z.boolean() })), async (c) => {
  const claims = c.get('staff');
  const [d] = await db.update(s.dishes).set({ available: c.req.valid('json').available }).where(and(eq(s.dishes.id, Number(c.req.param('id'))), eq(s.dishes.restaurantId, claims.rid))).returning();
  if (!d) fail(404, 'Dish not found');
  await log(claims.rid, 'stock', `${d.name} marked ${d.available ? 'back in stock' : 'out of stock'}`, claims.sub);
  emit([room.team(claims.rid), room.waiters(claims.rid)], { type: 'staff.updated', staffId: claims.sub });
  return c.json({ id: d.id, available: d.available });
});

/** Chef: dishes I finished today */
kitchen.get('/done', requireStaff('chef'), async (c) => {
  const claims = c.get('staff');
  const rows = await db.select({ id: s.orderItems.id, name: s.dishes.name, qty: s.orderItems.qty, table: s.tables.code, tableId: s.tables.id, prepMinutes: s.dishes.prepMinutes, claimedAt: s.orderItems.claimedAt, readyAt: s.orderItems.readyAt })
    .from(s.orderItems).innerJoin(s.dishes, eq(s.dishes.id, s.orderItems.dishId)).innerJoin(s.sessions, eq(s.sessions.id, s.orderItems.sessionId)).innerJoin(s.tables, eq(s.tables.id, s.sessions.tableId))
    .where(and(eq(s.orderItems.claimedBy, claims.sub), inArray(s.orderItems.status, ['ready', 'served']), dsql`${s.orderItems.readyAt} > now() - interval '18 hours'`))
    .orderBy(dsql`${s.orderItems.readyAt} desc`);
  const owners = await db.select({ tableId: s.waiterTables.tableId, name: s.staff.name }).from(s.waiterTables).innerJoin(s.staff, eq(s.staff.id, s.waiterTables.staffId));
  return c.json(rows.map((r) => ({ ...r, waiter: owners.find((o) => o.tableId === r.tableId)?.name ?? null })));
});

/** Dishes of my station with their stock state and how many were made today (chefs: own station) */
kitchen.get('/stock', async (c) => {
  const claims = c.get('staff');
  const chef = await me(c);
  const stationId = claims.role === 'chef' ? chef.stationId : Number(c.req.query('station')) || null;
  if (!stationId) fail(400, 'Pick a station');
  const [station] = await db.select().from(s.stations).where(eq(s.stations.id, stationId!));
  const dishes = await db.select({
    id: s.dishes.id, name: s.dishes.name, veg: s.dishes.veg, available: s.dishes.available,
    made: dsql<number>`coalesce((select sum(oi.qty) from order_items oi where oi.dish_id = ${s.dishes.id} and oi.status in ('ready','served') and oi.created_at >= date_trunc('day', now())), 0)::int`,
  }).from(s.dishes).where(and(eq(s.dishes.restaurantId, claims.rid), eq(s.dishes.stationId, stationId!))).orderBy(asc(s.dishes.name));
  return c.json({ station, dishes });
});
