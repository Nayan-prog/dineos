import { Hono } from 'hono';
import { and, asc, desc, eq, inArray, ne, sql as dsql } from 'drizzle-orm';
import { z } from 'zod';
import { createOrderInput, createTableInput, openSessionInput } from '@dineos/shared';
import { db, schema as s } from '../db/client.js';
import { zValidator } from '../lib/validate.js';
import { requireStaff, type StaffClaims } from '../lib/auth.js';
import { fail, log, notifyItem, openSessionFor, placeOrder, sessionTotals, waiterFor } from '../lib/service.js';
import { emit, room } from '../lib/live.js';
import { out, token } from '../lib/util.js';
import { menuFor } from './guest.js';

export const floor = new Hono();
floor.use('*', requireStaff());

const WEB = process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173';
const qrUrl = (t: string) => `${WEB}/t/${t}`;

/** Waiters may only work their own tables; the manager team sees all. */
async function assertTable(me: StaffClaims, tableId: number) {
  const [t] = await db.select().from(s.tables).where(and(eq(s.tables.id, tableId), eq(s.tables.restaurantId, me.rid)));
  if (!t) fail(404, 'Table not found');
  if (me.role === 'waiter' && (await waiterFor(tableId)) !== me.sub) fail(403, 'This table belongs to another waiter');
  if (me.role === 'chef') fail(403, 'Chefs cannot change tables');
  return t!;
}

floor.get('/areas', async (c) => c.json(await db.select().from(s.areas).where(eq(s.areas.restaurantId, c.get('staff').rid)).orderBy(asc(s.areas.sort))));

floor.post('/areas', requireStaff('owner', 'manager', 'admin'), zValidator('json', z.object({ name: z.string().min(1).max(40) })), async (c) => {
  const [a] = await db.insert(s.areas).values({ restaurantId: c.get('staff').rid, name: c.req.valid('json').name, sort: 99 }).returning();
  return c.json(a, 201);
});

floor.get('/menu', async (c) => out(c, await menuFor(c.get('staff').rid)));

/** Floor overview: every table with its live state. Waiters get only their own tables (?mine=1 is implied). */
floor.get('/tables', async (c) => {
  const me = c.get('staff');
  const ts = await db.select({ t: s.tables, area: s.areas.name }).from(s.tables).innerJoin(s.areas, eq(s.areas.id, s.tables.areaId))
    .where(and(eq(s.tables.restaurantId, me.rid), eq(s.tables.active, true))).orderBy(asc(s.areas.sort), asc(s.tables.id));
  const owners = await db.select({ tableId: s.waiterTables.tableId, staffId: s.staff.id, name: s.staff.name }).from(s.waiterTables).innerJoin(s.staff, eq(s.staff.id, s.waiterTables.staffId)).where(eq(s.staff.restaurantId, me.rid));
  const open = await db.select().from(s.sessions).where(and(eq(s.sessions.restaurantId, me.rid), ne(s.sessions.status, 'closed')));
  const ids = open.map((x) => x.id);
  const counts = ids.length ? await db.select({
    sessionId: s.orderItems.sessionId,
    items: dsql<number>`count(*) filter (where ${s.orderItems.status} <> 'cancelled')::int`,
    pending: dsql<number>`count(*) filter (where ${s.orderItems.status} in ('waiting','cooking'))::int`,
    ready: dsql<number>`count(*) filter (where ${s.orderItems.status} = 'ready')::int`,
    amount: dsql<number>`coalesce(sum(${s.orderItems.unitPrice} * ${s.orderItems.qty}) filter (where ${s.orderItems.status} <> 'cancelled'), 0)::int`,
  }).from(s.orderItems).where(inArray(s.orderItems.sessionId, ids)).groupBy(s.orderItems.sessionId) : [];
  const rows = ts.map(({ t, area }) => {
    const ses = open.find((x) => x.tableId === t.id);
    const cnt = ses && counts.find((x) => x.sessionId === ses.id);
    const owner = owners.find((o) => o.tableId === t.id);
    const state = !ses ? 'free' : ses.status === 'billing' ? 'billing' : !cnt || !cnt.items ? 'seated' : cnt.ready ? 'ready' : cnt.pending ? 'eating' : 'served';
    return { id: t.id, code: t.code, seats: t.seats, shape: t.shape, areaId: t.areaId, area, state, waiterId: owner?.staffId ?? null, waiter: owner?.name ?? null,
      sessionId: ses?.id ?? null, guests: ses?.guestCount ?? 0, openedAt: ses?.openedAt ?? null, items: cnt?.items ?? 0, ready: cnt?.ready ?? 0, amount: cnt?.amount ?? 0 };
  });
  const list = me.role === 'waiter' ? rows.filter((r) => r.waiterId === me.sub) : rows;
  const seatsTotal = rows.reduce((a, r) => a + r.seats, 0);
  const guests = rows.reduce((a, r) => a + r.guests, 0);
  return out(c, { tables: list, summary: { tables: rows.length, occupied: rows.filter((r) => r.state !== 'free').length, seats: seatsTotal, guests } });
});

floor.post('/tables', requireStaff('owner', 'manager', 'admin'), zValidator('json', createTableInput), async (c) => {
  const me = c.get('staff');
  const v = c.req.valid('json');
  const [dupe] = await db.select({ id: s.tables.id }).from(s.tables).where(and(eq(s.tables.restaurantId, me.rid), eq(s.tables.code, v.code)));
  if (dupe) fail(409, `Table ${v.code} already exists`);
  const [t] = await db.insert(s.tables).values({ ...v, restaurantId: me.rid, qrToken: token() }).returning();
  await log(me.rid, 'table', `Table ${t.code} added`, me.sub);
  emit([room.team(me.rid)], { type: 'table.updated', tableId: t.id });
  return c.json({ ...t, qrUrl: qrUrl(t.qrToken) }, 201);
});

floor.patch('/tables/:id', requireStaff('owner', 'manager', 'admin'), zValidator('json', createTableInput.partial().extend({ active: z.boolean().optional(), newQr: z.boolean().optional() })), async (c) => {
  const me = c.get('staff');
  const { newQr, ...v } = c.req.valid('json');
  const [t] = await db.update(s.tables).set({ ...v, ...(newQr ? { qrToken: token() } : {}) }).where(and(eq(s.tables.id, Number(c.req.param('id'))), eq(s.tables.restaurantId, me.rid))).returning();
  if (!t) fail(404, 'Table not found');
  return c.json({ ...t, qrUrl: qrUrl(t.qrToken) });
});

/** Table dashboard: QR, current guests, every dish with its status, totals */
floor.get('/tables/:id', async (c) => {
  const me = c.get('staff');
  const t = await assertTable(me, Number(c.req.param('id')));
  const ses = await openSessionFor(t.id);
  const [r] = await db.select().from(s.restaurants).where(eq(s.restaurants.id, me.rid));
  const items = ses ? await db.select({
    id: s.orderItems.id, name: s.dishes.name, veg: s.dishes.veg, qty: s.orderItems.qty, guestNo: s.orderItems.guestNo, spice: s.orderItems.spice, options: s.orderItems.options,
    note: s.orderItems.note, unitPrice: s.orderItems.unitPrice, status: s.orderItems.status, createdAt: s.orderItems.createdAt, chef: s.staff.name,
  }).from(s.orderItems).innerJoin(s.dishes, eq(s.dishes.id, s.orderItems.dishId)).leftJoin(s.staff, eq(s.staff.id, s.orderItems.claimedBy))
    .where(eq(s.orderItems.sessionId, ses.id)).orderBy(asc(s.orderItems.id)) : [];
  const [cust] = ses?.customerId ? await db.select().from(s.customers).where(eq(s.customers.id, ses.customerId)) : [];
  const waiterId = await waiterFor(t.id);
  const [w] = waiterId ? await db.select({ name: s.staff.name }).from(s.staff).where(eq(s.staff.id, waiterId)) : [];
  const [area] = await db.select().from(s.areas).where(eq(s.areas.id, t.areaId));
  const [today] = await db.select({ turns: dsql<number>`count(*)::int`, amount: dsql<number>`coalesce(sum(${s.bills.total}),0)::int` }).from(s.bills)
    .innerJoin(s.sessions, eq(s.sessions.id, s.bills.sessionId)).where(and(eq(s.sessions.tableId, t.id), dsql`${s.bills.paidAt} >= date_trunc('day', now())`));
  return out(c, {
    today,
    table: { ...t, qrUrl: qrUrl(t.qrToken), area: area.name, waiter: w?.name ?? null },
    session: ses ? { ...ses, customer: cust ? { name: cust.name, phone: cust.phone, visits: cust.visits } : null } : null,
    items, totals: ses ? await sessionTotals(ses.id, r.taxPercent) : null,
  });
});

/** Seat guests (dine-in): opens the table with a guest count */
floor.post('/sessions', zValidator('json', openSessionInput), async (c) => {
  const me = c.get('staff');
  const v = c.req.valid('json');
  const t = await assertTable(me, v.tableId);
  const existing = await openSessionFor(t.id);
  if (existing) {
    const [u] = await db.update(s.sessions).set({ guestCount: v.guestCount }).where(eq(s.sessions.id, existing.id)).returning();
    return c.json(u);
  }
  const [ses] = await db.insert(s.sessions).values({ restaurantId: me.rid, tableId: t.id, guestCount: v.guestCount, waiterId: (await waiterFor(t.id)) ?? me.sub }).returning();
  emit([room.team(me.rid), room.waiters(me.rid)], { type: 'table.updated', tableId: t.id });
  return c.json(ses, 201);
});

/** Take order (waiter or manager team) */
floor.post('/orders', zValidator('json', createOrderInput), async (c) => {
  const me = c.get('staff');
  const v = c.req.valid('json');
  const [ses] = await db.select().from(s.sessions).where(eq(s.sessions.id, v.sessionId));
  if (!ses) fail(404, 'Table is not open');
  await assertTable(me, ses.tableId);
  const res = await placeOrder(me.rid, v.sessionId, v.items, { staffId: me.sub });
  return c.json({ orderId: res.order.id, items: res.items.length }, 201);
});

/** Live order list (manager team: everything; waiter: own tables) */
floor.get('/orders', async (c) => {
  const me = c.get('staff');
  const status = c.req.query('status');
  const rows = await db.select({
    id: s.orderItems.id, orderId: s.orderItems.orderId, sessionId: s.orderItems.sessionId, tableId: s.tables.id, table: s.tables.code, name: s.dishes.name, qty: s.orderItems.qty,
    guestNo: s.orderItems.guestNo, note: s.orderItems.note, spice: s.orderItems.spice, status: s.orderItems.status, station: s.stations.name, unitPrice: s.orderItems.unitPrice,
    createdAt: s.orderItems.createdAt, chef: s.staff.name, placedBy: s.orders.placedBy,
  }).from(s.orderItems)
    .innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId)).innerJoin(s.sessions, eq(s.sessions.id, s.orderItems.sessionId))
    .innerJoin(s.tables, eq(s.tables.id, s.sessions.tableId)).innerJoin(s.dishes, eq(s.dishes.id, s.orderItems.dishId))
    .innerJoin(s.stations, eq(s.stations.id, s.orderItems.stationId)).leftJoin(s.staff, eq(s.staff.id, s.orderItems.claimedBy))
    .where(and(eq(s.orderItems.restaurantId, me.rid), ne(s.sessions.status, 'closed'), status ? eq(s.orderItems.status, status as any) : undefined))
    .orderBy(desc(s.orderItems.id)).limit(300);
  let list = rows;
  if (me.role === 'waiter') {
    const mine = (await db.select().from(s.waiterTables).where(eq(s.waiterTables.staffId, me.sub))).map((x) => x.tableId);
    list = rows.filter((r) => mine.includes(r.tableId));
  }
  return out(c, list);
});

floor.post('/items/:id/served', requireStaff('waiter', 'owner', 'manager', 'admin'), async (c) => {
  const me = c.get('staff');
  const [it] = await db.update(s.orderItems).set({ status: 'served', servedAt: new Date() })
    .where(and(eq(s.orderItems.id, Number(c.req.param('id'))), eq(s.orderItems.restaurantId, me.rid), eq(s.orderItems.status, 'ready'))).returning();
  if (!it) fail(409, 'This dish is not ready yet');
  await notifyItem(me.rid, it.id);
  return c.json({ ok: true });
});

/** Void a dish. Waiters can cancel only dishes still waiting; the manager team can void anything not yet served. */
floor.post('/items/:id/cancel', zValidator('json', z.object({ reason: z.string().max(120).default('') })), async (c) => {
  const me = c.get('staff');
  const id = Number(c.req.param('id'));
  const [it] = await db.select().from(s.orderItems).where(and(eq(s.orderItems.id, id), eq(s.orderItems.restaurantId, me.rid)));
  if (!it) fail(404, 'Dish not found');
  if (me.role === 'chef') fail(403, 'Ask the manager to void dishes');
  if (me.role === 'waiter' && it.status !== 'waiting') fail(409, 'The kitchen has started this dish. Ask the manager to void it.');
  if (it.status === 'served' || it.status === 'cancelled') fail(409, 'This dish can no longer be cancelled');
  await db.update(s.orderItems).set({ status: 'cancelled' }).where(eq(s.orderItems.id, id));
  await log(me.rid, 'void', `${me.name} cancelled a dish${c.req.valid('json').reason ? ' · ' + c.req.valid('json').reason : ''}`, me.sub);
  await notifyItem(me.rid, id);
  return c.json({ ok: true });
});

/** Bill preview for a table */
floor.get('/sessions/:id/bill', async (c) => {
  const me = c.get('staff');
  if (!['owner', 'manager', 'waiter'].includes(me.role)) fail(403, 'Your role cannot see bills');
  const [ses] = await db.select().from(s.sessions).where(and(eq(s.sessions.id, Number(c.req.param('id'))), eq(s.sessions.restaurantId, me.rid)));
  if (!ses) fail(404, 'Not found');
  await assertTable(me, ses.tableId);
  const [r] = await db.select().from(s.restaurants).where(eq(s.restaurants.id, me.rid));
  const lines = await db.select({ name: s.dishes.name, qty: dsql<number>`sum(${s.orderItems.qty})::int`, unitPrice: s.orderItems.unitPrice })
    .from(s.orderItems).innerJoin(s.dishes, eq(s.dishes.id, s.orderItems.dishId))
    .where(and(eq(s.orderItems.sessionId, ses.id), ne(s.orderItems.status, 'cancelled'))).groupBy(s.dishes.name, s.orderItems.unitPrice);
  return c.json({ lines, ...(await sessionTotals(ses.id, r.taxPercent)), taxPercent: r.taxPercent, status: ses.status });
});

/** Take payment and free the table */
floor.post('/sessions/:id/pay', requireStaff('owner', 'manager', 'waiter'), zValidator('json', z.object({ method: z.enum(['cash', 'upi', 'card']), discount: z.number().int().min(0).default(0) })), async (c) => {
  const me = c.get('staff');
  const v = c.req.valid('json');
  const [ses] = await db.select().from(s.sessions).where(and(eq(s.sessions.id, Number(c.req.param('id'))), eq(s.sessions.restaurantId, me.rid)));
  if (!ses || ses.status === 'closed') fail(404, 'This table is already closed');
  const t = await assertTable(me, ses.tableId);
  if (me.role === 'waiter' && v.discount) fail(403, 'Only the manager can give a discount');
  const [busy] = await db.select({ n: dsql<number>`count(*)::int` }).from(s.orderItems).where(and(eq(s.orderItems.sessionId, ses.id), inArray(s.orderItems.status, ['cooking'])));
  if (busy.n) fail(409, `${busy.n} dish${busy.n > 1 ? 'es are' : ' is'} still cooking`);
  const [r] = await db.select().from(s.restaurants).where(eq(s.restaurants.id, me.rid));
  const tot = await sessionTotals(ses.id, r.taxPercent);
  const total = Math.max(0, tot.total - v.discount);
  await db.insert(s.bills).values({ restaurantId: me.rid, sessionId: ses.id, subtotal: tot.subtotal, tax: tot.tax, discount: v.discount, total, method: v.method, staffId: me.sub });
  await db.update(s.orderItems).set({ status: 'cancelled' }).where(and(eq(s.orderItems.sessionId, ses.id), eq(s.orderItems.status, 'waiting')));
  await db.update(s.sessions).set({ status: 'closed', closedAt: new Date() }).where(eq(s.sessions.id, ses.id));
  await db.update(s.tasks).set({ status: 'done', doneAt: new Date() }).where(and(eq(s.tasks.sessionId, ses.id), ne(s.tasks.status, 'done')));
  await log(me.rid, 'bill', `${t.code} paid by ${v.method.toUpperCase()}`, me.sub);
  emit([room.team(me.rid), room.waiters(me.rid), room.session(ses.id)], { type: 'table.updated', tableId: t.id });
  return c.json({ total });
});

/** Recent bills (billing page) */
floor.get('/bills', requireStaff('owner', 'manager'), async (c) => {
  const me = c.get('staff');
  const rows = await db.select({ id: s.bills.id, table: s.tables.code, total: s.bills.total, subtotal: s.bills.subtotal, tax: s.bills.tax, discount: s.bills.discount, method: s.bills.method, paidAt: s.bills.paidAt, guests: s.sessions.guestCount })
    .from(s.bills).innerJoin(s.sessions, eq(s.sessions.id, s.bills.sessionId)).innerJoin(s.tables, eq(s.tables.id, s.sessions.tableId))
    .where(eq(s.bills.restaurantId, me.rid)).orderBy(desc(s.bills.paidAt)).limit(100);
  return c.json(rows);
});

