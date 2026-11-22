# DineOS — restaurant management (Spice Garden demo)

Chefs, dishes, table orders, QR ordering and live dashboards for one restaurant.

**Built with:** PostgreSQL, TypeScript, TanStack (Router and Query), React Native, Supabase and AWS. The web app is styled with Tailwind CSS.

| Part | Folder | Stack |
|---|---|---|
| API + live updates | `apps/api` | TypeScript, Hono, Drizzle ORM, PostgreSQL, WebSockets |
| Web (manager, admin, waiter, chef, customer QR) | `apps/web` | React, TanStack Router, TanStack Query, Tailwind CSS v4, Vite |
| Staff app (waiter, chef, manager) | `apps/mobile` | React Native (Expo, expo-router) |
| Shared types, rules, validation | `packages/shared` | TypeScript, zod |

## 1. Set up once

You need **Node.js 20+**, **pnpm** (`npm i -g pnpm`) and **PostgreSQL 16** with an empty database called `dineos`.

```bash
cp .env.example .env          # then put your Postgres password into DATABASE_URL
pnpm install
pnpm db:push                  # creates the tables
pnpm db:seed                  # Spice Garden: 26 tables, 20 dishes, 16 staff, a live evening
```

## 2. Run

```bash
pnpm dev                      # API on :4000 and web on :5173
```

Open http://localhost:5173

| Role | Sign in |
|---|---|
| Owner | owner@spicegarden.in · dineos123 |
| Manager | manager@spicegarden.in · dineos123 |
| Admin (no money) | admin@spicegarden.in · dineos123 |
| Waiter (Priya, T1–T7) | Staff → 9811111111 · PIN 1111 |
| Chef (Ravi, Tandoor) | Staff → 9822222221 · PIN 2222 |
| Customer | open any table → "Open guest view", any 10-digit number, code **123456** |

Open two browser windows (e.g. waiter + chef) to see live updates.

## 3. Staff app on your phone (Expo Go)

```bash
cd apps/mobile
cp .env.example .env          # set EXPO_PUBLIC_API_URL=http://<your laptop Wi-Fi IP>:4000
pnpm start                    # scan the QR with Expo Go (phone and laptop on the same Wi-Fi)
```

The app is on Expo SDK 58. If your Expo Go asks for another SDK, run `npx expo install --fix` in `apps/mobile`.
For the table QR codes to open on phones, set `PUBLIC_WEB_URL=http://<laptop IP>:5173` in `.env`.

## 4. Check it works

```bash
pnpm --filter @dineos/api test:flow   # with pnpm dev running and a fresh seed: 34 end-to-end checks
pnpm typecheck
pnpm db:reset                         # wipe and reseed
```

## How the important rules work

- **Roles.** Owner and Manager see everything. Admin runs operations but the API strips every money field (`stripMoney` in `packages/shared`). Waiters only see and work their own tables. Chefs only see their station.
- **Orders.** Dish status is Placed → Cooking → Ready → Served. Guests can edit or cancel only while a dish is Placed; after that only the manager can void it.
- **Kitchen queue.** Every dish goes to its station. Chefs at a station share one queue (remake → running late → oldest). Start claims a dish with `SELECT … FOR UPDATE SKIP LOCKED`, so two chefs can never take the same dish. Each chef has a "max at once" limit.
- **Waiter alerts.** Food ready, guest calls and bill requests go to the table's waiter first. If nobody taps "On it" in 60 s, every on-duty waiter in that area sees it; after 120 s the manager does (timers in Shifts & Sections). First tap wins.
- **Live updates.** The API sends small events over `/ws`; screens refetch what they show.

## Not built yet

- SMS for the customer sign-in code (plug MSG91/Twilio into `apps/api/src/routes/guest.ts`; dev mode prints the code).
- Online payment (UPI/card are recorded as methods; no gateway).
- Google sign-in.
- Printing kitchen tickets.
