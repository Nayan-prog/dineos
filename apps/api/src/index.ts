import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { eq } from 'drizzle-orm';
import { db, schema as s } from './db/client.js';
import { verify } from './lib/auth.js';
import { join, leaveAll, room } from './lib/live.js';
import { escalate } from './lib/service.js';
import { auth } from './routes/auth.js';
import { guest } from './routes/guest.js';
import { floor } from './routes/floor.js';
import { kitchen } from './routes/kitchen.js';
import { team } from './routes/team.js';
import { manage } from './routes/manage.js';

export const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use('*', logger());
app.use('/api/*', cors({ origin: (o) => o ?? '*', allowHeaders: ['Content-Type', 'Authorization'], allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] }));

app.get('/api/health', (c) => c.json({ ok: true }));
app.route('/api/auth', auth);
app.route('/api/guest', guest);
app.route('/api/floor', floor);
app.route('/api/kitchen', kitchen);
app.route('/api/team', team);
app.route('/api/manage', manage);

/**
 * Live updates: connect to /ws?token=<jwt>. The server only sends small events
 * ({ type: 'item.updated', ... }); clients refetch what they show.
 */
app.get('/ws', upgradeWebSocket(async (c) => {
  const t = c.req.query('token') ?? '';
  return {
    async onOpen(_e, ws) {
      try {
        const cl = await verify(t);
        if (cl.kind === 'guest') { join(room.session(cl.sessionId), ws); return; }
        join(room.staff(cl.sub), ws);
        if (cl.role === 'waiter') join(room.waiters(cl.rid), ws);
        else if (cl.role === 'chef') {
          const [x] = await db.select({ stationId: s.staff.stationId }).from(s.staff).where(eq(s.staff.id, cl.sub));
          if (x?.stationId) join(room.station(cl.rid, x.stationId), ws);
        } else join(room.team(cl.rid), ws);
      } catch { ws.close(4001, 'unauthorized'); }
    },
    onClose(_e, ws) { leaveAll(ws); },
  };
}));

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'Something went wrong. Try again.' }, 500);
});
app.notFound((c) => c.json({ error: 'Not found' }, 404));

const port = Number(process.env.PORT ?? 4000);
const server = serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => console.log(`DineOS API on http://localhost:${port}`));
injectWebSocket(server);

// alerts nobody took move on: table's waiter → area → manager
setInterval(() => { escalate().catch((e) => console.error('escalate', e)); }, 5000);
