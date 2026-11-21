import { z } from 'zod';

// ---------- roles ----------
export const ROLES = ['owner', 'manager', 'admin', 'waiter', 'chef'] as const;
export type Role = (typeof ROLES)[number];

/** Owner and Manager see everything including money. Admin runs operations without money. */
export const canSeeMoney = (role: Role) => role === 'owner' || role === 'manager' || role === 'waiter';
export const isManagerTeam = (role: Role) => role === 'owner' || role === 'manager' || role === 'admin';

/** Keys removed from every API response for roles that may not see money. */
export const MONEY_KEYS = ['price', 'unitPrice', 'lineTotal', 'subtotal', 'tax', 'discount', 'total', 'revenue', 'avgTicket', 'amount', 'spend'] as const;

export function stripMoney<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripMoney) as T;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if ((MONEY_KEYS as readonly string[]).includes(k)) continue;
      out[k] = stripMoney(v);
    }
    return out as T;
  }
  return value;
}

// ---------- statuses ----------
/** Placed → Cooking → Ready → Served. "waiting" is the Placed state; guests can edit or cancel only here. */
export const ITEM_STATUS = ['waiting', 'cooking', 'ready', 'served', 'cancelled'] as const;
export type ItemStatus = (typeof ITEM_STATUS)[number];
export const ITEM_LABEL: Record<ItemStatus, string> = {
  waiting: 'Placed', cooking: 'Cooking', ready: 'Ready', served: 'Served', cancelled: 'Cancelled',
};

export const TASK_KINDS = ['food_ready', 'call', 'bill'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];
export const TASK_LABEL: Record<TaskKind, string> = { food_ready: 'Food ready', call: 'Guest calling', bill: 'Bill requested' };
/** 0 = table's waiter, 1 = free waiters in the area, 2 = manager */
export type TaskLevel = 0 | 1 | 2;

export const SPICE = ['Mild', 'Medium', 'Spicy', 'Extra spicy'] as const;
export const PAY_METHODS = ['cash', 'upi', 'card'] as const;

// ---------- request schemas ----------
export const orderItemInput = z.object({
  dishId: z.number().int().positive(),
  qty: z.number().int().min(1).max(50),
  guestNo: z.number().int().min(0).max(30).default(0), // 0 = shared
  spice: z.enum(SPICE).nullable().optional(),
  options: z.array(z.string().max(40)).max(10).default([]),
  note: z.string().max(200).default(''),
});
export type OrderItemInput = z.infer<typeof orderItemInput>;

export const createOrderInput = z.object({
  sessionId: z.number().int().positive(),
  items: z.array(orderItemInput).min(1).max(60),
});

export const openSessionInput = z.object({
  tableId: z.number().int().positive(),
  guestCount: z.number().int().min(1).max(30),
});

export const loginInput = z.object({ email: z.string().email(), password: z.string().min(6) });
export const pinLoginInput = z.object({ phone: z.string().min(6).max(15), pin: z.string().regex(/^\d{4,6}$/) });
export const signupInput = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  restaurantName: z.string().min(2).max(80),
  city: z.string().max(80).default(''),
  role: z.enum(['owner', 'manager']).default('owner'),
});

export const createTableInput = z.object({
  areaId: z.number().int().positive(),
  code: z.string().min(1).max(10),
  seats: z.number().int().min(1).max(30),
  shape: z.enum(['round', 'square', 'long']).default('square'),
});

export const dishInput = z.object({
  categoryId: z.number().int().positive(),
  stationId: z.number().int().positive(),
  name: z.string().min(2).max(80),
  description: z.string().max(300).default(''),
  price: z.number().int().min(0), // paise
  veg: z.boolean().default(true),
  prepMinutes: z.number().int().min(1).max(120).default(15),
  options: z.array(z.string().max(40)).max(12).default([]),
  hasSpice: z.boolean().default(true),
  available: z.boolean().default(true),
});

export const staffInput = z.object({
  name: z.string().min(2).max(80),
  phone: z.string().min(6).max(15),
  email: z.string().email().optional(),
  role: z.enum(ROLES),
  pin: z.string().regex(/^\d{4,6}$/).optional(),
  password: z.string().min(8).optional(),
  stationId: z.number().int().positive().nullable().optional(),
  areaId: z.number().int().positive().nullable().optional(),
  maxParallel: z.number().int().min(1).max(10).default(4),
});

export const customerStartInput = z.object({ phone: z.string().regex(/^\+?\d{10,13}$/) });
export const customerVerifyInput = z.object({ phone: z.string(), code: z.string().length(6), name: z.string().max(60).optional() });

// ---------- live events ----------
export type LiveEvent =
  | { type: 'order.created'; orderId: number; tableId: number }
  | { type: 'item.updated'; itemId: number; status: ItemStatus; tableId: number; stationId: number }
  | { type: 'task.updated'; taskId: number; status: string; level: number }
  | { type: 'table.updated'; tableId: number }
  | { type: 'staff.updated'; staffId: number };

// ---------- helpers ----------
export const rupees = (paise: number | null | undefined) =>
  paise == null ? '—' : '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export const minutesSince = (d: string | Date) => Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
