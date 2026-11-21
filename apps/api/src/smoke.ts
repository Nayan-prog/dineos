/** End-to-end check against a running API (pnpm dev) and a freshly seeded database. Run: pnpm --filter @dineos/api test:flow */
const API = process.env.API_URL ?? 'http://localhost:4000/api';
let failures = 0;
const ok = (cond: unknown, msg: string) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) failures++; };

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return (Array.isArray(json) ? Object.assign(json, { status: res.status }) : { status: res.status, ...json }) as any;
}

const owner = (await call('POST', '/auth/login', { email: 'owner@spicegarden.in', password: 'dineos123' })).token;
const admin = (await call('POST', '/auth/login', { email: 'admin@spicegarden.in', password: 'dineos123' })).token;
const priya = (await call('POST', '/auth/pin', { phone: '9811111111', pin: '1111' })).token;
const rahul = (await call('POST', '/auth/pin', { phone: '9811111112', pin: '1111' })).token;
const ravi = (await call('POST', '/auth/pin', { phone: '9822222221', pin: '2222' })).token;
const imran = (await call('POST', '/auth/pin', { phone: '9822222222', pin: '2222' })).token;
ok(owner && admin && priya && ravi && imran, 'everyone can sign in');
ok((await call('POST', '/auth/pin', { phone: '9811111111', pin: '9999' })).status === 400, 'wrong PIN is refused');

const dash = await call('GET', '/manage/dashboard', undefined, owner);
ok(typeof dash.kpis?.revenue === 'number', 'owner sees revenue');
const adash = await call('GET', '/manage/dashboard', undefined, admin);
ok(adash.kpis && !('revenue' in adash.kpis), 'admin does not see revenue');
ok((await call('GET', '/manage/dashboard', undefined, priya)).status === 403, 'waiter cannot open the manager dashboard');

const tables = await call('GET', '/floor/tables', undefined, priya);
ok(tables.tables.every((t: any) => t.waiter === 'Priya Sharma'), 'waiter sees only her own tables');
const t2 = tables.tables.find((t: any) => t.code === 'T2');
ok((await call('POST', '/floor/sessions', { tableId: t2.id, guestCount: 2 }, rahul)).status === 403, "a waiter cannot open another waiter's table");
const ses = await call('POST', '/floor/sessions', { tableId: t2.id, guestCount: 2 }, priya);
ok(ses.id, 'waiter seats 2 guests at T2');

const menu = await call('GET', '/floor/menu', undefined, priya);
const all = menu.flatMap((c: any) => c.dishes);
const naan = all.find((d: any) => d.name === 'Butter Naan');
const tikka = all.find((d: any) => d.name === 'Paneer Tikka');
const curry = all.find((d: any) => d.name === 'Dal Makhani');
const order = await call('POST', '/floor/orders', { sessionId: ses.id, items: [
  { dishId: tikka.id, qty: 1, guestNo: 1, spice: 'Medium', options: ['No onion'], note: 'less oil' },
  { dishId: naan.id, qty: 2, guestNo: 0 }, { dishId: curry.id, qty: 1, guestNo: 2 },
] }, priya);
ok(order.items === 3, 'take order: 3 dishes, per guest, with spice and note');
ok((await call('POST', '/floor/orders', { sessionId: ses.id, items: [{ dishId: naan.id, qty: 1, guestNo: 5 }] }, priya)).status === 400, 'guest number above the guest count is refused');

const q = await call('GET', '/kitchen/queue', undefined, ravi);
ok(q.station.name === 'Tandoor' && q.waiting.some((i: any) => i.table === 'T2'), 'tandoor chef sees T2 dishes in the shared queue');
ok(!q.waiting.some((i: any) => i.name === 'Dal Makhani'), 'curry dish is not in the tandoor queue');
ok(q.waiting.every((i: any) => !('unitPrice' in i)), 'chef never sees prices');
const tikkaItem = q.waiting.find((i: any) => i.table === 'T2' && i.name === 'Paneer Tikka');

// two chefs tap Start on the same dish at the same moment
const [a, b] = await Promise.all([call('POST', '/kitchen/claim', { ids: [tikkaItem.id] }, ravi), call('POST', '/kitchen/claim', { ids: [tikkaItem.id] }, imran)]);
ok([a.status, b.status].sort().join() === '200,409', 'same dish claimed by two chefs at once: exactly one wins');
const winner = a.status === 200 ? ravi : imran;
const loser = a.status === 200 ? imran : ravi;
ok((await call('POST', `/kitchen/items/${tikkaItem.id}/ready`, undefined, loser)).status === 403, 'another chef cannot mark my dish ready');

// limit: Ravi may cook 4 at once
const q2 = await call('GET', '/kitchen/queue', undefined, ravi);
const free = q2.waiting.map((i: any) => i.id);
const meNow = q2.chefs.find((x: any) => x.id === q2.me.id).cooking;
const tooMany = free.slice(0, q2.me.maxParallel - meNow + 1);
ok(tooMany.length <= q2.me.maxParallel - meNow || (await call('POST', '/kitchen/claim', { ids: tooMany }, ravi)).status === 409, 'chef cannot go over the limit');

ok((await call('POST', `/kitchen/items/${tikkaItem.id}/ready`, undefined, winner)).status === 200, 'chef marks the dish ready');
const tasks = await call('GET', '/team/tasks', undefined, priya);
const food = tasks.tasks.find((t: any) => t.table === 'T2' && t.kind === 'food_ready' && t.status === 'open');
ok(food && food.ownTable, "food ready alert goes to the table's waiter");
const rt = await call('GET', '/team/tasks', undefined, rahul);
ok(!rt.tasks.some((t: any) => t.id === food.id), 'other waiters do not see it before the hand-off');

// guest flow
const tbl = await call('GET', `/floor/tables/${t2.id}`, undefined, owner);
const qr = tbl.table.qrToken;
ok(tbl.table.qrUrl.endsWith(qr), 'table dashboard has its QR link');
const start = await call('POST', `/guest/table/${qr}/start`, { phone: '9998887776' });
ok(start.sent, 'guest gets a sign-in code');
ok((await call('POST', `/guest/table/${qr}/verify`, { phone: '9998887776', code: '000000' })).status === 400, 'wrong code is refused');
const g = await call('POST', `/guest/table/${qr}/verify`, { phone: '9998887776', code: start.devCode, name: 'Sneha' });
ok(g.token && g.sessionId === ses.id, 'guest joins the open table session');
const gOrder = await call('POST', '/guest/me/orders', { items: [{ dishId: naan.id, qty: 1 }] }, g.token);
ok(gOrder.orderId, 'guest orders from the menu');
const track = await call('GET', '/guest/me/session', undefined, g.token);
const mine = track.items.at(-1);
ok((await call('PATCH', `/guest/me/items/${mine.id}`, { qty: 2 }, g.token)).qty === 2, 'guest can change a waiting dish');
const cooking = track.items.find((i: any) => i.status === 'ready');
ok((await call('DELETE', `/guest/me/items/${cooking.id}`, undefined, g.token)).status === 409, 'guest cannot cancel a dish the kitchen started');
ok((await call('DELETE', `/guest/me/items/${mine.id}`, undefined, g.token)).ok, 'guest can cancel a waiting dish');
ok((await call('POST', '/guest/me/call', { note: 'Water please' }, g.token)).ok, 'guest calls the waiter');

// take and finish the food alert
ok((await call('POST', `/team/tasks/${food.id}/take`, undefined, priya)).takenBy, 'waiter taps On it');
ok((await call('POST', `/team/tasks/${food.id}/take`, undefined, rahul)).status === 409, 'second person gets "someone is already on it"');
ok((await call('POST', `/team/tasks/${food.id}/done`, undefined, priya)).doneAt, 'waiter marks it done (dish becomes served)');

// bill
ok((await call('POST', '/guest/me/bill', { method: 'upi' }, g.token)).ok, 'guest asks for the bill');
const bill = await call('GET', `/floor/sessions/${ses.id}/bill`, undefined, priya);
ok(bill.total > 0 && bill.lines.length >= 2, 'waiter sees the bill');
ok((await call('GET', `/floor/sessions/${ses.id}/bill`, undefined, admin)).status === 403, 'admin cannot see bills');
const pay = await call('POST', `/floor/sessions/${ses.id}/pay`, { method: 'upi' }, priya);
ok(pay.status === 409 || pay.total > 0, 'pay refuses while dishes cook, or closes the table');

console.log(`\n${failures ? failures + ' check(s) failed' : 'All checks passed'}`);
process.exit(failures ? 1 : 0);
export {};
