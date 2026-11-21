import bcrypt from 'bcryptjs';
import { db, sql, schema as s } from './client.js';
import { token } from '../lib/util.js';
import { eq } from 'drizzle-orm';

const hash = (p: string) => bcrypt.hashSync(p, 8);
const minsAgo = (m: number) => new Date(Date.now() - m * 60000);

const [r] = await db.insert(s.restaurants).values({ name: 'Spice Garden', city: 'Pune', address: 'FC Road, Pune' }).returning();
const rid = r.id;

const areaRows = await db.insert(s.areas).values([
  { restaurantId: rid, name: 'Main hall', sort: 1 }, { restaurantId: rid, name: 'Terrace', sort: 2 }, { restaurantId: rid, name: 'Private room', sort: 3 },
]).returning();
const area = Object.fromEntries(areaRows.map((a) => [a.name, a.id]));

const stationRows = await db.insert(s.stations).values(['Tandoor', 'Curry', 'Chinese', 'South Indian'].map((name) => ({ restaurantId: rid, name }))).returning();
const st = Object.fromEntries(stationRows.map((x) => [x.name, x.id]));

const tableDefs: { code: string; areaId: number; seats: number; shape: 'round' | 'square' | 'long' }[] = [];
for (let i = 1; i <= 14; i++) tableDefs.push({ code: 'T' + i, areaId: area['Main hall'], seats: i % 5 === 0 ? 6 : i % 3 === 0 ? 2 : 4, shape: i % 4 === 0 ? 'round' : 'square' });
for (let i = 15; i <= 24; i++) tableDefs.push({ code: 'T' + i, areaId: area['Terrace'], seats: i % 2 ? 4 : 2, shape: 'round' });
tableDefs.push({ code: 'P1', areaId: area['Private room'], seats: 10, shape: 'long' }, { code: 'P2', areaId: area['Private room'], seats: 8, shape: 'long' });
const tableRows = await db.insert(s.tables).values(tableDefs.map((t) => ({ ...t, restaurantId: rid, qrToken: token() }))).returning();
const tbl = Object.fromEntries(tableRows.map((t) => [t.code, t]));

// ---------- staff ----------
// Managers sign in with email + password; waiters and chefs with phone + PIN.
const people = [
  { name: 'Nayan Patil', phone: '9800000001', email: 'owner@spicegarden.in', role: 'owner', password: 'dineos123' },
  { name: 'Kavya Rao', phone: '9800000002', email: 'manager@spicegarden.in', role: 'manager', password: 'dineos123' },
  { name: 'Arjun Mehta', phone: '9800000003', email: 'admin@spicegarden.in', role: 'admin', password: 'dineos123' },
  { name: 'Priya Sharma', phone: '9811111111', role: 'waiter', pin: '1111', areaId: area['Main hall'], tables: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] },
  { name: 'Rahul Desai', phone: '9811111112', role: 'waiter', pin: '1111', areaId: area['Main hall'], tables: ['T8', 'T9', 'T10', 'T11', 'T12', 'T13', 'T14'] },
  { name: 'Amit Verma', phone: '9811111113', role: 'waiter', pin: '1111', areaId: area['Terrace'], tables: ['T15', 'T16', 'T17', 'T18', 'T19', 'T20'] },
  { name: 'Neha Kulkarni', phone: '9811111114', role: 'waiter', pin: '1111', areaId: area['Terrace'], tables: ['T21', 'T22', 'T23', 'T24'] },
  { name: "John D'Souza", phone: '9811111115', role: 'waiter', pin: '1111', areaId: area['Private room'], tables: ['P1', 'P2'] },
  { name: 'Ravi Kumar', phone: '9822222221', role: 'chef', pin: '2222', stationId: st['Tandoor'] },
  { name: 'Imran Shaikh', phone: '9822222222', role: 'chef', pin: '2222', stationId: st['Tandoor'] },
  { name: 'Suresh Pawar', phone: '9822222223', role: 'chef', pin: '2222', stationId: st['Tandoor'], onBreak: true },
  { name: 'Anita Shah', phone: '9822222224', role: 'chef', pin: '2222', stationId: st['Curry'], maxParallel: 5 },
  { name: 'Meera Joshi', phone: '9822222225', role: 'chef', pin: '2222', stationId: st['Curry'], maxParallel: 5 },
  { name: 'Kenji Rao', phone: '9822222226', role: 'chef', pin: '2222', stationId: st['Chinese'] },
  { name: 'Samir Khan', phone: '9822222227', role: 'chef', pin: '2222', stationId: st['Chinese'] },
  { name: 'Sunil Pawar', phone: '9822222228', role: 'chef', pin: '2222', stationId: st['South Indian'], maxParallel: 3 },
] as const;

const staffIds: Record<string, number> = {};
for (const p of people) {
  const [row] = await db.insert(s.staff).values({
    restaurantId: rid, name: p.name, phone: p.phone, email: 'email' in p ? p.email : null, role: p.role,
    passwordHash: 'password' in p ? hash(p.password) : null, pinHash: 'pin' in p ? hash(p.pin) : null,
    stationId: 'stationId' in p ? p.stationId : null, areaId: 'areaId' in p ? p.areaId : null,
    maxParallel: 'maxParallel' in p ? p.maxParallel : 4, onBreak: 'onBreak' in p ? p.onBreak : false,
  }).returning();
  staffIds[p.name.split(' ')[0]] = row.id;
  if ('tables' in p) await db.insert(s.waiterTables).values(p.tables.map((c) => ({ staffId: row.id, tableId: tbl[c].id })));
}

// ---------- menu ----------
const catRows = await db.insert(s.categories).values(['Starters', 'Main course', 'Breads', 'Chinese', 'South Indian', 'Desserts', 'Drinks'].map((name, i) => ({ restaurantId: rid, name, sort: i }))).returning();
const cat = Object.fromEntries(catRows.map((c) => [c.name, c.id]));
type D = [string, string, string, number, boolean, number, string[]?, boolean?];
const D: D[] = [
  ['Paneer Tikka', 'Starters', 'Tandoor', 280, true, 15, ['No onion', 'Extra mint chutney']],
  ['Tandoori Chicken', 'Starters', 'Tandoor', 340, false, 18, ['Half', 'Full', 'Extra crispy']],
  ['Malai Tikka', 'Starters', 'Tandoor', 320, false, 15],
  ['Hara Bhara Kabab', 'Starters', 'Tandoor', 220, true, 12],
  ['Seekh Kabab', 'Starters', 'Tandoor', 300, false, 15],
  ['Butter Chicken', 'Main course', 'Curry', 360, false, 15, ['Boneless', 'Less butter']],
  ['Dal Makhani', 'Main course', 'Curry', 260, true, 12, ['Extra cream']],
  ['Paneer Butter Masala', 'Main course', 'Curry', 300, true, 14, ['Jain']],
  ['Veg Biryani', 'Main course', 'Curry', 280, true, 20, ['Raita on side']],
  ['Chicken Biryani', 'Main course', 'Curry', 340, false, 22],
  ['Butter Naan', 'Breads', 'Tandoor', 60, true, 6, ['Extra butter'], false],
  ['Garlic Naan', 'Breads', 'Tandoor', 70, true, 6, [], false],
  ['Tandoori Roti', 'Breads', 'Tandoor', 35, true, 5, [], false],
  ['Hakka Noodles', 'Chinese', 'Chinese', 240, true, 10, ['No garlic', 'Add egg']],
  ['Veg Manchurian', 'Chinese', 'Chinese', 230, true, 12, ['Dry', 'Gravy']],
  ['Chilli Chicken', 'Chinese', 'Chinese', 290, false, 12, ['Dry', 'Gravy']],
  ['Masala Dosa', 'South Indian', 'South Indian', 160, true, 10],
  ['Idli Sambar', 'South Indian', 'South Indian', 120, true, 8, [], false],
  ['Gulab Jamun', 'Desserts', 'South Indian', 120, true, 4, [], false],
  ['Sweet Lassi', 'Drinks', 'South Indian', 110, true, 3, [], false],
];
const dishRows = await db.insert(s.dishes).values(D.map(([name, c, station, rs, veg, prep, options = [], spice = true]) => ({
  restaurantId: rid, name, categoryId: cat[c], stationId: st[station], price: rs * 100, veg, prepMinutes: prep, options, hasSpice: spice,
}))).returning();
const dish = Object.fromEntries(dishRows.map((d) => [d.name, d]));

// ---------- a live evening so the dashboards are not empty ----------
type Line = [string, number, number, 'waiting' | 'cooking' | 'ready' | 'served', number, string?, string?];
async function live(code: string, guests: number, waiter: string, ageMin: number, lines: Line[], cust?: [string, string]) {
  let customerId: number | null = null;
  if (cust) customerId = (await db.insert(s.customers).values({ phone: cust[0], name: cust[1], visits: 2 }).returning())[0].id;
  const [ses] = await db.insert(s.sessions).values({ restaurantId: rid, tableId: tbl[code].id, guestCount: guests, waiterId: staffIds[waiter], customerId, openedAt: minsAgo(ageMin) }).returning();
  const [ord] = await db.insert(s.orders).values({ restaurantId: rid, sessionId: ses.id, placedBy: cust ? 'customer' : 'staff', staffId: cust ? null : staffIds[waiter], createdAt: minsAgo(ageMin - 2) }).returning();
  for (const [name, qty, guestNo, status, mins, chef, note] of lines) {
    const d = dish[name];
    await db.insert(s.orderItems).values({
      restaurantId: rid, orderId: ord.id, sessionId: ses.id, dishId: d.id, stationId: d.stationId, qty, guestNo, unitPrice: d.price, status, note: note ?? '',
      createdAt: minsAgo(mins), claimedBy: chef ? staffIds[chef] : null, claimedAt: status !== 'waiting' ? minsAgo(mins - 1) : null,
      readyAt: status === 'ready' || status === 'served' ? minsAgo(1) : null, servedAt: status === 'served' ? minsAgo(0) : null,
    });
  }
  return ses;
}
await live('T1', 2, 'Priya', 40, [['Malai Tikka', 2, 1, 'ready', 18, 'Imran'], ['Dal Makhani', 1, 0, 'served', 30, 'Anita']]);
await live('T3', 4, 'Priya', 25, [['Garlic Naan', 4, 0, 'ready', 5, 'Ravi'], ['Butter Chicken', 2, 0, 'cooking', 8, 'Anita'], ['Veg Biryani', 1, 3, 'waiting', 4]], ['9876543210', 'Rohan']);
await live('T4', 3, 'Priya', 20, [['Paneer Tikka', 1, 2, 'waiting', 9, undefined, 'No onion'], ['Hakka Noodles', 2, 0, 'ready', 6, 'Kenji']]);
const t5 = await live('T5', 3, 'Priya', 35, [['Paneer Tikka', 2, 1, 'cooking', 11, 'Imran', 'Medium spicy'], ['Masala Dosa', 1, 2, 'served', 20, 'Sunil']]);
await live('T7', 2, 'Priya', 22, [['Tandoori Chicken', 2, 1, 'waiting', 14, undefined, 'Extra crispy']]);
await live('T9', 4, 'Rahul', 30, [['Tandoori Chicken', 1, 1, 'cooking', 8, 'Ravi'], ['Chilli Chicken', 1, 2, 'ready', 10, 'Samir']]);
await live('T11', 5, 'Rahul', 12, [['Butter Naan', 3, 0, 'waiting', 3, undefined, 'Extra butter'], ['Dal Makhani', 2, 0, 'cooking', 5, 'Meera']]);
await live('T15', 4, 'Amit', 28, [['Butter Naan', 3, 0, 'ready', 6, 'Ravi'], ['Paneer Butter Masala', 1, 0, 'cooking', 9, 'Meera']]);
await live('T18', 2, 'Amit', 8, [['Veg Manchurian', 1, 0, 'waiting', 2], ['Sweet Lassi', 2, 0, 'waiting', 2]]);

await db.update(s.sessions).set({ status: 'billing' }).where(eq(s.sessions.id, t5.id));

// closed sessions earlier today so revenue and analytics have numbers
for (const [code, total, mins, method] of [['T2', 1240, 300, 'upi'], ['T6', 2180, 260, 'card'], ['T8', 960, 220, 'cash'], ['T16', 3140, 180, 'upi'], ['T12', 1580, 150, 'upi'], ['P1', 8420, 120, 'card']] as const) {
  const [ses] = await db.insert(s.sessions).values({ restaurantId: rid, tableId: tbl[code].id, guestCount: 3, status: 'closed', openedAt: minsAgo(mins + 60), closedAt: minsAgo(mins) }).returning();
  const sub = Math.round((total * 100) / 1.05);
  await db.insert(s.bills).values({ restaurantId: rid, sessionId: ses.id, subtotal: sub, tax: total * 100 - sub, total: total * 100, method, paidAt: minsAgo(mins) });
}

await db.insert(s.tasks).values([
  { restaurantId: rid, tableId: tbl['T1'].id, areaId: area['Main hall'], kind: 'food_ready', detail: '2 × Malai Tikka', assignedTo: staffIds['Priya'] },
  // pickups and requests for Priya's tables (shows To serve, Calls and Bills on her home screen)
  { restaurantId: rid, tableId: tbl['T3'].id, areaId: area['Main hall'], kind: 'food_ready', detail: '4 × Garlic Naan', assignedTo: staffIds['Priya'], createdAt: minsAgo(2) },
  { restaurantId: rid, tableId: tbl['T4'].id, areaId: area['Main hall'], kind: 'food_ready', detail: '2 × Hakka Noodles', assignedTo: staffIds['Priya'], createdAt: minsAgo(6) },
  { restaurantId: rid, tableId: tbl['T7'].id, areaId: area['Main hall'], kind: 'call', detail: 'Asked for water and extra plates', assignedTo: staffIds['Priya'], createdAt: minsAgo(1) },
  { restaurantId: rid, tableId: tbl['T5'].id, areaId: area['Main hall'], kind: 'bill', detail: '3 guests · paying by UPI', assignedTo: staffIds['Priya'], createdAt: minsAgo(4) },
  { restaurantId: rid, tableId: tbl['T9'].id, areaId: area['Main hall'], kind: 'call', detail: 'Guest is calling', assignedTo: staffIds['Rahul'], level: 1, escalatedAt: minsAgo(0), createdAt: minsAgo(1) },
  { restaurantId: rid, tableId: tbl['T15'].id, areaId: area['Terrace'], kind: 'food_ready', detail: '3 × Butter Naan', assignedTo: staffIds['Amit'], createdAt: minsAgo(3), level: 1, escalatedAt: minsAgo(2) },
]);
await db.insert(s.activity).values([
  { restaurantId: rid, kind: 'order', text: 'T18 placed an order · 2 items' },
  { restaurantId: rid, kind: 'ready', text: 'Ravi marked 3 × Butter Naan ready for T15' },
  { restaurantId: rid, kind: 'bill', text: 'P1 paid by card' },
]);

console.log(`Seeded Spice Garden (restaurant ${rid}).
  Owner    owner@spicegarden.in / dineos123
  Manager  manager@spicegarden.in / dineos123
  Admin    admin@spicegarden.in / dineos123
  Waiter   Priya 9811111111 · PIN 1111
  Chef     Ravi 9822222221 · PIN 2222
  Table QR for T1: /t/${tbl['T1'].qrToken}`);
await sql.end();
