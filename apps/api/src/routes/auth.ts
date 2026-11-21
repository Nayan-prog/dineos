import { Hono } from 'hono';
import { zValidator } from '../lib/validate.js';
import { and, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { loginInput, pinLoginInput, signupInput } from '@dineos/shared';
import { db, schema as s } from '../db/client.js';
import { requireStaff, sign } from '../lib/auth.js';
import { fail } from '../lib/service.js';
import { token } from '../lib/util.js';

export const auth = new Hono();

const publicStaff = (x: typeof s.staff.$inferSelect) => ({ id: x.id, name: x.name, role: x.role, phone: x.phone, email: x.email, stationId: x.stationId, areaId: x.areaId, maxParallel: x.maxParallel, onBreak: x.onBreak, restaurantId: x.restaurantId });

async function issue(x: typeof s.staff.$inferSelect) {
  const t = await sign({ kind: 'staff', sub: x.id, rid: x.restaurantId, role: x.role, name: x.name });
  return { token: t, staff: publicStaff(x) };
}

/** Owner, manager, admin: email + password */
auth.post('/login', zValidator('json', loginInput), async (c) => {
  const { email, password } = c.req.valid('json');
  const [x] = await db.select().from(s.staff).where(and(eq(s.staff.email, email.toLowerCase()), eq(s.staff.active, true)));
  if (!x?.passwordHash || !bcrypt.compareSync(password, x.passwordHash)) fail(400, 'Email or password is wrong');
  return c.json(await issue(x));
});

/** Waiters and chefs: phone + PIN */
auth.post('/pin', zValidator('json', pinLoginInput), async (c) => {
  const { phone, pin } = c.req.valid('json');
  const [x] = await db.select().from(s.staff).where(and(eq(s.staff.phone, phone), eq(s.staff.active, true)));
  if (!x?.pinHash || !bcrypt.compareSync(pin, x.pinHash)) fail(400, 'Phone number or PIN is wrong');
  await db.update(s.staff).set({ onDuty: true }).where(eq(s.staff.id, x.id));
  return c.json(await issue(x));
});

/** Create account: a new restaurant with its owner (or manager) */
auth.post('/signup', zValidator('json', signupInput), async (c) => {
  const v = c.req.valid('json');
  const [exists] = await db.select({ id: s.staff.id }).from(s.staff).where(eq(s.staff.email, v.email.toLowerCase()));
  if (exists) fail(409, 'An account with this email already exists');
  const [r] = await db.insert(s.restaurants).values({ name: v.restaurantName, city: v.city }).returning();
  await db.insert(s.areas).values({ restaurantId: r.id, name: 'Main hall' });
  const [x] = await db.insert(s.staff).values({
    restaurantId: r.id, name: v.name, email: v.email.toLowerCase(), phone: 'owner-' + token(4), role: v.role, passwordHash: bcrypt.hashSync(v.password, 10),
  }).returning();
  return c.json(await issue(x), 201);
});

auth.get('/me', requireStaff(), async (c) => {
  const [x] = await db.select().from(s.staff).where(eq(s.staff.id, c.get('staff').sub));
  if (!x) fail(404, 'Account not found');
  const [r] = await db.select().from(s.restaurants).where(eq(s.restaurants.id, x.restaurantId));
  return c.json({ staff: publicStaff(x), restaurant: { id: r.id, name: r.name, city: r.city } });
});

auth.post('/logout', requireStaff(), async (c) => {
  const me = c.get('staff');
  if (me.role === 'waiter' || me.role === 'chef') await db.update(s.staff).set({ onDuty: false }).where(eq(s.staff.id, me.sub));
  return c.json({ ok: true });
});
