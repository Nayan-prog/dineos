import {
  pgTable, pgEnum, serial, integer, text, boolean, timestamp, jsonb, uniqueIndex, index, primaryKey,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['owner', 'manager', 'admin', 'waiter', 'chef']);
export const itemStatusEnum = pgEnum('item_status', ['waiting', 'cooking', 'ready', 'served', 'cancelled']);
export const sessionStatusEnum = pgEnum('session_status', ['open', 'billing', 'closed']);
export const taskKindEnum = pgEnum('task_kind', ['food_ready', 'call', 'bill']);
export const taskStatusEnum = pgEnum('task_status', ['open', 'taken', 'done']);
export const shapeEnum = pgEnum('table_shape', ['round', 'square', 'long']);
export const placedByEnum = pgEnum('placed_by', ['customer', 'staff']);

const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const restaurants = pgTable('restaurants', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  city: text('city').notNull().default(''),
  address: text('address').notNull().default(''),
  taxPercent: integer('tax_percent').notNull().default(5),
  /** seconds before an unanswered alert goes to all free waiters in the area */
  alertAreaSecs: integer('alert_area_secs').notNull().default(60),
  /** seconds before an unanswered alert goes to the manager */
  alertManagerSecs: integer('alert_manager_secs').notNull().default(120),
  createdAt: created(),
});

export const areas = pgTable('areas', {
  id: serial('id').primaryKey(),
  restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sort: integer('sort').notNull().default(0),
});

export const stations = pgTable('stations', {
  id: serial('id').primaryKey(),
  restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
});

export const tables = pgTable('tables', {
  id: serial('id').primaryKey(),
  restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  areaId: integer('area_id').notNull().references(() => areas.id),
  code: text('code').notNull(),
  seats: integer('seats').notNull().default(4),
  shape: shapeEnum('shape').notNull().default('square'),
  qrToken: text('qr_token').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: created(),
}, (t) => [uniqueIndex('tables_qr_token').on(t.qrToken), uniqueIndex('tables_code').on(t.restaurantId, t.code)]);

export const staff = pgTable('staff', {
  id: serial('id').primaryKey(),
  restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  role: roleEnum('role').notNull(),
  passwordHash: text('password_hash'),
  pinHash: text('pin_hash'),
  /** chefs: which station queue they cook from */
  stationId: integer('station_id').references(() => stations.id),
  /** waiters: which floor area they work */
  areaId: integer('area_id').references(() => areas.id),
  /** chefs: most dishes they may cook at once */
  maxParallel: integer('max_parallel').notNull().default(4),
  onDuty: boolean('on_duty').notNull().default(true),
  onBreak: boolean('on_break').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: created(),
}, (t) => [uniqueIndex('staff_phone').on(t.phone), uniqueIndex('staff_email').on(t.email)]);

/** which tables a waiter owns this shift */
export const waiterTables = pgTable('waiter_tables', {
  staffId: integer('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  tableId: integer('table_id').notNull().references(() => tables.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.staffId, t.tableId] }), uniqueIndex('waiter_tables_table').on(t.tableId)]);

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sort: integer('sort').notNull().default(0),
});

export const dishes = pgTable('dishes', {
  id: serial('id').primaryKey(),
  restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id').notNull().references(() => categories.id),
  stationId: integer('station_id').notNull().references(() => stations.id),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  /** paise */
  price: integer('price').notNull(),
  veg: boolean('veg').notNull().default(true),
  prepMinutes: integer('prep_minutes').notNull().default(15),
  options: jsonb('options').$type<string[]>().notNull().default([]),
  hasSpice: boolean('has_spice').notNull().default(true),
  available: boolean('available').notNull().default(true),
  createdAt: created(),
});

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  phone: text('phone').notNull(),
  name: text('name').notNull().default(''),
  visits: integer('visits').notNull().default(0),
  createdAt: created(),
}, (t) => [uniqueIndex('customers_phone').on(t.phone)]);

export const otps = pgTable('otps', {
  phone: text('phone').primaryKey(),
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').notNull().default(0),
});

export const sessions = pgTable('table_sessions', {
  id: serial('id').primaryKey(),
  restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id),
  tableId: integer('table_id').notNull().references(() => tables.id),
  customerId: integer('customer_id').references(() => customers.id),
  waiterId: integer('waiter_id').references(() => staff.id),
  guestCount: integer('guest_count').notNull().default(1),
  status: sessionStatusEnum('status').notNull().default('open'),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
}, (t) => [index('sessions_table_status').on(t.tableId, t.status)]);

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id),
  sessionId: integer('session_id').notNull().references(() => sessions.id),
  placedBy: placedByEnum('placed_by').notNull(),
  staffId: integer('staff_id').references(() => staff.id),
  createdAt: created(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  sessionId: integer('session_id').notNull().references(() => sessions.id),
  dishId: integer('dish_id').notNull().references(() => dishes.id),
  stationId: integer('station_id').notNull().references(() => stations.id),
  qty: integer('qty').notNull(),
  /** 0 = shared, 1..n = guest number */
  guestNo: integer('guest_no').notNull().default(0),
  spice: text('spice'),
  options: jsonb('options').$type<string[]>().notNull().default([]),
  note: text('note').notNull().default(''),
  unitPrice: integer('unit_price').notNull(),
  status: itemStatusEnum('status').notNull().default('waiting'),
  remake: boolean('remake').notNull().default(false),
  claimedBy: integer('claimed_by').references(() => staff.id),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  readyAt: timestamp('ready_at', { withTimezone: true }),
  servedAt: timestamp('served_at', { withTimezone: true }),
  createdAt: created(),
}, (t) => [index('items_station_status').on(t.stationId, t.status), index('items_session').on(t.sessionId)]);

export const tasks = pgTable('service_tasks', {
  id: serial('id').primaryKey(),
  restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id),
  tableId: integer('table_id').notNull().references(() => tables.id),
  sessionId: integer('session_id').references(() => sessions.id),
  areaId: integer('area_id').references(() => areas.id),
  kind: taskKindEnum('kind').notNull(),
  detail: text('detail').notNull().default(''),
  /** the table's waiter at the time the alert was raised */
  assignedTo: integer('assigned_to').references(() => staff.id),
  level: integer('level').notNull().default(0),
  status: taskStatusEnum('status').notNull().default('open'),
  takenBy: integer('taken_by').references(() => staff.id),
  createdAt: created(),
  escalatedAt: timestamp('escalated_at', { withTimezone: true }),
  takenAt: timestamp('taken_at', { withTimezone: true }),
  doneAt: timestamp('done_at', { withTimezone: true }),
}, (t) => [index('tasks_status').on(t.restaurantId, t.status)]);

export const bills = pgTable('bills', {
  id: serial('id').primaryKey(),
  restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id),
  sessionId: integer('session_id').notNull().references(() => sessions.id),
  subtotal: integer('subtotal').notNull(),
  tax: integer('tax').notNull(),
  discount: integer('discount').notNull().default(0),
  total: integer('total').notNull(),
  method: text('method').notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull().defaultNow(),
  staffId: integer('staff_id').references(() => staff.id),
}, (t) => [uniqueIndex('bills_session').on(t.sessionId)]);

export const activity = pgTable('activity_log', {
  id: serial('id').primaryKey(),
  restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id),
  staffId: integer('staff_id').references(() => staff.id),
  kind: text('kind').notNull(),
  text: text('text').notNull(),
  createdAt: created(),
});
