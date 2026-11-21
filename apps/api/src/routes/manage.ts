import { Hono } from 'hono';
import { and, asc, desc, eq, gte, inArray, ne, sql as dsql } from 'drizzle-orm';
import { z } from 'zod';
import { dishInput } from '@dineos/shared';
import { db, schema as s } from '../db/client.js';
import { zValidator } from '../lib/validate.js';
import { requireStaff } from '../lib/auth.js';
import { fail, log } from '../lib/service.js';
import { out } from '../lib/util.js';

/** Manager team: dashboard, analytics, menu editing. Money is stripped for Admin by out(). */
export const manage = new Hono();
manage.use('*', requireStaff('owner', 'manager', 'admin'));

const startOfDay = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

manage.get('/dashboard', async (c) => {
  const me = c.get('staff');
  const today = startOfDay();
  // range: 1 = today, 7 / 28 = the last N days including today
  const dq = Number(c.req.query('days'));
  const days = dq === 7 || dq === 28 ? dq : 1;
  const since = days === 1 ? today : new Date(today.getTime() - (days - 1) * 86400000);
  // comparison window: same weekday last week for "today", otherwise the N days before
  const prevSince = days === 1 ? new Date(today.getTime() - 7 * 86400000) : new Date(since.getTime() - days * 86400000);
  const prevUntil = days === 1 ? new Date(prevSince.getTime() + 86400000) : since;
  const [rev] = await db.select({ revenue: dsql<number>`coalesce(sum(${s.bills.total}),0)::int`, bills: dsql<number>`count(*)::int` }).from(s.bills).where(and(eq(s.bills.restaurantId, me.rid), gte(s.bills.paidAt, since)));
  const [ord] = await db.select({ n: dsql<number>`count(*)::int` }).from(s.orders).where(and(eq(s.orders.restaurantId, me.rid), gte(s.orders.createdAt, since)));
  const [prep] = await db.select({ m: dsql<number>`coalesce(avg(extract(epoch from (${s.orderItems.readyAt} - ${s.orderItems.createdAt})) / 60), 0)::float` })
    .from(s.orderItems).where(and(eq(s.orderItems.restaurantId, me.rid), gte(s.orderItems.createdAt, since), dsql`${s.orderItems.readyAt} is not null`));
  const tables = await db.select({ id: s.tables.id }).from(s.tables).where(and(eq(s.tables.restaurantId, me.rid), eq(s.tables.active, true)));
  const open = await db.select({ id: s.sessions.id }).from(s.sessions).where(and(eq(s.sessions.restaurantId, me.rid), ne(s.sessions.status, 'closed')));
  const pipeline = await db.select({ status: s.orderItems.status, n: dsql<number>`count(*)::int` }).from(s.orderItems)
    .innerJoin(s.sessions, eq(s.sessions.id, s.orderItems.sessionId)).where(and(eq(s.orderItems.restaurantId, me.rid), ne(s.sessions.status, 'closed'))).groupBy(s.orderItems.status);
  const dishes = await db.select({
    name: s.dishes.name, veg: s.dishes.veg, station: s.stations.name,
    total: dsql<number>`sum(${s.orderItems.qty})::int`,
    done: dsql<number>`sum(${s.orderItems.qty}) filter (where ${s.orderItems.status} in ('ready','served'))::int`,
    cooking: dsql<number>`coalesce(sum(${s.orderItems.qty}) filter (where ${s.orderItems.status} = 'cooking'),0)::int`,
  }).from(s.orderItems).innerJoin(s.dishes, eq(s.dishes.id, s.orderItems.dishId)).innerJoin(s.stations, eq(s.stations.id, s.dishes.stationId))
    .where(and(eq(s.orderItems.restaurantId, me.rid), gte(s.orderItems.createdAt, since), ne(s.orderItems.status, 'cancelled')))
    .groupBy(s.dishes.name, s.dishes.veg, s.stations.name).orderBy(dsql`sum(${s.orderItems.qty}) desc`).limit(6);
  const chefs = await db.select({
    id: s.staff.id, name: s.staff.name, station: s.stations.name, stationId: s.staff.stationId, maxParallel: s.staff.maxParallel, onBreak: s.staff.onBreak,
    done: dsql<number>`(select count(*) from order_items oi where oi.claimed_by = ${s.staff.id} and oi.ready_at >= ${since.toISOString()}::timestamptz)::int`,
    cooking: dsql<number>`(select count(*) from order_items oi where oi.claimed_by = ${s.staff.id} and oi.status = 'cooking')::int`,
    avg: dsql<number>`(select coalesce(avg(extract(epoch from (oi.ready_at - oi.claimed_at))/60),0) from order_items oi where oi.claimed_by = ${s.staff.id} and oi.ready_at >= ${since.toISOString()}::timestamptz)::float`,
  }).from(s.staff).innerJoin(s.stations, eq(s.stations.id, s.staff.stationId)).where(and(eq(s.staff.restaurantId, me.rid), eq(s.staff.role, 'chef'), eq(s.staff.active, true))).orderBy(asc(s.stations.id));
  const queues = await db.select({ stationId: s.orderItems.stationId, n: dsql<number>`count(*)::int` }).from(s.orderItems)
    .where(and(eq(s.orderItems.restaurantId, me.rid), eq(s.orderItems.status, 'waiting'))).groupBy(s.orderItems.stationId);
  const stationRows = await db.select({ id: s.stations.id, name: s.stations.name }).from(s.stations).where(eq(s.stations.restaurantId, me.rid)).orderBy(asc(s.stations.id));
  const liveItems = await db.select({
    stationId: s.orderItems.stationId, status: s.orderItems.status, qty: s.orderItems.qty, remake: s.orderItems.remake, createdAt: s.orderItems.createdAt,
    name: s.dishes.name, prep: s.dishes.prepMinutes, table: s.tables.code,
  }).from(s.orderItems)
    .innerJoin(s.sessions, eq(s.sessions.id, s.orderItems.sessionId))
    .innerJoin(s.tables, eq(s.tables.id, s.sessions.tableId))
    .innerJoin(s.dishes, eq(s.dishes.id, s.orderItems.dishId))
    .where(and(eq(s.orderItems.restaurantId, me.rid), ne(s.sessions.status, 'closed'), inArray(s.orderItems.status, ['waiting', 'cooking', 'ready'])));
  const chefRows = await db.select({ stationId: s.staff.stationId, onDuty: s.staff.onDuty, onBreak: s.staff.onBreak }).from(s.staff)
    .where(and(eq(s.staff.restaurantId, me.rid), eq(s.staff.role, 'chef'), eq(s.staff.active, true)));
  const nowMs = Date.now();
  const ageMin = (t: Date) => Math.max(0, Math.floor((nowMs - t.getTime()) / 60000));
  const stationQueues = stationRows.map((st) => {
    const items = liveItems.filter((i) => i.stationId === st.id);
    const waiting = items.filter((i) => i.status === 'waiting');
    const isLate = (i: (typeof items)[number]) => ageMin(i.createdAt) > i.prep;
    const chefsHere = chefRows.filter((ch) => ch.stationId === st.id);
    const next = [...waiting]
      .sort((a, b) => Number(b.remake) - Number(a.remake) || Number(isLate(b)) - Number(isLate(a)) || a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, 3).map((i) => ({ table: i.table, qty: i.qty, name: i.name, minutes: ageMin(i.createdAt), remake: i.remake }));
    return {
      id: st.id, name: st.name,
      waiting: waiting.length,
      cooking: items.filter((i) => i.status === 'cooking').length,
      ready: items.filter((i) => i.status === 'ready').length,
      oldestWaitMin: waiting.length ? Math.max(...waiting.map((i) => ageMin(i.createdAt))) : 0,
      late: items.filter((i) => (i.status === 'waiting' || i.status === 'cooking') && isLate(i)).length,
      chefsOnDuty: chefsHere.filter((ch) => ch.onDuty && !ch.onBreak).length,
      chefsTotal: chefsHere.length,
      next,
    };
  });
  const alerts = await db.select({ n: dsql<number>`count(*)::int` }).from(s.tasks).where(and(eq(s.tasks.restaurantId, me.rid), eq(s.tasks.status, 'open'), eq(s.tasks.level, 2)));
  const hourly = await db.select({ h: dsql<number>`extract(hour from ${s.bills.paidAt})::int`, revenue: dsql<number>`sum(${s.bills.total})::int` })
    .from(s.bills).where(and(eq(s.bills.restaurantId, me.rid), gte(s.bills.paidAt, since))).groupBy(dsql`1`).orderBy(dsql`1`);
  // extras for the phone dashboard (no money; the revenue change is added only for roles that may see money)
  const [prevOrd] = await db.select({ n: dsql<number>`count(*)::int` }).from(s.orders).where(and(eq(s.orders.restaurantId, me.rid), gte(s.orders.createdAt, prevSince), dsql`${s.orders.createdAt} < ${prevUntil.toISOString()}::timestamptz`));
  const [prevRev] = me.role === 'admin' ? [{ revenue: 0 }] : await db.select({ revenue: dsql<number>`coalesce(sum(${s.bills.total}),0)::int` }).from(s.bills).where(and(eq(s.bills.restaurantId, me.rid), gte(s.bills.paidAt, prevSince), dsql`${s.bills.paidAt} < ${prevUntil.toISOString()}::timestamptz`));
  const [openOrd] = await db.select({ n: dsql<number>`count(distinct ${s.orderItems.orderId})::int` }).from(s.orderItems)
    .innerJoin(s.sessions, eq(s.sessions.id, s.orderItems.sessionId)).where(and(eq(s.orderItems.restaurantId, me.rid), ne(s.sessions.status, 'closed'), inArray(s.orderItems.status, ['waiting', 'cooking', 'ready'])));
  const [target] = await db.select({ m: dsql<number>`coalesce(avg(${s.dishes.prepMinutes}),0)::float` }).from(s.orderItems).innerJoin(s.dishes, eq(s.dishes.id, s.orderItems.dishId))
    .where(and(eq(s.orderItems.restaurantId, me.rid), gte(s.orderItems.createdAt, since)));
  const [billed] = await db.select({ n: dsql<number>`count(*)::int` }).from(s.orderItems).innerJoin(s.sessions, eq(s.sessions.id, s.orderItems.sessionId))
    .where(and(eq(s.orderItems.restaurantId, me.rid), eq(s.sessions.status, 'closed'), eq(s.orderItems.status, 'served'), gte(s.orderItems.createdAt, since)));
  const [seatRow] = await db.select({ seats: dsql<number>`coalesce(sum(${s.tables.seats}),0)::int` }).from(s.tables).where(and(eq(s.tables.restaurantId, me.rid), eq(s.tables.active, true)));
  const [guestRow] = await db.select({ guests: dsql<number>`coalesce(sum(${s.sessions.guestCount}),0)::int` }).from(s.sessions).where(and(eq(s.sessions.restaurantId, me.rid), ne(s.sessions.status, 'closed')));
  const lateByTable = new Map<string, number>();
  for (const i of liveItems) if ((i.status === 'waiting' || i.status === 'cooking') && ageMin(i.createdAt) > i.prep) lateByTable.set(i.table, Math.max(lateByTable.get(i.table) ?? 0, ageMin(i.createdAt)));
  const soldOut = await db.select({ name: s.dishes.name }).from(s.dishes).where(and(eq(s.dishes.restaurantId, me.rid), eq(s.dishes.available, false))).limit(2);
  const loadByStation = stationRows.map((st) => {
    const here = chefs.filter((ch) => ch.stationId === st.id && !ch.onBreak);
    const cap = here.reduce((a, ch) => a + ch.maxParallel, 0);
    return { name: st.name, load: cap ? Math.round((here.reduce((a, ch) => a + ch.cooking, 0) / cap) * 100) : 0 };
  }).filter((x) => x.load >= 85);
  const attention = [
    ...[...lateByTable.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([tb, m]) => ({ kind: 'Delay', text: `Table ${tb} waiting ${m} min` })),
    ...soldOut.map((d) => ({ kind: 'Stock', text: `${d.name} out of stock` })),
    ...loadByStation.slice(0, 1).map((x) => ({ kind: 'Load', text: `${x.name} station at ${x.load}%` })),
  ];
  return out(c, {
    range: { days, compare: days === 1 ? 'last week' : `prev ${days} days` },
    attention,
    kpis: {
      revenue: rev.revenue, bills: rev.bills, orders: ord.n, avgPrepMinutes: Math.round(prep.m), occupied: open.length, tables: tables.length,
      prevOrders: prevOrd.n, openOrders: openOrd.n, targetPrepMinutes: Math.round(target.m), guests: guestRow.guests, seats: seatRow.seats,
      ...(me.role === 'admin' ? {} : { revenueChangePct: prevRev.revenue ? Math.round(((rev.revenue - prevRev.revenue) / prevRev.revenue) * 100) : null }),
    },
    pipeline: { ...Object.fromEntries(pipeline.map((p) => [p.status, p.n])), billed: billed.n },
    dishes, chefs: chefs.map((ch) => ({ ...ch, avg: Math.round(ch.avg), load: Math.round((ch.cooking / ch.maxParallel) * 100) })),
    queues, stations: stationQueues, managerAlerts: alerts[0].n, hourly,
  });
});

manage.get('/analytics', async (c) => {
  const me = c.get('staff');
  const since = new Date(Date.now() - 7 * 86400000);
  const days = await db.select({ day: dsql<string>`to_char(${s.bills.paidAt}, 'Dy DD')`, d: dsql<string>`date(${s.bills.paidAt})`, revenue: dsql<number>`sum(${s.bills.total})::int`, bills: dsql<number>`count(*)::int` })
    .from(s.bills).where(and(eq(s.bills.restaurantId, me.rid), gte(s.bills.paidAt, since))).groupBy(dsql`1`, dsql`2`).orderBy(dsql`2`);
  const top = await db.select({ name: s.dishes.name, qty: dsql<number>`sum(${s.orderItems.qty})::int`, revenue: dsql<number>`sum(${s.orderItems.qty} * ${s.orderItems.unitPrice})::int` })
    .from(s.orderItems).innerJoin(s.dishes, eq(s.dishes.id, s.orderItems.dishId))
    .where(and(eq(s.orderItems.restaurantId, me.rid), gte(s.orderItems.createdAt, since), ne(s.orderItems.status, 'cancelled'))).groupBy(s.dishes.name).orderBy(dsql`2 desc`).limit(10);
  const methods = await db.select({ method: s.bills.method, revenue: dsql<number>`sum(${s.bills.total})::int`, n: dsql<number>`count(*)::int` })
    .from(s.bills).where(and(eq(s.bills.restaurantId, me.rid), gte(s.bills.paidAt, since))).groupBy(s.bills.method);
  return out(c, { days, top, methods });
});

// ---------------- menu editing ----------------
manage.get('/categories', async (c) => c.json(await db.select().from(s.categories).where(eq(s.categories.restaurantId, c.get('staff').rid)).orderBy(asc(s.categories.sort))));

manage.post('/categories', zValidator('json', z.object({ name: z.string().min(1).max(40) })), async (c) => {
  const [x] = await db.insert(s.categories).values({ restaurantId: c.get('staff').rid, name: c.req.valid('json').name, sort: 99 }).returning();
  return c.json(x, 201);
});

manage.post('/dishes', zValidator('json', dishInput), async (c) => {
  const me = c.get('staff');
  if (me.role === 'admin') fail(403, 'Ask the owner or manager to set prices for new dishes');
  const [d] = await db.insert(s.dishes).values({ ...c.req.valid('json'), restaurantId: me.rid }).returning();
  await log(me.rid, 'menu', `${d.name} added to the menu`, me.sub);
  return c.json(d, 201);
});

manage.patch('/dishes/:id', zValidator('json', dishInput.partial()), async (c) => {
  const me = c.get('staff');
  const v = c.req.valid('json');
  if (me.role === 'admin' && v.price !== undefined) fail(403, 'Only the owner or manager can change prices');
  const [d] = await db.update(s.dishes).set(v).where(and(eq(s.dishes.id, Number(c.req.param('id'))), eq(s.dishes.restaurantId, me.rid))).returning();
  if (!d) fail(404, 'Dish not found');
  return out(c, d);
});

manage.get('/customers', async (c) => {
  const me = c.get('staff');
  const rows = await db.select({ id: s.customers.id, name: s.customers.name, phone: s.customers.phone, visits: s.customers.visits,
    spend: dsql<number>`coalesce((select sum(b.total) from bills b join table_sessions ts on ts.id = b.session_id where ts.customer_id = ${s.customers.id} and ts.restaurant_id = ${me.rid}),0)::int` })
    .from(s.customers).where(inArray(s.customers.id, db.select({ id: s.sessions.customerId }).from(s.sessions).where(eq(s.sessions.restaurantId, me.rid)) as any)).orderBy(desc(s.customers.visits)).limit(100);
  return out(c, rows);
});
