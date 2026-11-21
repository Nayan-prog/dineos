import { Hono } from 'hono';
import { and, asc, eq, inArray, sql as dsql } from 'drizzle-orm';
import { z } from 'zod';
import { customerStartInput, customerVerifyInput, orderItemInput } from '@dineos/shared';
import { db, schema as s } from '../db/client.js';
import { zValidator } from '../lib/validate.js';
import { requireGuest, sign } from '../lib/auth.js';
import { fail, notifyItem, openSessionFor, placeOrder, raiseTask, sessionTotals, waiterFor, log } from '../lib/service.js';
import { emit, room } from '../lib/live.js';

/** Customer QR flow (mobile web): Sign in → Verify → Name → Guests → Menu → Review → Track → Bill → Thanks */
export const guest = new Hono();

async function tableByToken(qr: string) {
  const [t] = await db.select().from(s.tables).where(and(eq(s.tables.qrToken, qr), eq(s.tables.active, true)));
  if (!t) fail(404, 'This QR code is not valid any more. Ask a waiter for help.');
  return t!;
}

export async function menuFor(rid: number) {
  const cats = await db.select().from(s.categories).where(eq(s.categories.restaurantId, rid)).orderBy(asc(s.categories.sort));
  const ds = await db.select().from(s.dishes).where(eq(s.dishes.restaurantId, rid)).orderBy(asc(s.dishes.name));
  return cats.map((c) => ({ ...c, dishes: ds.filter((d) => d.categoryId === c.id) }));
}

guest.get('/table/:qr', async (c) => {
  const t = await tableByToken(c.req.param('qr'));
  const [r] = await db.select().from(s.restaurants).where(eq(s.restaurants.id, t.restaurantId));
  return c.json({ table: { id: t.id, code: t.code, seats: t.seats }, restaurant: { name: r.name, city: r.city, address: r.address, taxPercent: r.taxPercent }, menu: await menuFor(r.id) });
});

guest.post('/table/:qr/start', zValidator('json', customerStartInput), async (c) => {
  await tableByToken(c.req.param('qr'));
  const { phone } = c.req.valid('json');
  const code = process.env.DEV_OTP ? '123456' : String(Math.floor(100000 + Math.random() * 900000));
  await db.insert(s.otps).values({ phone, code, expiresAt: new Date(Date.now() + 5 * 60000) })
    .onConflictDoUpdate({ target: s.otps.phone, set: { code, expiresAt: new Date(Date.now() + 5 * 60000), attempts: 0 } });
  // Plug in an SMS provider (MSG91, Twilio…) here. In development the code is printed.
  console.log(`[otp] ${phone} → ${code}`);
  const [known] = await db.select({ name: s.customers.name }).from(s.customers).where(eq(s.customers.phone, phone));
  return c.json({ sent: true, knownName: known?.name || null, devCode: process.env.DEV_OTP ? code : undefined });
});

guest.post('/table/:qr/verify', zValidator('json', customerVerifyInput), async (c) => {
  const t = await tableByToken(c.req.param('qr'));
  const { phone, code, name } = c.req.valid('json');
  const [o] = await db.select().from(s.otps).where(eq(s.otps.phone, phone));
  if (!o || o.expiresAt < new Date()) fail(400, 'The code has expired. Send a new one.');
  if (o!.attempts >= 5) fail(400, 'Too many tries. Send a new code.');
  if (o!.code !== code) { await db.update(s.otps).set({ attempts: o!.attempts + 1 }).where(eq(s.otps.phone, phone)); fail(400, 'That code is not right'); }
  await db.delete(s.otps).where(eq(s.otps.phone, phone));
  const [cust] = await db.insert(s.customers).values({ phone, name: name ?? '' })
    .onConflictDoUpdate({ target: s.customers.phone, set: name ? { name } : { phone } }).returning();
  // join the table's open session, or open one
  let ses = await openSessionFor(t.id);
  const isNew = !ses;
  if (!ses) {
    [ses] = await db.insert(s.sessions).values({ restaurantId: t.restaurantId, tableId: t.id, customerId: cust.id, waiterId: await waiterFor(t.id), guestCount: 1 }).returning();
    await db.update(s.customers).set({ visits: dsql`${s.customers.visits} + 1` }).where(eq(s.customers.id, cust.id));
    emit([room.team(t.restaurantId), room.waiters(t.restaurantId)], { type: 'table.updated', tableId: t.id });
  } else if (!ses.customerId) {
    await db.update(s.sessions).set({ customerId: cust.id }).where(eq(s.sessions.id, ses.id));
  }
  const tok = await sign({ kind: 'guest', sub: cust.id, rid: t.restaurantId, tableId: t.id, sessionId: ses!.id }, '6h');
  return c.json({ token: tok, customer: { name: cust.name, phone: cust.phone }, needsName: !cust.name, needsGuests: isNew, sessionId: ses!.id });
});

const g = new Hono();
g.use('*', requireGuest);

g.post('/name', zValidator('json', z.object({ name: z.string().min(1).max(60) })), async (c) => {
  await db.update(s.customers).set({ name: c.req.valid('json').name }).where(eq(s.customers.id, c.get('guest').sub));
  return c.json({ ok: true });
});

g.post('/guests', zValidator('json', z.object({ count: z.number().int().min(1).max(30) })), async (c) => {
  const me = c.get('guest');
  await db.update(s.sessions).set({ guestCount: c.req.valid('json').count }).where(eq(s.sessions.id, me.sessionId));
  emit([room.team(me.rid)], { type: 'table.updated', tableId: me.tableId });
  return c.json({ ok: true });
});

g.post('/orders', zValidator('json', z.object({ items: z.array(orderItemInput).min(1).max(40) })), async (c) => {
  const me = c.get('guest');
  const res = await placeOrder(me.rid, me.sessionId, c.req.valid('json').items, {});
  return c.json({ orderId: res.order.id }, 201);
});

/** Everything the guest has ordered, with live status */
g.get('/session', async (c) => {
  const me = c.get('guest');
  const [ses] = await db.select().from(s.sessions).where(eq(s.sessions.id, me.sessionId));
  const items = await db.select({
    id: s.orderItems.id, dishId: s.orderItems.dishId, name: s.dishes.name, veg: s.dishes.veg, qty: s.orderItems.qty, guestNo: s.orderItems.guestNo, spice: s.orderItems.spice,
    options: s.orderItems.options, note: s.orderItems.note, unitPrice: s.orderItems.unitPrice, status: s.orderItems.status, createdAt: s.orderItems.createdAt,
  }).from(s.orderItems).innerJoin(s.dishes, eq(s.dishes.id, s.orderItems.dishId)).where(eq(s.orderItems.sessionId, me.sessionId)).orderBy(asc(s.orderItems.id));
  const [r] = await db.select().from(s.restaurants).where(eq(s.restaurants.id, me.rid));
  const [t] = await db.select({ code: s.tables.code }).from(s.tables).where(eq(s.tables.id, me.tableId));
  const [bill] = await db.select().from(s.bills).where(eq(s.bills.sessionId, me.sessionId));
  return c.json({ session: { id: ses.id, status: ses.status, guestCount: ses.guestCount }, table: t.code, items, totals: await sessionTotals(me.sessionId, r.taxPercent), taxPercent: r.taxPercent, paid: !!bill });
});

const editable = async (sessionId: number, id: number) => {
  const [it] = await db.select().from(s.orderItems).where(and(eq(s.orderItems.id, id), eq(s.orderItems.sessionId, sessionId)));
  if (!it) fail(404, 'Item not found');
  if (it!.status !== 'waiting') fail(409, 'The kitchen has started this dish, so it can no longer be changed');
  return it!;
};

/** Guests can change a dish only while it is still waiting */
g.patch('/items/:id', zValidator('json', z.object({ qty: z.number().int().min(1).max(50).optional(), note: z.string().max(200).optional(), spice: z.string().nullable().optional() })), async (c) => {
  const me = c.get('guest');
  const it = await editable(me.sessionId, Number(c.req.param('id')));
  const [row] = await db.update(s.orderItems).set(c.req.valid('json')).where(and(eq(s.orderItems.id, it.id), eq(s.orderItems.status, 'waiting'))).returning();
  if (!row) fail(409, 'The kitchen has started this dish, so it can no longer be changed');
  await notifyItem(me.rid, it.id);
  return c.json(row);
});

g.delete('/items/:id', async (c) => {
  const me = c.get('guest');
  const it = await editable(me.sessionId, Number(c.req.param('id')));
  const [row] = await db.update(s.orderItems).set({ status: 'cancelled' }).where(and(eq(s.orderItems.id, it.id), eq(s.orderItems.status, 'waiting'))).returning();
  if (!row) fail(409, 'The kitchen has started this dish, so it can no longer be cancelled');
  await notifyItem(me.rid, it.id);
  return c.json({ ok: true });
});

g.post('/call', zValidator('json', z.object({ note: z.string().max(120).default('') })), async (c) => {
  const me = c.get('guest');
  await raiseTask(me.rid, me.tableId, me.sessionId, 'call', c.req.valid('json').note || 'Guest is calling');
  return c.json({ ok: true });
});

g.post('/bill', zValidator('json', z.object({ method: z.enum(['cash', 'upi', 'card']) })), async (c) => {
  const me = c.get('guest');
  await db.update(s.sessions).set({ status: 'billing' }).where(and(eq(s.sessions.id, me.sessionId), eq(s.sessions.status, 'open')));
  await raiseTask(me.rid, me.tableId, me.sessionId, 'bill', `Paying by ${c.req.valid('json').method.toUpperCase()}`);
  const [t] = await db.select({ code: s.tables.code }).from(s.tables).where(eq(s.tables.id, me.tableId));
  await log(me.rid, 'bill', `${t.code} asked for the bill`);
  emit([room.team(me.rid)], { type: 'table.updated', tableId: me.tableId });
  return c.json({ ok: true });
});

guest.route('/me', g);
