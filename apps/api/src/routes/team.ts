import { Hono } from 'hono';
import { and, asc, desc, eq, inArray, ne, or, sql as dsql } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { staffInput } from '@dineos/shared';
import { db, schema as s } from '../db/client.js';
import { zValidator } from '../lib/validate.js';
import { requireStaff } from '../lib/auth.js';
import { fail, log } from '../lib/service.js';
import { emit, room } from '../lib/live.js';
import { out } from '../lib/util.js';

export const team = new Hono();
team.use('*', requireStaff());
const mgr = requireStaff('owner', 'manager', 'admin');

// ---------------- alerts (service tasks) ----------------
/**
 * What a waiter sees:
 *   level 0 → only the table's waiter
 *   level 1 → every on-duty waiter in that area (the hand-off)
 *   level 2 → also the manager team
 */
team.get('/tasks', async (c) => {
  const me = c.get('staff');
  const [x] = await db.select().from(s.staff).where(eq(s.staff.id, me.sub));
  const base = db.select({
    id: s.tasks.id, kind: s.tasks.kind, detail: s.tasks.detail, level: s.tasks.level, status: s.tasks.status, table: s.tables.code, tableId: s.tables.id, areaId: s.tasks.areaId,
    assignedTo: s.tasks.assignedTo, takenBy: s.tasks.takenBy, createdAt: s.tasks.createdAt, escalatedAt: s.tasks.escalatedAt, sessionId: s.tasks.sessionId,
  }).from(s.tasks).innerJoin(s.tables, eq(s.tables.id, s.tasks.tableId));
  const rows = await base.where(and(eq(s.tasks.restaurantId, me.rid), or(ne(s.tasks.status, 'done'), dsql`${s.tasks.doneAt} > now() - interval '10 minutes'`))).orderBy(asc(s.tasks.createdAt));
  const names = Object.fromEntries((await db.select({ id: s.staff.id, name: s.staff.name }).from(s.staff).where(eq(s.staff.restaurantId, me.rid))).map((p) => [p.id, p.name]));
  const [r] = await db.select().from(s.restaurants).where(eq(s.restaurants.id, me.rid));
  const visible = rows.filter((t) => {
    if (me.role !== 'waiter') return true;
    if (t.takenBy === me.sub || t.assignedTo === me.sub) return true;
    return t.status !== 'done' && t.level >= 1 && (t.areaId === x.areaId || t.level === 2);
  });
  return c.json({
    rules: { areaSecs: r.alertAreaSecs, managerSecs: r.alertManagerSecs },
    tasks: visible.map((t) => ({ ...t, assignedName: t.assignedTo ? names[t.assignedTo] : null, takenName: t.takenBy ? names[t.takenBy] : null, mine: t.takenBy === me.sub, ownTable: t.assignedTo === me.sub })),
  });
});

/** "On it": the first person to tap takes the alert; it disappears for everyone else */
team.post('/tasks/:id/take', async (c) => {
  const me = c.get('staff');
  const [t] = await db.update(s.tasks).set({ status: 'taken', takenBy: me.sub, takenAt: new Date() })
    .where(and(eq(s.tasks.id, Number(c.req.param('id'))), eq(s.tasks.restaurantId, me.rid), eq(s.tasks.status, 'open'))).returning();
  if (!t) fail(409, 'Someone else is already on it');
  emit([room.waiters(me.rid), room.team(me.rid)], { type: 'task.updated', taskId: t.id, status: t.status, level: t.level });
  return c.json(t);
});

team.post('/tasks/:id/done', async (c) => {
  const me = c.get('staff');
  const [t] = await db.update(s.tasks).set({ status: 'done', doneAt: new Date() })
    .where(and(eq(s.tasks.id, Number(c.req.param('id'))), eq(s.tasks.restaurantId, me.rid), ne(s.tasks.status, 'done'))).returning();
  if (!t) fail(409, 'Already done');
  // food delivered → mark the ready dishes at that table as served
  if (t.kind === 'food_ready' && t.sessionId) {
    const served = await db.update(s.orderItems).set({ status: 'served', servedAt: new Date() }).where(and(eq(s.orderItems.sessionId, t.sessionId), eq(s.orderItems.status, 'ready'))).returning({ id: s.orderItems.id });
    if (served.length) emit([room.team(me.rid), room.session(t.sessionId)], { type: 'table.updated', tableId: t.tableId });
  }
  emit([room.waiters(me.rid), room.team(me.rid)], { type: 'task.updated', taskId: t.id, status: t.status, level: t.level });
  return c.json(t);
});

// ---------------- staff & shifts ----------------
team.get('/staff', async (c) => {
  const me = c.get('staff');
  const people = await db.select({
    id: s.staff.id, name: s.staff.name, phone: s.staff.phone, email: s.staff.email, role: s.staff.role, stationId: s.staff.stationId, areaId: s.staff.areaId,
    maxParallel: s.staff.maxParallel, onDuty: s.staff.onDuty, onBreak: s.staff.onBreak, active: s.staff.active,
    cooking: dsql<number>`(select count(*) from order_items oi where oi.claimed_by = ${s.staff.id} and oi.status = 'cooking')::int`,
    doneToday: dsql<number>`(select count(*) from order_items oi where oi.claimed_by = ${s.staff.id} and oi.ready_at > now() - interval '18 hours')::int`,
    ordersToday: dsql<number>`(select count(*) from orders o where o.staff_id = ${s.staff.id} and o.created_at >= date_trunc('day', now()))::int`,
  }).from(s.staff).where(and(eq(s.staff.restaurantId, me.rid), eq(s.staff.active, true))).orderBy(asc(s.staff.role), asc(s.staff.id));
  const sections = await db.select({ staffId: s.waiterTables.staffId, tableId: s.tables.id, code: s.tables.code }).from(s.waiterTables).innerJoin(s.tables, eq(s.tables.id, s.waiterTables.tableId)).where(eq(s.tables.restaurantId, me.rid)).orderBy(asc(s.tables.id));
  const stations = await db.select().from(s.stations).where(eq(s.stations.restaurantId, me.rid));
  const areas = await db.select().from(s.areas).where(eq(s.areas.restaurantId, me.rid)).orderBy(asc(s.areas.sort));
  const [r] = await db.select().from(s.restaurants).where(eq(s.restaurants.id, me.rid));
  return out(c, {
    staff: people.map((p) => ({ ...p, tables: sections.filter((x) => x.staffId === p.id).map((x) => ({ id: x.tableId, code: x.code })) })),
    stations, areas, rules: { areaSecs: r.alertAreaSecs, managerSecs: r.alertManagerSecs },
  });
});

team.post('/staff', mgr, zValidator('json', staffInput), async (c) => {
  const me = c.get('staff');
  const v = c.req.valid('json');
  if ((v.role === 'owner' || v.role === 'manager') && me.role === 'admin') fail(403, 'Only the owner or manager can add managers');
  if ((v.role === 'waiter' || v.role === 'chef') && !v.pin) fail(400, 'Set a 4 digit PIN for staff sign-in');
  if (['owner', 'manager', 'admin'].includes(v.role) && (!v.email || !v.password)) fail(400, 'Managers need an email and password');
  const [dupe] = await db.select({ id: s.staff.id }).from(s.staff).where(eq(s.staff.phone, v.phone));
  if (dupe) fail(409, 'This phone number is already on the team');
  const [x] = await db.insert(s.staff).values({
    restaurantId: me.rid, name: v.name, phone: v.phone, email: v.email?.toLowerCase() ?? null, role: v.role,
    pinHash: v.pin ? bcrypt.hashSync(v.pin, 10) : null, passwordHash: v.password ? bcrypt.hashSync(v.password, 10) : null,
    stationId: v.stationId ?? null, areaId: v.areaId ?? null, maxParallel: v.maxParallel, onDuty: false,
  }).returning({ id: s.staff.id, name: s.staff.name, role: s.staff.role });
  await log(me.rid, 'staff', `${x.name} joined as ${x.role}`, me.sub);
  return c.json(x, 201);
});

/** Shift changes: station, area, max dishes at once, break, active */
team.patch('/staff/:id', zValidator('json', z.object({
  stationId: z.number().int().nullable().optional(), areaId: z.number().int().nullable().optional(), maxParallel: z.number().int().min(1).max(10).optional(),
  onBreak: z.boolean().optional(), active: z.boolean().optional(),
})), async (c) => {
  const me = c.get('staff');
  const id = Number(c.req.param('id'));
  const v = c.req.valid('json');
  const self = id === me.sub;
  const manager = ['owner', 'manager', 'admin'].includes(me.role);
  if (!manager && !(self && Object.keys(v).every((k) => k === 'onBreak'))) fail(403, 'Only the manager can change shifts');
  const [x] = await db.update(s.staff).set(v).where(and(eq(s.staff.id, id), eq(s.staff.restaurantId, me.rid))).returning();
  if (!x) fail(404, 'Not found');
  if (v.onBreak === true && x.role === 'waiter') {
    // open alerts for this waiter's tables go to the rest of the area right away
    await db.update(s.tasks).set({ level: 1, escalatedAt: new Date() }).where(and(eq(s.tasks.assignedTo, id), eq(s.tasks.status, 'open'), eq(s.tasks.level, 0)));
  }
  if (v.onBreak !== undefined) await log(me.rid, 'shift', `${x.name} ${v.onBreak ? 'went on break' : 'is back on duty'}`, me.sub);
  emit([room.team(me.rid), room.waiters(me.rid), ...(x.stationId ? [room.station(me.rid, x.stationId)] : [])], { type: 'staff.updated', staffId: id });
  return c.json({ id: x.id, onBreak: x.onBreak, maxParallel: x.maxParallel, stationId: x.stationId, areaId: x.areaId });
});

/** Replace a waiter's tables (sections). A table can belong to only one waiter. */
team.put('/staff/:id/tables', mgr, zValidator('json', z.object({ tableIds: z.array(z.number().int()) })), async (c) => {
  const me = c.get('staff');
  const id = Number(c.req.param('id'));
  const { tableIds } = c.req.valid('json');
  await db.delete(s.waiterTables).where(eq(s.waiterTables.staffId, id));
  if (tableIds.length) {
    await db.delete(s.waiterTables).where(inArray(s.waiterTables.tableId, tableIds));
    await db.insert(s.waiterTables).values(tableIds.map((t) => ({ staffId: id, tableId: t })));
  }
  emit([room.team(me.rid), room.waiters(me.rid)], { type: 'staff.updated', staffId: id });
  return c.json({ ok: true });
});

// ---------------- settings ----------------
team.get('/restaurant', async (c) => {
  const [r] = await db.select().from(s.restaurants).where(eq(s.restaurants.id, c.get('staff').rid));
  return out(c, r);
});

team.patch('/restaurant', requireStaff('owner', 'manager'), zValidator('json', z.object({
  name: z.string().min(2).optional(), city: z.string().optional(), address: z.string().optional(), taxPercent: z.number().int().min(0).max(28).optional(),
  alertAreaSecs: z.number().int().min(15).max(600).optional(), alertManagerSecs: z.number().int().min(30).max(1200).optional(),
})), async (c) => {
  const v = c.req.valid('json');
  if (v.alertAreaSecs && v.alertManagerSecs && v.alertManagerSecs <= v.alertAreaSecs) fail(400, 'The manager step must come after the area step');
  const [r] = await db.update(s.restaurants).set(v).where(eq(s.restaurants.id, c.get('staff').rid)).returning();
  return c.json(r);
});

team.get('/activity', async (c) => {
  const rows = await db.select().from(s.activity).where(eq(s.activity.restaurantId, c.get('staff').rid)).orderBy(desc(s.activity.id)).limit(30);
  return c.json(rows);
});

/** My numbers today (profile): orders I took, tables I served, average minutes from ready to served */
team.get('/stats/me', async (c) => {
  const me = c.get('staff');
  const [o] = await db.select({ orders: dsql<number>`count(*)::int`, tables: dsql<number>`count(distinct ${s.orders.sessionId})::int` }).from(s.orders)
    .where(and(eq(s.orders.restaurantId, me.rid), eq(s.orders.staffId, me.sub), dsql`${s.orders.createdAt} >= date_trunc('day', now())`));
  const [sv] = await db.select({ m: dsql<number>`coalesce(avg(extract(epoch from (${s.orderItems.servedAt} - ${s.orderItems.readyAt})) / 60), 0)::float` }).from(s.orderItems)
    .innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId))
    .where(and(eq(s.orders.staffId, me.sub), dsql`${s.orderItems.servedAt} >= date_trunc('day', now())`, dsql`${s.orderItems.readyAt} is not null`));
  return c.json({ tablesServed: o.tables, ordersTaken: o.orders, avgServeMin: Math.round(sv.m) });
});
