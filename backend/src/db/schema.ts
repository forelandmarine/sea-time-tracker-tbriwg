import { pgTable, text, timestamp, uuid, boolean, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const vessels = pgTable('vessels', {
  id: uuid('id').primaryKey().defaultRandom(),
  mmsi: text('mmsi').notNull().unique(),
  vessel_name: text('vessel_name').notNull(),
  flag: text('flag'),
  official_number: text('official_number'),
  type: text('type'), // 'Motor' or 'Sail'
  length_metres: decimal('length_metres', { precision: 8, scale: 2 }),
  gross_tonnes: decimal('gross_tonnes', { precision: 10, scale: 2 }),
  is_active: boolean('is_active').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('vessels_mmsi_idx').on(table.mmsi),
  index('vessels_is_active_idx').on(table.is_active),
]);

export const sea_time_entries = pgTable('sea_time_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  vessel_id: uuid('vessel_id').notNull().references(() => vessels.id, { onDelete: 'cascade' }),
  start_time: timestamp('start_time').notNull(),
  end_time: timestamp('end_time'),
  duration_hours: decimal('duration_hours', { precision: 10, scale: 2 }),
  status: text('status').notNull().default('pending'),
  notes: text('notes'),
  start_latitude: decimal('start_latitude', { precision: 9, scale: 6 }),
  start_longitude: decimal('start_longitude', { precision: 10, scale: 6 }),
  end_latitude: decimal('end_latitude', { precision: 9, scale: 6 }),
  end_longitude: decimal('end_longitude', { precision: 10, scale: 6 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('sea_time_entries_vessel_id_idx').on(table.vessel_id),
  index('sea_time_entries_status_idx').on(table.status),
]);

export const ais_checks = pgTable('ais_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  vessel_id: uuid('vessel_id').notNull().references(() => vessels.id, { onDelete: 'cascade' }),
  check_time: timestamp('check_time').notNull(),
  is_moving: boolean('is_moving').notNull(),
  speed_knots: decimal('speed_knots', { precision: 8, scale: 2 }),
  latitude: decimal('latitude', { precision: 9, scale: 6 }),
  longitude: decimal('longitude', { precision: 10, scale: 6 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('ais_checks_vessel_time_idx').on(table.vessel_id, table.check_time),
]);

export const vesselsRelations = relations(vessels, ({ many }) => ({
  sea_time_entries: many(sea_time_entries),
  ais_checks: many(ais_checks),
}));

export const sea_time_entriesRelations = relations(sea_time_entries, ({ one }) => ({
  vessel: one(vessels, {
    fields: [sea_time_entries.vessel_id],
    references: [vessels.id],
  }),
}));

export const ais_checksRelations = relations(ais_checks, ({ one }) => ({
  vessel: one(vessels, {
    fields: [ais_checks.vessel_id],
    references: [vessels.id],
  }),
}));

export const ais_debug_logs = pgTable('ais_debug_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  vessel_id: uuid('vessel_id').notNull().references(() => vessels.id, { onDelete: 'cascade' }),
  mmsi: text('mmsi').notNull(),
  api_url: text('api_url').notNull(),
  request_time: timestamp('request_time').notNull(),
  response_status: text('response_status').notNull(),
  response_body: text('response_body'),
  authentication_status: text('authentication_status').notNull(),
  error_message: text('error_message'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('ais_debug_logs_vessel_request_time_idx').on(table.vessel_id, table.request_time),
  index('ais_debug_logs_mmsi_request_idx').on(table.mmsi),
]);

export const scheduled_tasks = pgTable('scheduled_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  task_type: text('task_type').notNull(), // e.g., 'ais_check'
  vessel_id: uuid('vessel_id').notNull().references(() => vessels.id, { onDelete: 'cascade' }),
  interval_hours: text('interval_hours').notNull(),
  last_run: timestamp('last_run'),
  next_run: timestamp('next_run').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('scheduled_tasks_vessel_task_idx').on(table.vessel_id, table.task_type),
  index('scheduled_tasks_next_run_task_idx').on(table.next_run),
  index('scheduled_tasks_active_idx').on(table.is_active),
]);

export const ais_debug_logsRelations = relations(ais_debug_logs, ({ one }) => ({
  vessel: one(vessels, {
    fields: [ais_debug_logs.vessel_id],
    references: [vessels.id],
  }),
}));

export const scheduled_tasksRelations = relations(scheduled_tasks, ({ one }) => ({
  vessel: one(vessels, {
    fields: [scheduled_tasks.vessel_id],
    references: [vessels.id],
  }),
}));
