# DineOS — notes for Claude

Restaurant (not hotel rooms) management system. Demo restaurant: Spice Garden, FC Road, Pune. Read README.md for setup.

## Layout
- `packages/shared/src/index.ts` — roles, statuses, zod request schemas, `stripMoney`, `rupees`. Imported as `@dineos/shared` (TS source, no build step).
- `apps/api` — Hono + Drizzle + postgres-js. `src/db/schema.ts` (all tables), `src/db/seed.ts`, `src/lib/service.ts` (placeOrder, claimItems, raiseTask, escalate), routes in `src/routes/*`: auth, guest (QR flow, mounted /api/guest, guest-only under /me), floor (tables, sessions, orders, bills), kitchen (station queue), team (alerts, staff, shifts, settings), manage (dashboard, analytics, menu edits).
- `apps/web` — Vite + React 19 + TanStack Router (code routes in `src/main.tsx`) + TanStack Query. `src/ui.tsx` (Shell with role sidebars, icons, Modal, Stepper), `src/api.ts` (fetch + `useLive` WebSocket). Pages in `src/pages/{auth,manager,waiter,chef,guest}`.
- `apps/mobile` — Expo SDK 58, expo-router. Screens in `app/` (login, waiter, chef, manager). `lib/api.ts`, `lib/ui.tsx`.

## Rules that must not break
- Roles: owner, manager = everything incl. money; admin = operations, no money (always return data via `out(c, data)` which strips money for admin/chef); waiter = own tables only (`waiterTables`); chef = own station only.
- Item status: waiting(=Placed) → cooking → ready → served (+ cancelled). There is no "accepted" status. Guests edit/cancel only `waiting` items.
- Kitchen claim must stay atomic (`FOR UPDATE SKIP LOCKED`) and respect `staff.maxParallel` and `onBreak`.
- Alerts: level 0 table's waiter → level 1 area waiters after `alertAreaSecs` → level 2 manager after `alertManagerSecs`. First "take" wins (update … where status='open').
- Money is stored in paise (integers).

## Design (from the ScaleAgee-style designs)
Dark, minimal, professional: bg #0b0b0c, text #f2f2f3, muted #a1a1a8 / #8b8b93, accent #7db0f9 / #3b82f6, green #5eb88a, amber #f5b454, taupe #c9b29b, red #e0705c. Fonts Comfortaa (brand, section titles) + Inter.
User preferences: not bulky; no card backgrounds on dashboard sections, use thin separators (#232327) instead; badges/pills have no background colour; no progress bars in sign-up; web pages are real desktop layouts (sidebar), not phone layouts.

## Commands
`pnpm dev`, `pnpm typecheck`, `pnpm db:push`, `pnpm db:seed`, `pnpm db:reset`, `pnpm --filter @dineos/api test:flow` (needs API running on a fresh seed).
